import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("ExploreClient loads the broad feed immediately without a preference gate", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /FIRST_FEED_ONBOARDING_STORAGE_KEY/);
  assert.match(explore, /scopedStorageKey/);
  assert.match(explore, /storageScope/);
  assert.match(explore, /FEED_BUDGET_FILTER_STORAGE_KEY, storageScope/);
  assert.match(explore, /updateBudgetFilter/);
  assert.match(explore, /writeBudgetFilterOption\(storageScope, value\)/);
  assert.match(explore, /\/api\/public\/safety-stats/);
  assert.match(explore, /SAFETY_STATS_FETCH_TIMEOUT_MS = 3500/);
  assert.match(explore, /controller\.abort\(\)/);
  assert.match(explore, /showFirstFeedIntro = true/);
  assert.match(explore, /if \(!showFirstFeedIntro\) \{/);
  assert.match(explore, /showFirstFeedIntro && showFirstFeedOnboarding && !scrapOnly/);
  assert.match(explore, /statsLoaded && !stats/);
  assert.doesNotMatch(explore, /\/api\/public\/safety-stats", \{ cache: "no-store" \}/);
  assert.doesNotMatch(explore, /잠시 후 갱신/);
  assert.match(explore, /fixed inset-0 z-\[90\]/);
  assert.match(explore, /오늘 볼 만한/);
  assert.match(explore, /function budgetApiParam/);
  assert.match(explore, /params\.set\("budget", budgetParam\)/);
  assert.match(explore, /return budgetFiltered/);
  assert.match(explore, /15만원 이하/);
  assert.match(explore, /30만원 이하/);
  assert.match(explore, /50만원 이하/);
  assert.match(explore, /pendingBudget/);
  assert.match(explore, /setPendingBudget\(option\.value\)/);
  assert.match(explore, /onSelectBudget\(pendingBudget\)/);
  assert.match(explore, /확인하고 보기/);
  assert.match(explore, /data-budget-filter-select/);
  assert.match(explore, /void loadStats\(\);/);
  assert.match(explore, /void loadPool\(false\);/);
  assert.doesNotMatch(explore, /onClick=\{\(\) => onSelectBudget\(option\.value\)\}/);
  assert.doesNotMatch(explore, /writeBudgetFilterOption\(storageScope, budgetFilter\)/);
  assert.doesNotMatch(explore, /prefsInitialized|awaitingInitialPrefs|loadPreferences|savePreferences/);
  assert.doesNotMatch(explore, /params\.set\("preference"/);
});

test("Refresh modal does not show budget and preference summary controls", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /필터 없이 더 넓게 골라드려요/);
  assert.doesNotMatch(explore, /제한 없음/);
  assert.doesNotMatch(explore, /매물 성향/);
  assert.doesNotMatch(explore, /내 매물 취향 알려주세요/);
  assert.doesNotMatch(explore, /수정하고 새 30개 받기/);
});

test("MeDashboard scopes feed onboarding storage to the signed-in user", () => {
  const dashboard = source("src/components/me-dashboard-client.tsx");

  assert.match(dashboard, /<ExploreClient storageScope=\{user\.id\} showFirstFeedIntro=\{!effectiveAdmin\} \/>/);
});

test("MeDashboard removes the unused work menu while keeping direct hotdeal view code", () => {
  const dashboard = source("src/components/me-dashboard-client.tsx");

  assert.doesNotMatch(dashboard, /작업 메뉴|My Dashboard|me_sidebar_collapsed|sidebarCollapsed|toggleSidebar/);
  assert.doesNotMatch(dashboard, /\/api\/me\/subscription/);
  assert.doesNotMatch(dashboard, /lg:grid-cols-\[220px_minmax\(0,1fr\)\]|lg:grid-cols-\[44px_minmax\(0,1fr\)\]/);
  assert.match(dashboard, /type DashboardView = "recommend" \| "history" \| "guides" \| "hotdeal-alerts" \| "admin-pool" \| "admin-classification"/);
  assert.match(dashboard, /activeView === "hotdeal-alerts"/);
  assert.match(dashboard, /<HotdealAlertsView \/>/);
});
