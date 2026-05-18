import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("/me detail analysis uses the canonical parsed listing table", () => {
  const route = source("src/app/api/packs/reveals/detail/route.ts");
  assert.match(route, /tableUrl\("mvp_listing_parsed"\)/);
  assert.doesNotMatch(route, /mvp_parsed_listings/);
});

test("/me user modal does not expose the market source debug panel", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  assert.doesNotMatch(modal, /MarketSourceDebug/);
  assert.doesNotMatch(modal, /상세 비교/);
  assert.doesNotMatch(modal, /디버그/);
});

test("/me treats zero net profit as terminal for user-facing display", () => {
  const api = source("src/app/api/packs/me/route.ts");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(api, /market_invalidated:\s*min <= 0/);
  assert.match(api, /marketGapKrw <= 0/);
  assert.match(dashboard, /card\.expectedProfitMin <= 0/);
  assert.match(modal, /Math\.min\(card\.expectedProfitMin, card\.expectedProfitMax\) <= 0/);
});

test("/me user modal explains recommendation trust in plain language", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /왜 이걸 추천했나요\?/);
  assert.match(modal, /같은 모델로 묶었어요/);
  assert.match(modal, /기준 시세예요/);
  assert.match(modal, /비용을 빼고 계산했어요/);
  assert.match(modal, /좋은 점/);
  assert.match(modal, /확인할 점/);
  assert.match(modal, /셀러 후기/);
  assert.match(modal, /사용감은 같은 등급 시세에 반영/);
  assert.match(modal, /상태가 다른 매물을 섞어 시세를 부풀리지 않아요/);
  assert.doesNotMatch(modal, />\s*band \{card\.band\}/);
});

test("/me modal keeps market evidence compact before the graph on mobile", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /compactSourceLabel/);
  assert.match(modal, /표본 \{market\.sampleCount\.toLocaleString/);
  assert.match(modal, /신뢰 \{confidenceLabel\}/);
  assert.match(modal, /className=\"order-2 lg:order-3\"/);
  assert.match(modal, /className=\"order-3 .*lg:order-2/);
  assert.match(modal, /hidden sm:inline-flex/);
});

test("/me keeps dashboard summary compact on mobile", () => {
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(dashboard, /sm:hidden/);
  assert.match(dashboard, /판매중 \{dashboardSummary\.activeCount/);
  assert.match(dashboard, /평균 \{signedKrw\(dashboardSummary\.avgProfit\)\}/);
  assert.match(dashboard, /hidden gap-2 sm:grid/);
});

test("reveal feedback is scoped by feedback type so reports do not overwrite user state", () => {
  const migration = source("supabase/migrations/20260518101901_reveal_feedback_type_scoped.sql");
  const schema = source("supabase/schema.sql");
  const packOpen = source("src/lib/pack-open.ts");
  const inaccurateReport = source("src/app/api/packs/reveals/inaccurate-report/route.ts");
  const lossReport = source("src/app/api/packs/reveals/loss-report/route.ts");
  const meRoute = source("src/app/api/packs/me/route.ts");

  assert.match(migration, /drop constraint if exists mvp_reveal_feedback_user_ref_pid_key/);
  assert.match(migration, /unique \(user_ref, pid, feedback_type\)/);
  assert.doesNotMatch(migration, /approved/);
  assert.match(schema, /unique \(user_ref, pid, feedback_type\)/);
  assert.match(packOpen, /on_conflict=user_ref,pid,feedback_type/);
  assert.match(inaccurateReport, /on_conflict=user_ref,pid,feedback_type/);
  assert.match(lossReport, /on_conflict=user_ref,pid,feedback_type/);
  assert.match(meRoute, /FEEDBACK_DISPLAY_PRIORITY/);
  assert.match(meRoute, /pickDisplayFeedback/);
});
