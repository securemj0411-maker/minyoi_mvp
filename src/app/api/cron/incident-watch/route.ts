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
import { reportCriticalIncident } from "@/lib/operational-notifier";
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

export async function POST(req: NextRequest) {
  return GET(req);
}

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.authOk) {
    return NextResponse.json({ error: "unauthorized", reason: auth.authReason }, { status: 401 });
  }

  const results = await Promise.allSettled([
    checkMarketHistoricalRows(),
    checkDailyBackup(),
    checkPoolReady(),
    checkReviewSla(),
  ]);

  const checks = [
    { name: "market_historical_rows", severity: "critical", res: results[0] },
    { name: "daily_backup_exists",    severity: "critical", res: results[1] },
    { name: "pool_ready_count",       severity: "warning",  res: results[2] },
    { name: "review_sla_24h",         severity: "warning",  res: results[3] },
  ] as const;

  const summary = checks.map(({ name, severity, res }) => {
    if (res.status === "rejected") {
      return { name, severity, ok: false, detail: `check_failed: ${res.reason}`, context: null };
    }
    const v = res.value;
    return { name, severity, ok: v.ok, detail: v.detail, context: v.context ?? null };
  });

  const incidents = summary.filter((s) => !s.ok);
  const okKeys = new Set(summary.filter((s) => s.ok).map((s) => s.name));

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
