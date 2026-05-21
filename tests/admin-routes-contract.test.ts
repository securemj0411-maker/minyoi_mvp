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
  const lossReportsPage = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/loss-reports/page.tsx");
  const feedbackStatsPage = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/feedback-stats/page.tsx");
  const detailEventsPage = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/detail-events/page.tsx");
  const legacyLossReports = source("src/app/loss-reports/page.tsx");
  const legacyFeedbackStats = source("src/app/feedback-stats/page.tsx");

  assert.match(routes, /OPS_ADMIN_BASE_PATH/);
  assert.match(routes, /OPS_ADMIN_LOSS_REPORTS_PATH/);
  assert.match(routes, /OPS_ADMIN_FEEDBACK_STATS_PATH/);
  assert.match(routes, /OPS_ADMIN_DETAIL_EVENTS_PATH/);
  assert.match(membersPage, /href=\{OPS_ADMIN_LOSS_REPORTS_PATH\}/);
  assert.match(membersPage, /href=\{OPS_ADMIN_FEEDBACK_STATS_PATH\}/);
  assert.match(membersPage, /href=\{OPS_ADMIN_DETAIL_EVENTS_PATH\}/);
  assert.match(lossReportsPage, /href=\{OPS_ADMIN_BASE_PATH\}/);
  assert.match(lossReportsPage, /href=\{OPS_ADMIN_FEEDBACK_STATS_PATH\}/);
  assert.match(lossReportsPage, /href=\{OPS_ADMIN_DETAIL_EVENTS_PATH\}/);
  assert.match(feedbackStatsPage, /href=\{OPS_ADMIN_BASE_PATH\}/);
  assert.match(feedbackStatsPage, /href=\{OPS_ADMIN_LOSS_REPORTS_PATH\}/);
  assert.match(feedbackStatsPage, /href=\{OPS_ADMIN_DETAIL_EVENTS_PATH\}/);
  assert.match(detailEventsPage, /mvp_detail_events/);
  assert.match(detailEventsPage, /href=\{OPS_ADMIN_BASE_PATH\}/);
  assert.match(detailEventsPage, /href=\{OPS_ADMIN_LOSS_REPORTS_PATH\}/);
  assert.match(detailEventsPage, /href=\{OPS_ADMIN_FEEDBACK_STATS_PATH\}/);
  assert.doesNotMatch(membersPage, /href="\.\/loss-reports"|href="\.\/feedback-stats"/);
  assert.match(legacyLossReports, /redirect\(OPS_ADMIN_LOSS_REPORTS_PATH\)/);
  assert.match(legacyFeedbackStats, /redirect\(OPS_ADMIN_FEEDBACK_STATS_PATH\)/);
  assert.match(legacyLossReports, /notFound\(\)/);
  assert.match(legacyFeedbackStats, /notFound\(\)/);
});
