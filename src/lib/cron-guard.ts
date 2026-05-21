import { randomUUID } from "node:crypto";
import { restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export type CronWorkerMode =
  | "tick"
  | "detail_worker"
  | "deep_crawl"
  | "market_worker"
  | "pool_warmer"
  | "lifecycle_worker"
  | "lifecycle_terminal_recheck"
  | "housekeeper"
  | "collect"
  | "compliance_retention"
  | "housekeeper_ai_cache_prune"
  | "hotdeal_worker"
  | "reference_price_refresh"
  | "joongna_worker"
  | "score_worker";

type CronGuardSkipReason = "cooldown" | "same_worker_running" | "source_health_unhealthy";

type SourceHealthStatus = "healthy" | "degraded" | "unhealthy";

type SourceHealthForGuard = {
  status: SourceHealthStatus;
  checked_at: string | null;
  reason: string | null;
};

type CronGuardRequestLike = {
  nextUrl?: {
    searchParams?: URLSearchParams;
  };
};

type CronGuardState = {
  running: Map<CronWorkerMode, { startedAt: number; leaseUntil: number }>;
  lastAcceptedAt: Map<CronWorkerMode, number>;
  skipCounters: Map<string, {
    mode: CronWorkerMode;
    reason: CronGuardSkipReason;
    hourBucket: string;
    count: number;
    updatedAt: number;
  }>;
  recentSkips: Array<{
    mode: CronWorkerMode;
    reason: CronGuardSkipReason;
    retryAfterMs: number;
    ts: number;
    detail?: Record<string, string | number | null>;
  }>;
};

export type CronGuardAllowed = {
  allowed: true;
  mode: CronWorkerMode;
  leaseUntil: string;
  release: () => void;
};

export type CronGuardSkipped = {
  allowed: false;
  mode: CronWorkerMode;
  reason: CronGuardSkipReason;
  retryAfterMs: number;
  ts: string;
  detail?: Record<string, string | number | null>;
};

const DEFAULT_COOLDOWN_MS: Record<CronWorkerMode, number> = {
  tick: 60_000,
  detail_worker: 60_000,
  deep_crawl: 10 * 60_000,
  market_worker: 10 * 60_000,
  pool_warmer: 5 * 60_000,
  lifecycle_worker: 2 * 60_000,
  lifecycle_terminal_recheck: 5 * 60_000,
  housekeeper: 5 * 60_000,
  collect: 5 * 60_000,
  compliance_retention: 60_000,
  housekeeper_ai_cache_prune: 30 * 60_000,
  hotdeal_worker: 60_000,
  reference_price_refresh: 60 * 60_000,
  joongna_worker: 5 * 60_000,
  score_worker: 60_000,
};

const DEFAULT_LEASE_MS: Record<CronWorkerMode, number> = {
  tick: 2 * 60_000,
  detail_worker: 2 * 60_000,
  deep_crawl: 2 * 60_000,
  market_worker: 2 * 60_000,
  pool_warmer: 2 * 60_000,
  lifecycle_worker: 2 * 60_000,
  lifecycle_terminal_recheck: 2 * 60_000,
  housekeeper: 2 * 60_000,
  collect: 2 * 60_000,
  compliance_retention: 2 * 60_000,
  housekeeper_ai_cache_prune: 2 * 60_000,
  hotdeal_worker: 60_000,
  reference_price_refresh: 2 * 60_000,
  joongna_worker: 2 * 60_000,
  score_worker: 90_000,
};

const HEAVY_SOURCE_HEALTH_GUARD_MODES = new Set<CronWorkerMode>([
  "deep_crawl",
  "market_worker",
  "pool_warmer",
  "lifecycle_terminal_recheck",
  "joongna_worker",
]);

let sourceHealthLoaderForTests: (() => Promise<SourceHealthForGuard | null>) | null = null;

function guardState() {
  const globalForGuard = globalThis as typeof globalThis & { __minyoiCronGuard?: CronGuardState };
  globalForGuard.__minyoiCronGuard ??= {
    running: new Map(),
    lastAcceptedAt: new Map(),
    skipCounters: new Map(),
    recentSkips: [],
  };
  return globalForGuard.__minyoiCronGuard;
}

function envMs(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const parsed = raw == null ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function envBool(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return raw === "1" || raw === "true" || raw === "on";
}

function modeEnvKey(prefix: string, mode: CronWorkerMode) {
  return `${prefix}_${mode.toUpperCase()}`;
}

function isForceRun(req?: CronGuardRequestLike) {
  const raw = req?.nextUrl?.searchParams?.get("force");
  return raw === "1" || raw === "true" || raw === "on";
}

function hourBucket(now: number) {
  const date = new Date(now);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function recordSkip(state: CronGuardState, skip: CronGuardSkipped, now: number) {
  const bucket = hourBucket(now);
  const key = `${skip.mode}:${skip.reason}:${bucket}`;
  const current = state.skipCounters.get(key);
  state.skipCounters.set(key, {
    mode: skip.mode,
    reason: skip.reason,
    hourBucket: bucket,
    count: (current?.count ?? 0) + 1,
    updatedAt: now,
  });
  state.recentSkips.unshift({
    mode: skip.mode,
    reason: skip.reason,
    retryAfterMs: skip.retryAfterMs,
    ts: now,
    detail: skip.detail,
  });
  state.recentSkips = state.recentSkips.slice(0, 30);

  const cutoff = now - 6 * 60 * 60_000;
  for (const [counterKey, counter] of state.skipCounters.entries()) {
    if (counter.updatedAt < cutoff) state.skipCounters.delete(counterKey);
  }
}

function skipped(
  state: CronGuardState,
  mode: CronWorkerMode,
  reason: CronGuardSkipReason,
  retryAfterMs: number,
  now: number,
  detail?: Record<string, string | number | null>,
): CronGuardSkipped {
  const skip = {
    allowed: false,
    mode,
    reason,
    retryAfterMs,
    ts: new Date(now).toISOString(),
    detail,
  } as const;
  recordSkip(state, skip, now);
  return skip;
}

function shouldSkipForSourceHealth(
  mode: CronWorkerMode,
  health: SourceHealthForGuard | null,
  now: number,
) {
  if (!HEAVY_SOURCE_HEALTH_GUARD_MODES.has(mode)) return null;
  if (!health || health.status !== "unhealthy") return null;

  const staleMs = envMs("CRON_GUARD_SOURCE_HEALTH_STALE_MS", 10 * 60_000, 60_000, 6 * 60 * 60_000);
  const checkedAtMs = health.checked_at ? Date.parse(health.checked_at) : Number.NaN;
  const ageMs = Number.isFinite(checkedAtMs) ? now - checkedAtMs : Number.POSITIVE_INFINITY;
  if (mode === "market_worker" && ageMs >= staleMs) {
    return null;
  }

  return {
    retryAfterMs: Math.max(0, staleMs - (Number.isFinite(ageMs) ? ageMs : staleMs)),
    detail: {
      sourceHealth: health.status,
      checkedAt: health.checked_at,
      reason: health.reason,
      ageMs: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs)) : null,
    },
  };
}

function sourceForHealthGuard(mode: CronWorkerMode) {
  return mode === "joongna_worker" ? "joongna" : "bunjang";
}

async function loadLatestSourceHealthForGuard(mode: CronWorkerMode): Promise<SourceHealthForGuard | null> {
  if (sourceHealthLoaderForTests) return sourceHealthLoaderForTests();
  try {
    const source = sourceForHealthGuard(mode);
    const url = `${tableUrl("mvp_source_health")}?select=status,checked_at,reason&source=eq.${source}&order=checked_at.desc&limit=1`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const rows = (await res.json()) as SourceHealthForGuard[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

function acquireCronGuardInternal(
  mode: CronWorkerMode,
  req?: CronGuardRequestLike,
  sourceHealth?: SourceHealthForGuard | null,
): CronGuardAllowed | CronGuardSkipped {
  const now = Date.now();
  const state = guardState();
  const force = isForceRun(req);
  const cooldownMs = force
    ? 0
    : envMs(modeEnvKey("CRON_GUARD_COOLDOWN_MS", mode), DEFAULT_COOLDOWN_MS[mode], 0, 24 * 60 * 60_000);
  const leaseMs = envMs(modeEnvKey("CRON_GUARD_LEASE_MS", mode), DEFAULT_LEASE_MS[mode], 10_000, 30 * 60_000);

  const running = state.running.get(mode);
  if (!force && running && running.leaseUntil > now) {
    return skipped(state, mode, "same_worker_running", running.leaseUntil - now, now);
  }
  if (running && running.leaseUntil <= now) {
    state.running.delete(mode);
  }

  const lastAcceptedAt = state.lastAcceptedAt.get(mode) ?? 0;
  if (!force && cooldownMs > 0 && now - lastAcceptedAt < cooldownMs) {
    return skipped(state, mode, "cooldown", cooldownMs - (now - lastAcceptedAt), now);
  }

  if (!force && envBool("CRON_GUARD_SOURCE_HEALTH_ENABLED", true)) {
    const sourceHealthSkip = shouldSkipForSourceHealth(mode, sourceHealth ?? null, now);
    if (sourceHealthSkip) {
      return skipped(state, mode, "source_health_unhealthy", sourceHealthSkip.retryAfterMs, now, sourceHealthSkip.detail);
    }
  }

  const leaseUntilMs = now + leaseMs;
  state.running.set(mode, { startedAt: now, leaseUntil: leaseUntilMs });
  state.lastAcceptedAt.set(mode, now);

  let released = false;
  return {
    allowed: true,
    mode,
    leaseUntil: new Date(leaseUntilMs).toISOString(),
    release: () => {
      if (released) return;
      released = true;
      const current = state.running.get(mode);
      if (current?.startedAt === now) {
        state.running.delete(mode);
      }
    },
  };
}

export function acquireCronGuard(
  mode: CronWorkerMode,
  req?: CronGuardRequestLike,
): CronGuardAllowed | CronGuardSkipped {
  return acquireCronGuardInternal(mode, req);
}

export async function acquireCronGuardWithSourceHealth(
  mode: CronWorkerMode,
  req?: CronGuardRequestLike,
): Promise<CronGuardAllowed | CronGuardSkipped> {
  const sourceHealth =
    HEAVY_SOURCE_HEALTH_GUARD_MODES.has(mode) && !isForceRun(req)
      ? await loadLatestSourceHealthForGuard(mode)
      : null;
  const memoryResult = acquireCronGuardInternal(mode, req, sourceHealth);
  if (!memoryResult.allowed) return memoryResult;

  // P0-3: DB lease 보강. CRON_GUARD_DB_LOCK_ENABLED=1일 때만 활성.
  // 멀티 인스턴스에서 동일 mode 동시 실행을 차단한다. 실패하면 메모리 release 후 skip.
  const dbLockEnabled = mode === "joongna_worker" || envBool("CRON_GUARD_DB_LOCK_ENABLED", false);
  if (!dbLockEnabled || isForceRun(req)) {
    return memoryResult;
  }
  const leaseMs = envMs(modeEnvKey("CRON_GUARD_LEASE_MS", mode), DEFAULT_LEASE_MS[mode], 10_000, 30 * 60_000);
  const dbResult = await tryAcquireDbLock(mode, Math.ceil(leaseMs / 1000));
  if (!dbResult.acquired) {
    memoryResult.release();
    const state = guardState();
    const now = Date.now();
    return skipped(state, mode, "same_worker_running", dbResult.retryAfterMs ?? leaseMs, now, {
      source: "db_lock",
      owner: dbResult.owner ?? null,
      leaseUntil: dbResult.leaseUntil ?? null,
    });
  }
  const ownerToken = dbResult.owner;
  return {
    ...memoryResult,
    leaseUntil: dbResult.leaseUntil ?? memoryResult.leaseUntil,
    release: () => {
      memoryResult.release();
      if (ownerToken) {
        releaseDbLock(mode, ownerToken).catch((err) => {
          console.error("cron guard db lock release failed", { mode, err });
        });
      }
    },
  };
}

type CronDbLockOutcome = {
  acquired: boolean;
  owner: string | null;
  leaseUntil: string | null;
  retryAfterMs: number | null;
};

async function tryAcquireDbLock(mode: CronWorkerMode, leaseSeconds: number): Promise<CronDbLockOutcome> {
  const owner = randomUUID();
  try {
    const res = await restFetch(rpcUrl("try_acquire_mvp_cron_lock"), {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({ p_mode: mode, p_owner: owner, p_lease_seconds: leaseSeconds }),
    });
    const rows = (await res.json()) as Array<{
      acquired: boolean | null;
      owner: string | null;
      lease_until: string | null;
    }>;
    const row = rows[0];
    if (!row) return { acquired: false, owner: null, leaseUntil: null, retryAfterMs: null };
    const leaseUntilMs = row.lease_until ? Date.parse(row.lease_until) : Number.NaN;
    const retryAfterMs = Number.isFinite(leaseUntilMs) ? Math.max(0, leaseUntilMs - Date.now()) : null;
    return {
      acquired: row.acquired === true,
      owner: row.acquired === true ? owner : row.owner,
      leaseUntil: row.lease_until,
      retryAfterMs,
    };
  } catch (err) {
    // DB 호출 실패는 fail-open(기존 메모리 guard만 사용). 가용성 우선.
    console.error("cron guard db lock acquire failed", { mode, err });
    return { acquired: true, owner, leaseUntil: null, retryAfterMs: null };
  }
}

async function releaseDbLock(mode: CronWorkerMode, owner: string): Promise<void> {
  try {
    await restFetch(rpcUrl("release_mvp_cron_lock"), {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({ p_mode: mode, p_owner: owner }),
    });
  } catch (err) {
    console.error("cron guard db lock release error", { mode, err });
  }
}

export function cronGuardSkipBody(skip: CronGuardSkipped) {
  return {
    ok: true,
    started: false,
    skipped: true,
    mode: skip.mode,
    reason: skip.reason,
    retryAfterMs: skip.retryAfterMs,
    detail: skip.detail,
    ts: skip.ts,
  };
}

export function setCronGuardSourceHealthLoaderForTests(loader: (() => Promise<SourceHealthForGuard | null>) | null) {
  sourceHealthLoaderForTests = loader;
}

export function resetCronGuardForTests() {
  const state = guardState();
  state.running.clear();
  state.lastAcceptedAt.clear();
  state.skipCounters.clear();
  state.recentSkips = [];
  sourceHealthLoaderForTests = null;
}

export function getCronGuardSnapshot() {
  const state = guardState();
  const now = Date.now();
  const oneHourAgo = now - 60 * 60_000;
  const counters = [...state.skipCounters.values()]
    .filter((counter) => counter.updatedAt >= oneHourAgo)
    .sort((a, b) => b.count - a.count || b.updatedAt - a.updatedAt)
    .map((counter) => ({
      mode: counter.mode,
      reason: counter.reason,
      hourBucket: counter.hourBucket,
      count: counter.count,
      updatedAt: new Date(counter.updatedAt).toISOString(),
    }));
  const running = [...state.running.entries()]
    .filter(([, value]) => value.leaseUntil > now)
    .map(([mode, value]) => ({
      mode,
      startedAt: new Date(value.startedAt).toISOString(),
      leaseUntil: new Date(value.leaseUntil).toISOString(),
    }))
    .sort((a, b) => a.mode.localeCompare(b.mode));

  return {
    running,
    skipCounters: counters,
    recentSkips: state.recentSkips
      .filter((item) => item.ts >= oneHourAgo)
      .slice(0, 12)
      .map((item) => ({
        mode: item.mode,
        reason: item.reason,
        retryAfterMs: item.retryAfterMs,
        detail: item.detail,
        ts: new Date(item.ts).toISOString(),
      })),
    totalSkipsLastHour: counters.reduce((sum, counter) => sum + counter.count, 0),
  };
}
