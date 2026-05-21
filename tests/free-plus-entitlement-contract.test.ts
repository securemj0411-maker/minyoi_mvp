import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PLANS } from "../src/lib/plan-config";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("free and 200-credit package define the first paid entitlement boundary", () => {
  assert.equal(PLANS.free.monthlyCredits, 0);
  assert.equal(PLANS.free.dailyOpenLimit, 3);
  assert.match(PLANS.free.features.join(" "), /첫 상세보기 3개 무료/);
  assert.match(PLANS.free.features.join(" "), /새 상품 1개당 1크레딧/);

  assert.equal(PLANS.plus.dailyOpenLimit, 200);
  assert.equal(PLANS.plus.name, "200 크레딧");
  assert.match(PLANS.plus.features.join(" "), /상세보기\/원본 확인 200회분/);
});

test("pool detail access gives first three unique pids free, then spends one credit", () => {
  const helper = source("src/lib/detail-access.ts");
  const route = source("src/app/api/packs/pool/detail-access/route.ts");

  assert.match(helper, /FREE_DETAIL_ACCESS_LIMIT = 3/);
  assert.match(helper, /spendUserCredits/);
  assert.match(helper, /amount: 1/);
  assert.match(helper, /source: "detail_access"/);
  assert.match(helper, /mvp_rate_limits/);
  assert.match(helper, /detail-access:\$\{userRef\}:\$\{pid\}/);
  assert.match(helper, /detail-access-free:\$\{userRef\}/);
  assert.doesNotMatch(helper, /consumeDailyQuota|refundDailyQuota|daily_limit_reached/);

  assert.match(route, /consumeDetailAccess/);
  assert.match(route, /mvp_candidate_pool/);
  assert.match(route, /status=eq\.ready/);
  assert.match(route, /creditSpent/);
  assert.match(route, /freeUsed/);
});

test("credit holders can browse the feed without refresh cooldown", () => {
  const poolRoute = source("src/app/api/packs/pool/route.ts");
  const statsRoute = source("src/app/api/stats/pool/route.ts");
  const explore = source("src/components/explore-client.tsx");
  const detailAccessRoute = source("src/app/api/packs/pool/detail-access/route.ts");
  const analysisRoute = source("src/app/api/packs/pool/analysis/route.ts");

  assert.match(poolRoute, /2h cooldown/);
  assert.match(poolRoute, /select=user_ref,balance,last_free_browse_at/);
  assert.match(poolRoute, /const creditFeed = isAdminUser\(auth\.user\) \|\| Number\(credits\?\.balance \?\? 0\) > 0/);
  assert.match(poolRoute, /if \(refresh && !creditFeed && !cooldown\.canRefresh\)/);
  assert.match(poolRoute, /if \(refresh && !creditFeed && cooldown\.canRefresh\)/);
  assert.match(poolRoute, /const readyCandidateLimit = refresh \? FETCH_POOL_OVERFETCH : READY_SLOTS/);
  assert.match(poolRoute, /diversifyByCategory\(readyFiltered, options\.readyCandidateLimit \?\? READY_SLOTS\)/);
  assert.match(poolRoute, /items = items\.slice\(0, PAGE_SIZE\)/);
  assert.match(poolRoute, /sortParam === "latest" \|\| sortParam === "price_asc"/);
  assert.match(poolRoute, /if \(sort === "price_asc"\)/);
  assert.match(poolRoute, /return a\.price - b\.price/);
  assert.match(poolRoute, /feedMode: creditFeed \? "credit" : "free"/);
  assert.match(poolRoute, /creditFeed/);
  assert.match(poolRoute, /getDetailAccessSnapshot/);
  assert.match(poolRoute, /detailAccess/);
  assert.match(poolRoute, /maskFreeFeedItems/);
  assert.match(poolRoute, /createPoolAccessToken/);
  assert.match(poolRoute, /syntheticPidForPoolToken/);
  assert.match(poolRoute, /excludeTokens/);
  assert.match(detailAccessRoute, /decodePoolAccessToken/);
  assert.match(detailAccessRoute, /const item = await loadExactPoolItem\(pid\)/);
  assert.match(analysisRoute, /hasDetailAccess/);
  assert.match(analysisRoute, /detail_access_required/);

  assert.match(explore, /creditFeedEnabled/);
  assert.match(explore, /DEFAULT_FREE_DETAIL_ACCESS_LIMIT = 3/);
  assert.match(explore, /DETAIL_ACCESS_SNAPSHOT_STORAGE_KEY/);
  assert.match(explore, /readDetailAccessSnapshot\(storageScope\)/);
  assert.match(explore, /writeDetailAccessSnapshot\(storageScope, nextDetailAccess\)/);
  assert.match(explore, /detailAccessSnapshot/);
  assert.match(explore, /freeDetailRemaining/);
  assert.match(explore, /Number\(detailAccessSnapshot\.freeLimit\) - Number\(detailAccessSnapshot\.freeUsed\)/);
  assert.match(explore, /const freePreviewUnlocked = !creditFeedEnabled && freeDetailRemaining > 0/);
  assert.match(explore, /creditFeedEnabled \|\| freePreviewUnlocked \|\| scrapOnly/);
  assert.match(explore, /lockedPreviewTitle/);
  assert.match(explore, /원제목·원본 사진·판매자 정보는 상세 분석에서 보여드려요/);
  assert.match(explore, /무료 상세 가능/);
  assert.match(explore, /무료 상세 열기/);
  assert.match(explore, /원본 사진은/);
  assert.match(explore, /상세 열면 원본 공개/);
  assert.match(explore, /openedDetailPids/);
  assert.match(explore, /data-credit-infinite-feed-sentinel/);
  assert.match(explore, /IntersectionObserver/);
  assert.match(explore, /autoScrollNew: false/);
  assert.match(explore, /accessToken/);
  assert.match(explore, /excludeTokens/);
  assert.match(explore, /피드 탐색은 무제한 · 크레딧은 상세 분석을 열 때만 차감/);
  assert.match(explore, /조금만 기다리면 새 상품이 열려요/);
  assert.match(explore, /무료로 새 상품을 볼 수 있어요/);
  assert.match(explore, /후 새 상품 보기/);
  assert.match(explore, /크레딧 보유자는 피드 계속 보기/);
  assert.match(explore, /피드는 차감 0개예요/);
  assert.match(explore, /크레딧 충전하고 바로 이어보기/);
  assert.match(explore, /피드 무제한/);
  assert.match(explore, /크레딧 1개 이상이면 대기 없이 피드 계속 보기/);
  assert.match(explore, /data-category-filter-scroll/);
  assert.match(explore, /scrollCategories/);
  assert.match(explore, /카테고리 오른쪽으로 보기/);
  assert.match(explore, /bg-black\/72/);
  assert.doesNotMatch(explore, /hidden h-7 w-7 shrink-0/);
  assert.match(explore, /<option value="price_asc">매입단가순<\/option>/);
  assert.match(explore, /오늘 볼 수 있는 추천 매물은 여기까지예요/);
  assert.match(explore, /수익, 시세, 상태 조건을 통과한 매물만 남긴 결과예요/);
  assert.match(explore, /creditFeedEnabled && !feedExhausted && items\.length > 0/);
  assert.doesNotMatch(explore, /지금 볼 수 있는 추천 매물/);
  assert.doesNotMatch(explore, /지금 즉시 매물/);
  assert.doesNotMatch(explore, /크레딧 충전 사용자 전용/);
  assert.match(explore, /!creditFeedEnabled && items\.length > 0/);

  assert.match(statsRoute, /freshLocked: 0/);
  assert.match(statsRoute, /freshLagHours: 0/);
  assert.doesNotMatch(statsRoute, /FRESH_LAG_HOURS = 6/);
});

test("explore detail refresh keeps feed price and profit aligned with detail analysis", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /function recomputePoolProfit/);
  assert.match(explore, /SELLING_FEE_RATE/);
  assert.match(explore, /RESELL_SHIPPING_FEE/);
  assert.match(explore, /SAFETY_BUFFER/);
  assert.match(explore, /const marketBasis = data\.analysis\.marketBasis \?\? null/);
  assert.match(explore, /expectedProfitMin: recomputedProfit\?\.min \?\? prev\.expectedProfitMin/);
  assert.match(explore, /expectedProfitMax: recomputedProfit\?\.max \?\? prev\.expectedProfitMax/);
  assert.match(explore, /setItems\(\(prev\) => prev\.map/);
  assert.match(explore, /skuMedian: marketBasis\?\.medianPrice \?\? item\.skuMedian/);
  assert.match(explore, /expectedProfitMin: recomputedProfit\?\.min \?\? item\.expectedProfitMin/);
});

test("explore opens the modal only after detail access is granted", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /\/api\/packs\/pool\/detail-access/);
  assert.match(explore, /openedDetailPidsRef/);
  assert.match(explore, /DetailAccessPaywallModal/);
  assert.match(explore, /setDetailAccessLimit/);
  assert.match(explore, /크레딧 충전하고 계속 보기/);
  assert.match(explore, /첫 3개 상품은 무료로 열리고/);
  assert.match(explore, /새 상품을 열 때마다 1크레딧/);
  assert.match(explore, /DetailAccessValueSummary/);
  assert.match(explore, /무료 \{summary\.openedCount\.toLocaleString\("ko-KR"\)\}건 동안 이렇게 봤어요/);
  assert.match(explore, /비교 매물/);
  assert.match(explore, /예상 기회 수익/);
  assert.match(explore, /판단 시간/);
  assert.match(explore, /accessValueForItem\(exactItem\)/);
  assert.match(explore, /data\.item/);
  assert.match(explore, /minyoi:credits-changed/);
  assert.doesNotMatch(explore, /Plus로 계속 보기/);
  assert.doesNotMatch(explore, /오늘 무료 상세보기|하루 기준으로 다시 열려요/);
  assert.match(explore, /void openItemDetail\(item\)/);
});

test("detail modal keeps purchase decision and market evidence in the first fold", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const decisionIndex = modal.indexOf("<PurchaseDecisionHeader card={card} />");
  const comparableIndex = modal.indexOf("<ComparableListingsPanel card={card} mode={mode} />");

  assert.match(modal, /function PurchaseDecisionHeader/);
  assert.match(modal, /구매 판단/);
  assert.match(modal, /근거 있는 매입 후보/);
  assert.ok(decisionIndex > 0, "purchase decision header should render in the detail modal");
  assert.ok(comparableIndex > decisionIndex, "market comparables should stay directly after the decision/profit block");
});

test("related item clicks do not scroll before access is granted", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.doesNotMatch(modal, /onBeforeOpenRelatedItem/);
  assert.match(modal, /activeRevealPid/);
  assert.match(modal, /resetDetailScroll\("auto"\)/);
  assert.match(modal, /data-related-reveal-scroll/);
  assert.match(modal, /scrollRelatedItems/);
  assert.match(modal, /scrollBy\(\{/);
  assert.match(modal, /다른 수익 매물 오른쪽으로 보기/);
});

test("profit card detail toggle does not duplicate market comparables copy", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /수익 계산 근거 보기/);
  assert.match(modal, /data-profit-calculation-basis/);
  assert.match(modal, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.doesNotMatch(modal, /계산식 · 비교 매물/);
  assert.match(modal, /시세 비교 매물/);
});
