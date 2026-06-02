// 2026-05-19 P0 fix: velocity 집계 cron 자동화.
//
// 배경: `scripts/sync-market-velocity.mjs`가 psql 의존이라 Vercel cron으로 못 돌림.
//   직전 실행 = 2026-05-11 (수동 npm script 1회). 그 뒤로 8일째 stale.
//   사용자가 보는 "팔리는 속도"는 대부분 폴백 거짓값으로 떨어지고 있었음.
//
// 해결: SQL 로직을 `public.sync_market_velocity_daily()` RPC 함수로 캡슐화 (migration).
//   이 route는 매일 새벽 RPC 1회만 호출. vercel.json crons에 등록.
//
// 운영 노트:
//   - 매일 1회 (UTC 19:00 = KST 04:00) 권장. 트래픽 최저 시간.
//   - 함수 결과 jsonb (upserted_rows, high/medium/low, sold_sample_total)는 응답 body로 반환,
//     vercel cron 로그에서 history 추적.

import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { cronProjectRoleSkip } from "@/lib/cron-guard";
import { logAndRespond } from "@/lib/error-response";
import { restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { startCollectRun, finishCollectRun, failCollectRun, type CollectRunRequestMeta } from "@/lib/collect-logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 함수 자체는 보통 수 초 ~ 수십 초. raw_listings 커지면 1분 근처 가능. pro 가정 90s.
// Wave 990 (2026-05-31): 90s → 180s. RPC statement_timeout 120s 박혔지만 90s route 가 먼저 kill.
//   12:15/18:15 UTC sync 둘 다 stale 3m fail. velocity_daily 7:43 UTC 이후 12시간 stop.
//   180s = RPC 120s + processing margin. trade-off 0.
// Wave 1003 (2026-06-01): 180s → 300s. velocity 27h 멈춤 발견 + category 단위 분할 도입.
//   각 category 별 RPC 호출 (statement_timeout 60s) → category 20+ 개 loop.
//   maxDuration 300s = vercel pro 한도. 한 cron 에서 가능한 만큼 처리, 나머지는 다음 cron.
export const maxDuration = 300;

// Wave 981 (2026-05-31): collect_runs 박음 + monitor. silent fail 차단.
//   배경: 어제 11:36 이후 velocity_daily 갱신 stop (사용자 짚음). route 가 collect_runs 안 박아서
//         silent fail 무방비. 이제 박음 → cron-watchdog/incident-watch 추적 가능.

// Wave 1003 (2026-06-01): category 단위 분할 처리.
//   각 cron 호출 시 mvp_listing_parsed 에서 distinct category 가져와서 loop.
//   각 category 호출 별도 try/catch — 한 category timeout 해도 나머지 진행.
//   route maxDuration 300s 안에서 가능한 만큼 처리. Wave 1024부터 tail category order를 6h slot별로 회전해
//   항상 앞쪽 category만 처리되는 starvation을 막는다.
//   결과적으로 24h 안 (sync cron 매 6h × 4번) 더 많은 category가 한 번 이상 갱신된다.
async function loadCategoryList(): Promise<string[]> {
  // mvp_listing_parsed.category 의 distinct 값. 빠른 query (인덱스 있을 시 ms 단위).
  // PostgREST 통해 호출 — distinct=true + select=category.
  try {
    const url = `${tableUrl("mvp_listing_parsed")}?select=category&category=not.is.null&limit=200000`;
    const res = await restFetch(url, { headers: { ...serviceHeaders(), Prefer: "count=none" } });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ category: string | null }>;
    const seen = new Set<string>();
    for (const row of rows) {
      const c = (row.category ?? "").trim();
      if (c) seen.add(c);
    }
    return [...seen];
  } catch {
    return [];
  }
}

// Fallback hardcoded list — distinct query 실패 시.
// 2026-06-01 측정 시점 분포: clothing 99k, shoe 83k, smartphone 35k, bag 21k, earphone 17k, tablet 14k,
//   sport_golf 12k, smartwatch 11k, game_console 9k, laptop 7k, watch 1.9k, drone 1.7k, lego 1.5k,
//   home_appliance 928, desktop 724, speaker 578, perfume 370, bike 281, camera 221, monitor 162.
// 큰 것부터 정렬 — 무거운 category 가 timeout 도달해도 한 번은 시도.
const FALLBACK_CATEGORY_ORDER = [
  "clothing", "shoe", "smartphone", "bag", "earphone", "tablet",
  "sport_golf", "smartwatch", "game_console", "laptop", "watch", "drone",
  "lego", "home_appliance", "desktop", "speaker", "perfume", "bike",
  "camera", "monitor",
];

const VELOCITY_ALWAYS_FIRST_CATEGORIES = [
  "clothing",
  "shoe",
  "smartphone",
  "bag",
  "earphone",
  "tablet",
];

function orderedVelocityCategories(categories: string[], now = new Date()): string[] {
  const seen = new Set<string>();
  const deduped = categories.filter((category) => {
    const key = category.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const categorySet = new Set(deduped);
  const priority = VELOCITY_ALWAYS_FIRST_CATEGORIES.filter((category) => categorySet.has(category));
  const rest = deduped.filter((category) => !priority.includes(category));
  if (rest.length === 0) return priority;
  // 300s 한도 때문에 한 run 에서 뒤쪽 category 가 반복적으로 굶지 않게 6h slot 단위로 tail 을 회전.
  const sixHourSlot = Math.floor(now.getTime() / (6 * 60 * 60 * 1000));
  const offset = sixHourSlot % rest.length;
  const rotatedRest = [...rest.slice(offset), ...rest.slice(0, offset)];
  return [...priority, ...rotatedRest];
}

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.authOk) {
    return NextResponse.json(
      { ok: false, reason: auth.authReason },
      { status: 401 },
    );
  }
  const roleSkip = cronProjectRoleSkip("sync_market_velocity");
  if (roleSkip) return NextResponse.json(roleSkip);

  const meta: CollectRunRequestMeta = {
    triggerSource: (req.headers.get("x-qstash-schedule-id") ?? req.headers.get("user-agent") ?? "sync-market-velocity").slice(0, 120),
    requestMethod: req.method,
    requestPath: `${req.nextUrl.pathname}${req.nextUrl.search}`,
    requestHost: req.headers.get("host"),
    requestIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    requestUserAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    requestReferer: req.headers.get("referer")?.slice(0, 500) ?? null,
    requestOrigin: req.headers.get("origin")?.slice(0, 500) ?? null,
    requestVercelId: req.headers.get("x-vercel-id"),
    requestCountry: req.headers.get("x-vercel-ip-country"),
    waitMode: true,
    authOk: auth.authOk,
    authReason: auth.authReason,
    responseMode: "sync_wait",
    requestMeta: { pipelineMode: "sync_market_velocity" },
  };

  const run = await startCollectRun(meta);
  if (!run.id) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable_before_pipeline", ts: run.startedAt }, { status: 503 });
  }

  const startedAt = new Date();
  // route maxDuration 300s, 안전 마진 30s. 290s 이상 도달하면 더 이상 category 호출 안 함.
  const routeDeadlineMs = startedAt.getTime() + 270_000;
  try {
    const dbCategories = await loadCategoryList();
    const categories = dbCategories.length > 0
      ? orderedVelocityCategories([...FALLBACK_CATEGORY_ORDER, ...dbCategories])
      : orderedVelocityCategories(FALLBACK_CATEGORY_ORDER);
    const perCategory: Array<{ category: string; ok: boolean; durationMs: number; upserted?: number; error?: string }> = [];
    let totalUpserted = 0;
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    for (const category of categories) {
      if (Date.now() >= routeDeadlineMs) {
        skipped += 1;
        perCategory.push({ category, ok: false, durationMs: 0, error: "skipped_route_deadline" });
        continue;
      }
      const tStart = Date.now();
      try {
        const res = await fetch(rpcUrl("sync_market_velocity_daily_for_category"), {
          method: "POST",
          headers: serviceHeaders(),
          body: JSON.stringify({ p_category: category }),
        });
        const bodyText = await res.text();
        const durationMs = Date.now() - tStart;
        if (!res.ok) {
          failed += 1;
          perCategory.push({ category, ok: false, durationMs, error: `${res.status}: ${bodyText.slice(0, 200)}` });
          continue;
        }
        let upsertedRows = 0;
        try {
          const parsed = JSON.parse(bodyText);
          upsertedRows = Number(parsed?.upserted_rows ?? 0);
        } catch {
          // bodyText 가 JSON 이 아니어도 OK 응답이면 정상으로 계산
        }
        totalUpserted += upsertedRows;
        processed += 1;
        perCategory.push({ category, ok: true, durationMs, upserted: upsertedRows });
      } catch (catErr) {
        failed += 1;
        const durationMs = Date.now() - tStart;
        perCategory.push({ category, ok: false, durationMs, error: catErr instanceof Error ? catErr.message : String(catErr) });
      }
    }

    await finishCollectRun(run.id, run.startedAt, {
      collected: 0, titleNormal: 0, enriched: 0, scored: 0,
      aiReviewRequested: 0, aiCacheHits: 0, aiApiCalls: 0,
      aiUnavailable: 0, aiFiltered: 0, aiKeptNormal: 0, aiKeptLowConfidence: 0,
      normal: 0, upserted: totalUpserted,
    }, {
      stages: {
        sync_market_velocity: {
          total_categories: categories.length,
          processed,
          failed,
          skipped,
          per_category: perCategory,
        },
      },
    });
    return NextResponse.json({
      ok: true,
      runId: run.id,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      totalCategories: categories.length,
      processed,
      failed,
      skipped,
      totalUpserted,
      perCategory,
    });
  } catch (err) {
    await failCollectRun(run.id, run.startedAt, err);
    return logAndRespond("cron/sync-market-velocity", err, "cron_sync_market_velocity_failed", {
      context: { startedAt: startedAt.toISOString(), runId: run.id },
    });
  }
}
