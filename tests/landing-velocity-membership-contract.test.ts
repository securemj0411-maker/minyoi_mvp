import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("guest landing preview is velocity-led and routes login to membership application", () => {
  const serverPreview = source("src/components/preview-masked-dashboard-server.tsx");
  const clientPreview = source("src/components/preview-masked-dashboard.tsx");

  for (const src of [serverPreview, clientPreview]) {
    assert.match(src, /평균 \$\{daysLabel\(item\.medianHoursToSold\)\} 내 판매/);
    assert.match(src, /빨리 사라지는 중고 매물|팔리는 속도까지 보고/);
    assert.match(src, /href="\/login\?next=\/plans"/);
    assert.doesNotMatch(src, /무료로 시작|첫 상세 1개는 무료/);
  }
});

test("preview pool only serves items with usable market velocity", () => {
  const route = source("src/app/api/preview-pool/route.ts");
  const cacheLib = source("src/lib/preview-pool-showcases.ts");
  const cronRoute = source("src/app/api/cron/preview-pool/route.ts");

  assert.match(route, /readPreviewPoolCache/);
  assert.match(route, /mvp_preview_showcases|precomputed DB materialized cache/);
  assert.match(route, /items\.length > 0/);
  assert.match(route, /no-store, max-age=0/);
  assert.doesNotMatch(route, /mvp_candidate_pool/);
  assert.doesNotMatch(route, /mvp_market_price_daily/);
  assert.doesNotMatch(route, /mvp_market_velocity_daily/);

  assert.match(cacheLib, /mvp_market_velocity_daily/);
  assert.match(cacheLib, /condition_class=eq\.all/);
  assert.match(cacheLib, /velocitySignalFromRow/);
  assert.match(cacheLib, /candidateRows = candidateRows\.filter\(\(row\) => row\.comparable_key \? velocityByKey\.has\(row\.comparable_key\) : false\)/);
  assert.match(cacheLib, /observedSoldSampleCount/);
  assert.match(cacheLib, /mvp_preview_showcases/);
  assert.match(cronRoute, /refreshPreviewPoolCache/);
});

test("public intro showcase cache has a scheduled refresh", () => {
  const vercel = JSON.parse(source("vercel.json")) as { crons?: Array<{ path?: string; schedule?: string }> };
  const landingCron = vercel.crons?.find((cron) => cron.path === "/api/cron/landing-showcases");

  assert.ok(landingCron, "landing showcase cache refresh must be registered in vercel.json");
  assert.match(landingCron.schedule ?? "", /\*/);
});

test("pool never performs request-time Daangn external live checks", () => {
  const route = source("src/app/api/packs/pool/route.ts");
  const migration = source("supabase/migrations/20260603221354_wave1051_daangn_feed_hotpath_indexes.sql");

  assert.doesNotMatch(route, /fetchDaangnLiveState/);
  assert.doesNotMatch(route, /from "@\/lib\/daangn"/);
  assert.doesNotMatch(route, /DAANGN_POOL_LIVE_VERIFY/);
  assert.match(route, /DAANGN_POOL_LIFECYCLE_FRESH_MS/);
  assert.match(route, /loadDaangnLifecycleFreshness/);
  assert.match(route, /filterDaangnByLifecycleFreshness/);
  assert.match(route, /mvp_collect_runs/);
  assert.match(route, /lifecycle-worker-b/);
  assert.match(route, /lifecycle-worker-c/);
  assert.match(route, /daangn lifecycle-stale block/);
  assert.match(route, /blockedPids = new Set\(targets\.map/);

  assert.match(migration, /mvp_raw_daangn_active_done_region_last_seen_idx/);
  assert.match(migration, /daangn_region_id, last_seen_at desc/);
  assert.match(migration, /listing_state = 'active'/);
  assert.match(migration, /detail_status = 'done'/);
});

test("plans page explains scarcity, local constraints, and quota management", () => {
  const plans = source("src/app/plans/page.tsx");
  const planConfig = source("src/lib/membership-plans.ts");

  assert.match(plans, /돈 되는 매물은 적고/);
  assert.match(plans, /당근은 내 근처/);
  assert.match(plans, /티오를 관리/);
  assert.match(plans, /지역별로 티오/);
  assert.match(plans, /아무나 보면 그마저도 사라집니다/);
  assert.match(plans, /선착순 현황/);
  assert.match(plans, /내 지역 티오/);
  assert.match(plans, /신청 후 즉시 조회/);
  assert.match(plans, /자리 예약 후 계좌이체/);
  assert.match(planConfig, /월 33,000원꼴/);
  assert.match(planConfig, /priceKrw: 99_000/);
  assert.match(plans, /송금 후 입금했어요 버튼을 눌러주세요/);
  assert.match(plans, /입금했어요 버튼/);
  assert.match(plans, /5분 내 승인 보장/);
  assert.doesNotMatch(plans, /카카오 로그인 후 기간을 선택합니다/);
  assert.doesNotMatch(plans, /2\. 지역 조회/);
  assert.doesNotMatch(plans, /결제 페이지가 아니라/);
  assert.doesNotMatch(plans, /베타|초기 베타/);
});
