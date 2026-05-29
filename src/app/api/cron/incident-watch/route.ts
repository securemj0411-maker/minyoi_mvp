// Wave 192 (2026-05-17): 자동 사고 감지 cron — 텔레그램 운영자 알림 박음.
// `reportCriticalIncident()` (operational-notifier.ts) 기존 인프라 활용 — TELEGRAM_BOT_TOKEN + TELEGRAM_ALERT_CHAT_ID.
//
// 검사 4개 (severity 순):
// 1. 🚨 critical: 시세 historical row 급감 (어제 row < 평균 × 0.5)
// 2. 🚨 critical: 일일 백업 실패 (어제 backup 폴더 row=0)
// 3. ⚠️ warning: 풀 ready 매물 < 100 (사용자 영향)
// 4. ⚠️ warning: inaccurate_report pending > 24h (운영자 SOP 위반)
//
// 스케줄: 매일 새벽 KST 06:00 (UTC 21:00) — daily-backup 후 2시간.

import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { mergeConditionDisplayChips } from "@/lib/condition-display";
import { cronProjectRoleSkip } from "@/lib/cron-guard";
import { normalizeMarketplaceSource } from "@/lib/marketplace-source";
import { reportCriticalIncident } from "@/lib/operational-notifier";
import {
  conditionResaleAdjustmentKrw,
  resellShippingFeeForSource,
  safetyBufferForSource,
  sellingFeeForMarketPrice,
} from "@/lib/profit";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

// Wave 193 (2026-05-17): dedup — 같은 사고 24h 안 한 번만 알림 + 회복 시 1회 알림.
const DEDUP_WINDOW_HOURS = 24;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "mvp-backups";
// 시세 row 어제 vs 평균 (7일) — 50% 미만이면 critical.
const MARKET_ROW_THRESHOLD_RATIO = 0.5;
// 풀 ready 매물 임계.
const POOL_READY_THRESHOLD = 100;
// 검수 응답 SLA — 24h.
const REVIEW_SLA_HOURS = 24;
const CONDITION_HAIRCUT_POOL_AUDIT_LIMIT = 5000;

type IncidentCheckResult = {
  ok: boolean;
  detail: string;
  context?: Record<string, unknown>;
};

type PoolAuditRow = {
  pid: number;
  category: string | null;
  condition_class: string | null;
  expected_profit_max: number | null;
};

type ListingAuditRow = {
  pid: number;
  name: string | null;
  price: number | null;
  sku_median: number | null;
  shipping_fee: number | null;
  shipping_fee_general: number | null;
  estimated_buy_cost: number | null;
};

type RawAuditRow = {
  pid: number;
  source: string | null;
  seller_source: string | null;
};

type ParsedAuditRow = {
  pid: number;
  condition_class: string | null;
  condition_tier: string | null;
  condition_notes: string[] | null;
  parsed_json: Record<string, unknown> | null;
};

function yesterdayDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function eightDaysAgo(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 8);
  return d.toISOString().slice(0, 10);
}

async function checkMarketHistoricalRows(): Promise<{ ok: boolean; detail: string; context?: Record<string, unknown> }> {
  // 1. 어제 row 수
  const yesterday = yesterdayDate();
  const res1 = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=date&date=eq.${yesterday}&limit=1`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
  );
  const yesterdayCount = Number((res1.headers.get("content-range") ?? "0-0/0").split("/")[1] ?? 0);

  // 2. 8일 전 ~ 2일 전 (7일 평균) row 수
  const since = eightDaysAgo();
  const res2 = await restFetch(
    `${tableUrl("mvp_market_price_daily")}?select=date&date=gte.${since}&date=lt.${yesterday}&limit=1`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
  );
  const weekTotalCount = Number((res2.headers.get("content-range") ?? "0-0/0").split("/")[1] ?? 0);
  const weekAvg = weekTotalCount / 7;

  if (weekAvg <= 0) {
    return { ok: true, detail: "no_baseline" };
  }
  const ratio = yesterdayCount / weekAvg;
  if (ratio < MARKET_ROW_THRESHOLD_RATIO) {
    return {
      ok: false,
      detail: `시세 historical row 급감 — 어제 ${yesterdayCount} / 7일 평균 ${Math.round(weekAvg)} (${Math.round(ratio * 100)}%)`,
      context: { yesterdayCount, weekAvg: Math.round(weekAvg), ratio: ratio.toFixed(2), threshold: MARKET_ROW_THRESHOLD_RATIO },
    };
  }
  return { ok: true, detail: `시세 historical 정상 — 어제 ${yesterdayCount} (평균 대비 ${Math.round(ratio * 100)}%)` };
}

async function checkDailyBackup(): Promise<{ ok: boolean; detail: string; context?: Record<string, unknown> }> {
  const yesterday = yesterdayDate();
  const url = `${process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/list/${BUCKET}`.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { ok: false, detail: "SUPABASE_SERVICE_ROLE_KEY missing" };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefix: yesterday, limit: 10 }),
  });
  if (!res.ok) {
    return { ok: false, detail: `backup_list_failed_${res.status}`, context: { yesterday } };
  }
  const objects = (await res.json()) as Array<{ name: string }>;
  if (objects.length === 0) {
    return {
      ok: false,
      detail: `일일 백업 실패 — ${yesterday} 폴더에 파일 없음`,
      context: { yesterday, expected_files: 7 },
    };
  }
  return { ok: true, detail: `백업 정상 — ${yesterday}: ${objects.length} files` };
}

async function checkPoolReady(): Promise<{ ok: boolean; detail: string; context?: Record<string, unknown> }> {
  const res = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid&status=eq.ready&limit=1`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
  );
  const count = Number((res.headers.get("content-range") ?? "0-0/0").split("/")[1] ?? 0);
  if (count < POOL_READY_THRESHOLD) {
    return {
      ok: false,
      detail: `풀 ready 매물 부족 — 현재 ${count} / 임계 ${POOL_READY_THRESHOLD}`,
      context: { count, threshold: POOL_READY_THRESHOLD },
    };
  }
  return { ok: true, detail: `풀 정상 — ready ${count}건` };
}

async function checkReviewSla(): Promise<{ ok: boolean; detail: string; context?: Record<string, unknown> }> {
  const slaCutoff = new Date(Date.now() - REVIEW_SLA_HOURS * 3600 * 1000).toISOString();
  const res = await restFetch(
    `${tableUrl("mvp_reveal_feedback")}?select=id&feedback_type=eq.inaccurate_report&admin_status=is.null&created_at=lt.${encodeURIComponent(slaCutoff)}&limit=1`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
  );
  const count = Number((res.headers.get("content-range") ?? "0-0/0").split("/")[1] ?? 0);
  if (count > 0) {
    return {
      ok: false,
      detail: `검수 응답 SLA 위반 — ${count}건이 24h 초과 pending`,
      context: { overdueCount: count, slaHours: REVIEW_SLA_HOURS },
    };
  }
  return { ok: true, detail: "검수 SLA 정상 (24h 초과 pending 없음)" };
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function inList(values: Array<number | string>) {
  return `(${values.join(",")})`;
}

function positiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchAuditByPid<T>(table: string, select: string, pids: number[]) {
  const rows: T[] = [];
  for (const part of chunk([...new Set(pids)], 400)) {
    const res = await restFetch(
      `${tableUrl(table)}?select=${select}&pid=in.${inList(part)}&limit=${part.length}`,
      { headers: serviceHeaders() },
    );
    rows.push(...((await res.json()) as T[]));
  }
  return rows;
}

async function checkConditionHaircutStalePool(): Promise<IncidentCheckResult> {
  const poolRes = await restFetch(
    `${tableUrl("mvp_candidate_pool")}?select=pid,category,condition_class,expected_profit_max&status=in.(ready,reserved)&order=updated_at.desc&limit=${CONDITION_HAIRCUT_POOL_AUDIT_LIMIT}`,
    { headers: serviceHeaders() },
  );
  const poolRows = (await poolRes.json()) as PoolAuditRow[];
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  if (pids.length === 0) return { ok: true, detail: "condition haircut audit: pool empty" };

  const [listings, raws, parsedRows] = await Promise.all([
    fetchAuditByPid<ListingAuditRow>(
      "mvp_listings",
      "pid,name,price,sku_median,shipping_fee,shipping_fee_general,estimated_buy_cost",
      pids,
    ),
    fetchAuditByPid<RawAuditRow>("mvp_raw_listings", "pid,source,seller_source", pids),
    fetchAuditByPid<ParsedAuditRow>("mvp_listing_parsed", "pid,condition_class,condition_tier,condition_notes,parsed_json", pids),
  ]);

  const listingByPid = new Map(listings.map((row) => [Number(row.pid), row]));
  const rawByPid = new Map(raws.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  let affectedRows = 0;
  let dropToZeroRows = 0;
  let staleProfitRows = 0;
  let totalPoolProfitOverstatement = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const pool of poolRows) {
    const pid = Number(pool.pid);
    const listing = listingByPid.get(pid);
    const raw = rawByPid.get(pid);
    const parsed = parsedByPid.get(pid);
    const marketPrice = positiveNumber(listing?.sku_median);
    const buyPrice = positiveNumber(listing?.price);
    if (marketPrice == null || buyPrice == null) continue;

    const grade = (parsed?.parsed_json?.condition_grade as { chips?: string[]; tier?: string } | null) ?? null;
    const parsedJsonNotes = parsed?.parsed_json?.condition_notes as string[] | undefined;
    const conditionChips = mergeConditionDisplayChips(
      grade?.chips ?? null,
      parsed?.condition_notes ?? parsedJsonNotes ?? null,
    ) ?? [];
    const conditionAdjustment = conditionResaleAdjustmentKrw({
      marketPrice,
      conditionChips,
      conditionClass: pool.condition_class ?? parsed?.condition_class ?? null,
      conditionTier: parsed?.condition_tier ?? grade?.tier ?? null,
    });
    if (conditionAdjustment <= 0) continue;

    affectedRows += 1;
    const source = normalizeMarketplaceSource(raw?.source ?? raw?.seller_source ?? null);
    const shippingFee = Number(listing?.shipping_fee ?? 0);
    const generalShipping = listing?.shipping_fee_general == null ? shippingFee : Number(listing.shipping_fee_general ?? 0);
    const buyMin = positiveNumber(listing?.estimated_buy_cost) ?? buyPrice + shippingFee;
    const buyMax = buyPrice + Math.max(0, generalShipping);
    const adjustedMarketPrice = Math.max(0, marketPrice - conditionAdjustment);
    const sellFee = sellingFeeForMarketPrice(adjustedMarketPrice, source);
    const resellShipping = resellShippingFeeForSource(source);
    const safetyBuffer = safetyBufferForSource(source);
    const newProfitMax = Math.max(0, Math.round(adjustedMarketPrice - buyMin - sellFee - resellShipping - safetyBuffer));
    const newProfitMin = Math.max(0, Math.round(adjustedMarketPrice - buyMax - sellFee - resellShipping - safetyBuffer));
    const poolProfitMax = Number(pool.expected_profit_max ?? 0);
    const overstatement = Math.max(0, poolProfitMax - newProfitMax);

    if (poolProfitMax > 0 && newProfitMax <= 0) dropToZeroRows += 1;
    if (newProfitMax > 0 && overstatement > 0) {
      staleProfitRows += 1;
      totalPoolProfitOverstatement += overstatement;
    }
    if ((overstatement > 0 || (poolProfitMax > 0 && newProfitMax <= 0)) && samples.length < 8) {
      samples.push({
        pid,
        source,
        category: pool.category,
        title: String(listing?.name ?? "").slice(0, 80),
        poolProfitMax,
        newProfitMin,
        newProfitMax,
        overstatement,
        conditionAdjustment,
      });
    }
  }

  if (dropToZeroRows > 0 || staleProfitRows > 0) {
    return {
      ok: false,
      detail: `상태 보정 stale pool — 수익 0 전환 ${dropToZeroRows}건, 수익 과대표시 ${staleProfitRows}건`,
      context: {
        auditedPoolRows: poolRows.length,
        affectedRows,
        dropToZeroRows,
        staleProfitRows,
        totalPoolProfitOverstatement,
        samples,
      },
    };
  }

  return {
    ok: true,
    detail: `상태 보정 pool 정상 — 영향 ${affectedRows}건, stale 0건`,
    context: { auditedPoolRows: poolRows.length, affectedRows },
  };
}

export async function POST(req: NextRequest) {
  return GET(req);
}

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.authOk) {
    return NextResponse.json({ error: "unauthorized", reason: auth.authReason }, { status: 401 });
  }
  const roleSkip = cronProjectRoleSkip("incident_watch");
  if (roleSkip) return NextResponse.json(roleSkip);

  const results = await Promise.allSettled([
    checkMarketHistoricalRows(),
    checkDailyBackup(),
    checkPoolReady(),
    checkReviewSla(),
    checkConditionHaircutStalePool(),
  ]);

  const checks = [
    { name: "market_historical_rows", severity: "critical", res: results[0] },
    { name: "daily_backup_exists",    severity: "critical", res: results[1] },
    { name: "pool_ready_count",       severity: "warning",  res: results[2] },
    { name: "review_sla_24h",         severity: "warning",  res: results[3] },
    { name: "condition_haircut_stale_pool", severity: "warning", res: results[4] },
  ] as const;

  const summary = checks.map(({ name, severity, res }) => {
    if (res.status === "rejected") {
      return { name, severity, ok: false, detail: `check_failed: ${res.reason}`, context: null };
    }
    const v = res.value;
    return { name, severity, ok: v.ok, detail: v.detail, context: v.context ?? null };
  });

  const incidents = summary.filter((s) => !s.ok);
  // Wave 185 build fix (2026-05-17): Set<string> 명시 — log.incident_key 가 일반 string 이므로 narrow union 충돌 회피.
  const okKeys = new Set<string>(summary.filter((s) => s.ok).map((s) => s.name));

  // Wave 193: dedup — incident_log fetch + 24h 안 알림이면 skip + 회복 detect.
  const dedupWindowMs = DEDUP_WINDOW_HOURS * 3600 * 1000;
  const now = Date.now();
  const logRes = await restFetch(
    `${tableUrl("mvp_incident_log")}?select=incident_key,last_alert_at,resolved_at`,
    { headers: serviceHeaders() },
  );
  const logRows = (await logRes.json()) as Array<{ incident_key: string; last_alert_at: string; resolved_at: string | null }>;
  const logMap = new Map(logRows.map((r) => [r.incident_key, r]));

  // 새 알림 보낼 incident (24h 안 알림 안 박혔거나, 이전에 resolved 된 후 다시 발생).
  const incidentsToAlert = incidents.filter((i) => {
    const log = logMap.get(i.name);
    if (!log) return true;                                       // 첫 발생
    if (log.resolved_at) return true;                            // 회복 후 재발생
    const lastAlertMs = new Date(log.last_alert_at).getTime();
    return Number.isFinite(lastAlertMs) && (now - lastAlertMs) >= dedupWindowMs;
  });

  // 회복된 incident (이전에 active 였는데 이번에 ok). 회복 알림 1회 + resolved_at 박음.
  const recovered = logRows.filter((log) => log.resolved_at == null && okKeys.has(log.incident_key));

  let notifyResult = null;
  let recoveredNotify: unknown = null;

  // 1. 새 알림
  if (incidentsToAlert.length > 0) {
    const summaryLine = incidentsToAlert
      .map((i) => `${i.severity === "critical" ? "🚨" : "⚠️"} ${i.detail}`)
      .join(" | ");
    const ctx: Record<string, unknown> = {};
    for (const i of incidentsToAlert) {
      if (i.context) ctx[i.name] = i.context;
    }
    notifyResult = await reportCriticalIncident({
      source: "incident-watch",
      summary: summaryLine,
      context: ctx,
    });

    // incident_log upsert (each incident).
    for (const i of incidentsToAlert) {
      const existing = logMap.get(i.name);
      const row = {
        incident_key: i.name,
        severity: i.severity,
        last_alert_at: new Date(now).toISOString(),
        last_detail: i.detail.slice(0, 500),
        last_context: i.context ?? null,
        // 회복 후 재발 시 resolved_at 초기화 + alert_count 누적.
        ...(existing ? { resolved_at: null, alert_count: 0 } : { first_alert_at: new Date(now).toISOString(), alert_count: 1 }),
        updated_at: new Date(now).toISOString(),
      };
      try {
        await restFetch(
          `${tableUrl("mvp_incident_log")}?on_conflict=incident_key`,
          {
            method: "POST",
            headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
            body: jsonBody(row),
          },
        );
      } catch (err) {
        console.error("[cron/incident-watch] log upsert failed", { incident: i.name, err });
      }
    }
    console.log("[cron/incident-watch] new alert sent", {
      total: incidents.length,
      sent: incidentsToAlert.length,
      skipped_dedup: incidents.length - incidentsToAlert.length,
    });
  } else if (incidents.length > 0) {
    console.log("[cron/incident-watch] all incidents within dedup window — skipped", { count: incidents.length });
  } else {
    console.log("[cron/incident-watch] all checks ok", { summary });
  }

  // 2. 회복 알림
  if (recovered.length > 0) {
    const summaryLine = recovered
      .map((r) => `✅ 회복 — ${r.incident_key}`)
      .join(" | ");
    recoveredNotify = await reportCriticalIncident({
      source: "incident-watch (회복)",
      summary: summaryLine,
      context: { recovered_keys: recovered.map((r) => r.incident_key) },
    });

    // resolved_at 박음.
    for (const r of recovered) {
      try {
        await restFetch(
          `${tableUrl("mvp_incident_log")}?incident_key=eq.${encodeURIComponent(r.incident_key)}`,
          {
            method: "PATCH",
            headers: { ...serviceHeaders(), Prefer: "return=minimal" },
            body: jsonBody({ resolved_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() }),
          },
        );
      } catch (err) {
        console.error("[cron/incident-watch] resolved update failed", { incident: r.incident_key, err });
      }
    }
  }

  return NextResponse.json({
    ok: incidents.length === 0,
    incidentCount: incidents.length,
    sentCount: incidentsToAlert.length,
    dedupSkipped: incidents.length - incidentsToAlert.length,
    recoveredCount: recovered.length,
    checks: summary,
    notify: notifyResult,
    recoveredNotify,
    checkedAt: new Date().toISOString(),
  });
}
