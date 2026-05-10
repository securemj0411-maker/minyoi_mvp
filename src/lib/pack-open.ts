import { fetchDetail } from "@/lib/bunjang";
import { detectSoldOut, describeSignals, isSoldOut } from "@/lib/sold-out";

const TIMEOUT_MS = 30_000;

export type PackBand = 1 | 2 | 3;

export type RevealCard = {
  pid: number;
  name: string;
  url: string;
  price: number;
  skuName: string;
  thumbnailUrl: string | null;
  expectedProfitMin: number;
  expectedProfitMax: number;
  confidence: number;
  lastVerifiedAt: string;
  freshSeconds: number;
};

export type PackOpenInput = {
  band: PackBand;
  userRef: string;
  tokensSpent: number;
  requestedCards?: number;
};

export type PackOpenSuccess = {
  result: "success";
  packOpenId: number;
  reveals: RevealCard[];
  attemptedCount: number;
  durationMs: number;
};

export type PackOpenRefunded = {
  result: "refunded";
  reason: string;
  attemptedCount: number;
  tokensRefunded: number;
  durationMs: number;
};

export type PackOpenUnavailable = {
  result: "unavailable";
  reason: string;
  durationMs: number;
};

export type PackOpenResult = PackOpenSuccess | PackOpenRefunded | PackOpenUnavailable;

type ReservedRow = {
  pid: number;
  profit_band: number;
  expected_profit_min: number;
  expected_profit_max: number;
  score: number;
  confidence: number;
  comparable_key: string | null;
  exposure_count: number;
  max_exposure: number;
  last_verified_at: string;
  reserved_until: string;
};

type ListingMeta = {
  pid: number;
  name: string;
  url: string;
  price: number;
  sku_name: string;
  thumbnail_url: string | null;
};

function supabaseRest() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) throw new Error("SUPABASE_URL missing");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders(prefer?: string): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function callSupabase(path: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${supabaseRest()}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`supabase ${init.method ?? "GET"} ${res.status}: ${body.slice(0, 300)}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function rpcReservePool(band: PackBand, userRef: string, limit: number): Promise<ReservedRow[]> {
  const res = await callSupabase("/rpc/reserve_mvp_pool_candidates", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      p_band: band,
      p_user_ref: userRef,
      p_limit: limit,
      p_lease_seconds: 300,
    }),
  });
  return (await res.json()) as ReservedRow[];
}

async function rpcCommitReveal(pid: number): Promise<void> {
  await callSupabase("/rpc/commit_mvp_pool_reveal", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ p_pid: pid }),
  });
}

async function rpcReleaseReservation(pid: number): Promise<void> {
  await callSupabase("/rpc/release_mvp_pool_reservation", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ p_pid: pid }),
  });
}

function freshnessMsForBand(band: PackBand) {
  if (band === 3) return 0;
  if (band === 2) return 5 * 60 * 1000;
  return 15 * 60 * 1000;
}

async function rpcInvalidate(pid: number, reason: string): Promise<void> {
  await callSupabase("/rpc/invalidate_mvp_pool_entry", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ p_pid: pid, p_reason: reason.slice(0, 120) }),
  });
}

async function fetchListings(pids: number[]): Promise<Map<number, ListingMeta>> {
  if (pids.length === 0) return new Map();
  const cols = "pid,name,url,price,sku_name,thumbnail_url";
  const res = await callSupabase(
    `/mvp_listings?select=${cols}&pid=in.(${pids.join(",")})`,
    { headers: authHeaders() },
  );
  const rows = (await res.json()) as ListingMeta[];
  return new Map(rows.map((r) => [Number(r.pid), r]));
}

async function patchPoolVerified(pid: number): Promise<void> {
  const nowIso = new Date().toISOString();
  await callSupabase(`/mvp_candidate_pool?pid=eq.${pid}`, {
    method: "PATCH",
    headers: authHeaders("return=minimal"),
    body: JSON.stringify({ last_verified_at: nowIso, updated_at: nowIso }),
  });
}

async function insertPackOpen(input: {
  userRef: string;
  band: PackBand;
  tokensSpent: number;
  tokensRefunded: number;
  result: "success" | "refunded" | "failed";
  attemptedPids: number[];
  revealedPids: number[];
  durationMs: number;
}): Promise<number> {
  const res = await callSupabase("/mvp_pack_opens", {
    method: "POST",
    headers: authHeaders("return=representation"),
    body: JSON.stringify({
      user_ref: input.userRef,
      band_requested: input.band,
      tokens_spent: input.tokensSpent,
      tokens_refunded: input.tokensRefunded,
      result: input.result,
      attempted_pids: input.attemptedPids,
      revealed_pids: input.revealedPids,
      duration_ms: input.durationMs,
    }),
  });
  const rows = (await res.json()) as { id: number }[];
  return rows[0]?.id ?? 0;
}

async function insertReveals(
  packOpenId: number,
  cards: RevealCard[],
  userRef: string,
): Promise<void> {
  if (cards.length === 0) return;
  await callSupabase("/mvp_pack_reveals", {
    method: "POST",
    headers: authHeaders("return=minimal"),
    body: JSON.stringify(
      cards.map((card) => ({
        pack_open_id: packOpenId,
        pid: card.pid,
        user_ref: userRef,
        expected_profit_min: card.expectedProfitMin,
        expected_profit_max: card.expectedProfitMax,
        confidence: card.confidence,
      })),
    ),
  });
}

export async function markRevealClicked(input: { userRef: string; pid: number }): Promise<void> {
  await callSupabase(
    `/mvp_pack_reveals?user_ref=eq.${encodeURIComponent(input.userRef)}&pid=eq.${input.pid}`,
    {
      method: "PATCH",
      headers: authHeaders("return=minimal"),
      body: JSON.stringify({ link_clicked_at: new Date().toISOString() }),
    },
  );
}

async function verifyAndCheckSold(pid: number, currentPrice: number | null) {
  const detail = await fetchDetail(String(pid));
  const signals = detectSoldOut(detail, currentPrice);
  return { detail, signals };
}

export async function openPack(input: PackOpenInput): Promise<PackOpenResult> {
  const startedAt = Date.now();
  const targetCards = Math.max(1, Math.min(input.requestedCards ?? 2, 4));
  const reserveLimit = Math.max(targetCards * 8, 12);
  const freshnessMs = freshnessMsForBand(input.band);

  const reserved = await rpcReservePool(input.band, input.userRef, reserveLimit);
  if (reserved.length === 0) {
    return {
      result: "unavailable",
      reason: "현재 이 등급의 후보가 부족해요. 잠시 뒤 다시 시도해주세요.",
      durationMs: Date.now() - startedAt,
    };
  }

  const listingMap = await fetchListings(reserved.map((r) => r.pid));
  const reveals: RevealCard[] = [];
  const attemptedPids: number[] = [];
  const releasePids: number[] = [];

  for (const candidate of reserved) {
    if (reveals.length >= targetCards) {
      releasePids.push(candidate.pid);
      continue;
    }
    attemptedPids.push(candidate.pid);
    const meta = listingMap.get(candidate.pid);
    if (!meta) {
      await rpcInvalidate(candidate.pid, "missing_listing_meta");
      continue;
    }

    const lastVerified = new Date(candidate.last_verified_at).getTime();
    const isFresh = Number.isFinite(lastVerified) && Date.now() - lastVerified < freshnessMs;

    let liveVerifiedAt = candidate.last_verified_at;
    if (!isFresh) {
      const { signals } = await verifyAndCheckSold(candidate.pid, meta.price);
      if (isSoldOut(signals)) {
        await rpcInvalidate(candidate.pid, describeSignals(signals));
        continue;
      }
      await patchPoolVerified(candidate.pid);
      liveVerifiedAt = new Date().toISOString();
    }

    const verifiedAtMs = new Date(liveVerifiedAt).getTime();
    const freshSeconds = Math.max(0, Math.floor((Date.now() - verifiedAtMs) / 1000));

    reveals.push({
      pid: candidate.pid,
      name: meta.name,
      url: meta.url,
      price: meta.price,
      skuName: meta.sku_name,
      thumbnailUrl: meta.thumbnail_url,
      expectedProfitMin: candidate.expected_profit_min,
      expectedProfitMax: candidate.expected_profit_max,
      confidence: candidate.confidence,
      lastVerifiedAt: liveVerifiedAt,
      freshSeconds,
    });
  }

  for (const pid of releasePids) {
    await rpcReleaseReservation(pid).catch(() => undefined);
  }

  if (reveals.length < targetCards) {
    for (const reveal of reveals) {
      await rpcReleaseReservation(reveal.pid).catch(() => undefined);
    }
    const durationMs = Date.now() - startedAt;
    await insertPackOpen({
      userRef: input.userRef,
      band: input.band,
      tokensSpent: input.tokensSpent,
      tokensRefunded: input.tokensSpent,
      result: "refunded",
      attemptedPids,
      revealedPids: [],
      durationMs,
    }).catch(() => 0);
    return {
      result: "refunded",
      reason: "약속한 카드 수만큼 검증된 매물이 부족해 토큰을 돌려드렸어요.",
      attemptedCount: attemptedPids.length,
      tokensRefunded: input.tokensSpent,
      durationMs,
    };
  }

  const durationMs = Date.now() - startedAt;
  const packOpenId = await insertPackOpen({
    userRef: input.userRef,
    band: input.band,
    tokensSpent: input.tokensSpent,
    tokensRefunded: 0,
    result: "success",
    attemptedPids,
    revealedPids: reveals.map((r) => r.pid),
    durationMs,
  });

  await insertReveals(packOpenId, reveals, input.userRef);
  for (const reveal of reveals) {
    await rpcCommitReveal(reveal.pid).catch(() => undefined);
  }

  return {
    result: "success",
    packOpenId,
    reveals,
    attemptedCount: attemptedPids.length,
    durationMs,
  };
}

export type InventorySnapshot = {
  band: PackBand;
  ready: number;
  reserved: number;
  spent: number;
  invalidated: number;
  freshUnder2h: number;
};

export async function loadInventory(): Promise<InventorySnapshot[]> {
  const cols = "profit_band,status,last_verified_at";
  const res = await callSupabase(`/mvp_candidate_pool?select=${cols}`, { headers: authHeaders() });
  const rows = (await res.json()) as { profit_band: number; status: string; last_verified_at: string }[];
  const buckets = new Map<PackBand, InventorySnapshot>();
  for (const band of [1, 2, 3] as PackBand[]) {
    buckets.set(band, {
      band,
      ready: 0,
      reserved: 0,
      spent: 0,
      invalidated: 0,
      freshUnder2h: 0,
    });
  }
  const now = Date.now();
  for (const row of rows) {
    const band = (row.profit_band as PackBand) ?? null;
    if (!band || !buckets.has(band)) continue;
    const bucket = buckets.get(band)!;
    if (row.status === "ready") bucket.ready += 1;
    else if (row.status === "reserved") bucket.reserved += 1;
    else if (row.status === "spent") bucket.spent += 1;
    else if (row.status === "invalidated") bucket.invalidated += 1;
    if (row.status === "ready") {
      const verified = new Date(row.last_verified_at).getTime();
      if (Number.isFinite(verified) && now - verified < freshnessMsForBand(band)) {
        bucket.freshUnder2h += 1;
      }
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.band - b.band);
}
