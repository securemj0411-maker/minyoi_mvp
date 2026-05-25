import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("operator nav uses absolute admin paths and legacy short paths redirect safely", () => {
  const routes = source("src/lib/admin-routes.ts");
  const membersPage = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/page.tsx");
  const topBar = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/admin-top-bar.tsx");
  const membersTable = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/members-table.tsx");
  const detailEventsPage = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/detail-events/page.tsx");
  const revealAnalyticsPage = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/reveal-analytics/page.tsx");
  const revealAnalyticsClient = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/reveal-analytics/reveal-analytics-client.tsx");
  const revealAnalyticsApi = source("src/app/api/admin/reveal-analytics/route.ts");
  const legacyLossReports = source("src/app/loss-reports/page.tsx");
  const legacyFeedbackStats = source("src/app/feedback-stats/page.tsx");

  assert.match(routes, /OPS_ADMIN_BASE_PATH/);
  assert.match(routes, /OPS_ADMIN_LOSS_REPORTS_PATH/);
  assert.match(routes, /OPS_ADMIN_FEEDBACK_STATS_PATH/);
  assert.match(routes, /OPS_ADMIN_DETAIL_EVENTS_PATH/);
  assert.match(routes, /OPS_ADMIN_REVEAL_ANALYTICS_PATH/);
  assert.match(topBar, /OPS_ADMIN_LOSS_REPORTS_PATH/);
  assert.match(topBar, /OPS_ADMIN_FEEDBACK_STATS_PATH/);
  assert.match(topBar, /OPS_ADMIN_DETAIL_EVENTS_PATH/);
  assert.match(topBar, /OPS_ADMIN_REVEAL_ANALYTICS_PATH/);
  assert.match(topBar, /REVEAL STATS/);
  assert.match(membersTable, /OPS_ADMIN_REVEAL_ANALYTICS_PATH/);
  assert.match(membersTable, /userRef/);
  assert.match(detailEventsPage, /mvp_detail_events/);
  assert.match(revealAnalyticsPage, /RevealAnalyticsClient/);
  assert.match(revealAnalyticsClient, /api\/admin\/reveal-analytics/);
  assert.match(revealAnalyticsApi, /mvp_pack_reveals/);
  assert.match(revealAnalyticsApi, /mvp_detail_events/);
  assert.doesNotMatch(membersPage, /href="\.\/loss-reports"|href="\.\/feedback-stats"/);
  assert.match(legacyLossReports, /redirect\(OPS_ADMIN_LOSS_REPORTS_PATH\)/);
  assert.match(legacyFeedbackStats, /redirect\(OPS_ADMIN_FEEDBACK_STATS_PATH\)/);
  assert.match(legacyLossReports, /notFound\(\)/);
  assert.match(legacyFeedbackStats, /notFound\(\)/);
});
