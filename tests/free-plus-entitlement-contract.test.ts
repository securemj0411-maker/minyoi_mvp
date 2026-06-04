import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PLANS } from "../src/lib/plan-config";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("free and credit packages define the first paid entitlement boundary", () => {
  assert.equal(PLANS.free.monthlyCredits, 0);
  assert.equal(PLANS.free.dailyOpenLimit, 1);
  assert.match(PLANS.free.features.join(" "), /첫 상세보기 1회 무료/);
  assert.match(PLANS.free.features.join(" "), /새 상품 1개당 1크레딧/);

  assert.equal(PLANS.single.priceKrw, 690);
  assert.equal(PLANS.starter.priceKrw, 9_900);
  assert.equal(PLANS.plus.dailyOpenLimit, 45);
  assert.equal(PLANS.plus.name, "45 크레딧");
  assert.match(PLANS.plus.features.join(" "), /상세보기\/원본 확인 45회분/);
});

test("pool detail access gives the first unique pid free, then spends one credit", () => {
  const helper = source("src/lib/detail-access.ts");
  const route = source("src/app/api/packs/pool/detail-access/route.ts");

  assert.match(helper, /FREE_DETAIL_ACCESS_LIMIT = 1/);
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
  assert.match(helper, /unlimited: true/);
  assert.match(helper, /freeUsed: FREE_DETAIL_ACCESS_LIMIT/);
});

test("pool feed is a membership feed and shows exact purchase info directly", () => {
  const poolRoute = source("src/app/api/packs/pool/route.ts");
  const statsRoute = source("src/app/api/stats/pool/route.ts");
  const explore = source("src/components/explore-client.tsx");
  const detailAccessRoute = source("src/app/api/packs/pool/detail-access/route.ts");
  const analysisRoute = source("src/app/api/packs/pool/analysis/route.ts");

  assert.match(poolRoute, /승인된 멤버만 접근하며 매입가\/시세를 그대로 공개/);
  assert.match(poolRoute, /인증 \+ 멤버십 필수/);
  assert.match(poolRoute, /const readyCandidateLimit = refresh \? REFRESH_READY_CANDIDATE_LIMIT : READY_SLOTS/);
  assert.match(poolRoute, /diversifyByCategory\(readyFiltered, options\.readyCandidateLimit \?\? READY_SLOTS\)/);
  assert.match(poolRoute, /예산 필터가 있을 때 더 넓은 가격대로 조용히 fallback하지 않는다/);
  assert.doesNotMatch(poolRoute, /fallbackChain/);
  assert.doesNotMatch(poolRoute, /FALLBACK_THRESHOLD/);
  assert.match(poolRoute, /items = items\.slice\(0, PAGE_SIZE\)/);
  assert.match(poolRoute, /sortParam === "latest" \|\| sortParam === "price_asc"/);
  assert.match(poolRoute, /if \(sort === "price_asc"\)/);
  assert.match(poolRoute, /return a\.price - b\.price/);
  assert.match(poolRoute, /const responseItems = items/);
  assert.match(poolRoute, /feedPreviewLocked: false/);
  assert.doesNotMatch(poolRoute, /buildTeaserFeedItems/);
  assert.doesNotMatch(poolRoute, /listingUrl: null/);
  assert.doesNotMatch(poolRoute, /marketplaceSource: null/);
  assert.doesNotMatch(poolRoute, /comparableKey: null/);
  assert.doesNotMatch(poolRoute, /sellerSignalLabel/);
  assert.doesNotMatch(poolRoute, /판매자 정보 상세 확인/);
  assert.match(poolRoute, /priceSignalLabel/);
  assert.match(poolRoute, /marketSignalLabel/);
  assert.match(poolRoute, /velocitySignalLabel/);
  assert.match(poolRoute, /loadVelocitySignalsForPool/);
  assert.match(poolRoute, /LATEST_TIER_PREVIEW_CATEGORIES = new Set\(\["shoe", "clothing", "game_console", "sport_golf"\]\)/);
  assert.match(poolRoute, /if \(usesLatestTierPreviewCategory\(category\)\) return `\$\{categoryLabel\} 후보`;/);
  assert.match(poolRoute, /import \{ localizeProductLineLabel \} from "@\/lib\/product-line-display"/);
  assert.match(poolRoute, /const localized = localizeProductLineLabel\(cleaned\)/);
  assert.match(poolRoute, /if \(usesLatestTierPreviewCategory\(category\)\) return `\$\{localized\}\$\{suffix\}`;/);
  assert.match(poolRoute, /import \{ teaserBudgetRangeLabel \} from "@\/lib\/feed-price-display"/);
  assert.match(poolRoute, /return teaserBudgetRangeLabel\(value\)/);
  assert.match(poolRoute, /feedMode: "membership"/);
  assert.match(poolRoute, /creditFeed: false/);
  assert.match(poolRoute, /getDetailAccessSnapshot/);
  assert.match(poolRoute, /detailAccess/);
  assert.doesNotMatch(poolRoute, /exactFeedAllowed/);
  assert.doesNotMatch(poolRoute, /maskFreeFeedItems/);
  assert.doesNotMatch(poolRoute, /createPoolAccessToken/);
  assert.doesNotMatch(poolRoute, /syntheticPidForPoolToken/);
  assert.match(poolRoute, /excludeTokens/);
  assert.match(detailAccessRoute, /decodePoolAccessToken/);
  assert.match(detailAccessRoute, /const item = await loadExactPoolItem\(pid\)/);
  assert.match(analysisRoute, /hasDetailAccess/);
  assert.match(analysisRoute, /detail_access_required/);

  assert.doesNotMatch(explore, /creditFeedEnabled/);
  assert.match(explore, /DEFAULT_FREE_DETAIL_ACCESS_LIMIT = 0/);
  assert.match(explore, /Math\.min\(normalizedFreeLimit, DEFAULT_FREE_DETAIL_ACCESS_LIMIT\)/);
  assert.match(explore, /DETAIL_ACCESS_SNAPSHOT_STORAGE_KEY/);
  assert.match(explore, /readDetailAccessSnapshot\(storageScope\)/);
  assert.match(explore, /writeDetailAccessSnapshot\(storageScope, nextDetailAccess\)/);
  assert.match(explore, /detailAccessSnapshot/);
  assert.doesNotMatch(explore, /freeDetailRemaining/);
  assert.doesNotMatch(explore, /detailAccessSnapshot\.unlimited \? 0 : Number\(detailAccessSnapshot\.freeLimit\) - Number\(detailAccessSnapshot\.freeUsed\)/);
  assert.doesNotMatch(explore, /const unlimitedDetailAvailable = lockedPreview && detailAccessSnapshot\.unlimited === true/);
  assert.doesNotMatch(explore, /상세 무제한/);
  assert.match(explore, /function isFeedTeaserLocked/);
  assert.match(explore, /return false/);
  assert.doesNotMatch(explore, /hasPaidOrFreeDetailAccess/);
  assert.match(explore, /const teaserLocked = isFeedTeaserLocked\(it\)/);
  assert.doesNotMatch(explore, /상세에서 원문 공개/);
  assert.doesNotMatch(explore, /첫 상세 무료/);
  assert.match(detailAccessRoute, /unlimited: access\.unlimited \?\? false/);
  assert.doesNotMatch(explore, /정확가 잠김/);
  assert.match(explore, /매입가/);
  assert.doesNotMatch(explore, /필요 예산/);
  assert.doesNotMatch(explore, /정확 시세 잠김/);
  assert.doesNotMatch(explore, /출처 잠금/);
  assert.doesNotMatch(explore, /lockedPreview && item\.marketSignalLabel/);
  assert.doesNotMatch(explore, /상세에서 제목·가격 공개/);
  assert.match(explore, /type TierBadgeCategory = "shoe" \| "clothing" \| "game_console" \| "sport_golf"/);
  assert.match(explore, /function tierBadgeCategoryForItem/);
  assert.match(explore, /if \(usesLatestTierPreviewCategory\(item\.category\)\) return `\$\{lockedPreviewCategoryLabel\(item\)\} 후보`;/);
  assert.match(explore, /category=\{tierBadgeCategory\}/);
  assert.match(explore, /const legacyBadgeCondition = tierBadgeCategory \? null : item\.conditionClass/);
  assert.match(explore, /<ConditionPhotoBadge conditionClass=\{legacyBadgeCondition\} compact \/>/);
  assert.doesNotMatch(explore, /ConditionChip/);
  assert.match(explore, /openedDetailPids/);
  assert.doesNotMatch(explore, /data-credit-infinite-feed-sentinel/);
  assert.match(explore, /accessToken/);
  assert.match(explore, /excludeTokens/);
  assert.doesNotMatch(explore, /피드는 무료예요/);
  assert.doesNotMatch(explore, /정확한 제목·가격·출처·원문은 상세 분석에서 열려요/);
  assert.doesNotMatch(explore, /크레딧은 마음에 드는 매물의 상세 분석을 열 때만 써요/);
  assert.match(explore, /data-category-filter-scroll/);
  assert.match(explore, /scrollCategories/);
  assert.match(explore, /카테고리 오른쪽으로 보기/);
  assert.match(explore, /bg-black\/72/);
  assert.doesNotMatch(explore, /hidden h-7 w-7 shrink-0/);
  assert.match(explore, /<option value="price_asc">매입단가순<\/option>/);
  assert.match(explore, /오늘 볼 수 있는 추천 매물은 여기까지예요/);
  assert.match(explore, /수익, 시세, 상태 조건을 통과한 매물만 남긴 결과예요/);
  assert.doesNotMatch(explore, /creditFeedEnabled && !feedExhausted && items\.length > 0/);
  assert.doesNotMatch(explore, /rootMargin: "1800px 0px"/);
  assert.doesNotMatch(explore, /조건 맞는 후보를 미리 찾는 중/);
  assert.match(explore, /조건은 오늘 여기까지예요/);
  assert.match(explore, /가격대를 넓히면 더 볼 수 있어요/);
  assert.match(explore, /function nextBudgetFilterOption/);
  assert.match(explore, /nextBudgetOption\.value === "all" \? "가격 제한 풀고 보기"/);
  assert.doesNotMatch(explore, /새 매물 붙이는 중/);
  assert.doesNotMatch(explore, /지금 볼 수 있는 추천 매물/);
  assert.doesNotMatch(explore, /지금 즉시 매물/);
  assert.doesNotMatch(explore, /크레딧 충전 사용자 전용/);
  assert.match(explore, /!loading && !scrapOnly && items\.length > 0/);

  assert.match(statsRoute, /freshLocked: 0/);
  assert.match(statsRoute, /freshLagHours: 0/);
  assert.doesNotMatch(statsRoute, /FRESH_LAG_HOURS = 6/);
});

test("explore detail refresh keeps feed price and profit aligned with detail analysis", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /function recomputePoolProfit/);
  assert.match(explore, /expectedProfitFromMarketPrice/);
  assert.match(explore, /buyerShippingForPoolItem/);
  assert.match(explore, /marketplaceSource: item\.marketplaceSource/);
  assert.match(explore, /const marketBasis = data\.analysis\.marketBasis \?\? null/);
  assert.match(explore, /expectedProfitMin: strictSourceMissing \? 0 : \(recomputedProfit\?\.min \?\? prev\.expectedProfitMin\)/);
  assert.match(explore, /expectedProfitMax: strictSourceMissing \? 0 : \(recomputedProfit\?\.max \?\? prev\.expectedProfitMax\)/);
  assert.match(explore, /setItems\(\(prev\) => prev\.map/);
  assert.match(explore, /skuMedian: marketBasis\?\.medianPrice \?\? item\.skuMedian/);
  assert.match(explore, /expectedProfitMin: strictSourceMissing \? 0 : \(recomputedProfit\?\.min \?\? item\.expectedProfitMin\)/);
});

test("explore opens the modal only after detail access is granted", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /\/api\/packs\/pool\/detail-access/);
  assert.match(explore, /openedDetailPidsRef/);
  assert.match(explore, /DetailAccessPaywallModal/);
  assert.match(explore, /setDetailAccessLimit/);
  assert.doesNotMatch(explore, /크레딧 충전하러 가기/);
  assert.doesNotMatch(explore, /첫 상품 1개는 무료로 열리고/);
  assert.doesNotMatch(explore, /1크레딧으로 정확한 매물 열기/);
  assert.match(explore, /DetailAccessValueSummary/);
  assert.doesNotMatch(explore, /무료 상세에서 확인한 것/);
  assert.doesNotMatch(explore, /열어본 상세/);
  assert.doesNotMatch(explore, /확인한 수익/);
  assert.doesNotMatch(explore, /comparableCount:\s*12/);
  assert.doesNotMatch(explore, /estimatedMinutesSaved:\s*15/);
  assert.doesNotMatch(explore, /판단 시간/);
  assert.match(explore, /accessValueForItem\(exactItem\)/);
  assert.match(explore, /data\.item/);
  assert.match(explore, /minyoi:credits-changed/);
  assert.doesNotMatch(explore, /Plus로 계속 보기/);
  assert.doesNotMatch(explore, /오늘 무료 상세보기|하루 기준으로 다시 열려요/);
  assert.match(explore, /void openItemDetail\(item\)/);
});

test("direct-only items open detail directly under membership detail access", () => {
  const explore = source("src/components/explore-client.tsx");
  const poolRoute = source("src/app/api/packs/pool/route.ts");
  const detailAccessRoute = source("src/app/api/packs/pool/detail-access/route.ts");
  const safety = source("src/lib/marketplace-safety.ts");

  assert.match(safety, /function marketplaceLocationFromRawJson/);
  assert.match(poolRoute, /marketplaceLocationCombinedWithRegion/);
  assert.match(poolRoute, /directTradeLocation: marketplaceLocationCombinedWithRegion\(meta\?\.raw_json, meta\?\.description_preview \?\? null/);
  assert.doesNotMatch(poolRoute, /directTradeLocation: null/);
  assert.match(detailAccessRoute, /directTradeLocation: marketplaceLocationCombinedWithRegion\(meta\?\.raw_json, meta\?\.description_preview \?\? null/);
  assert.match(detailAccessRoute, /directTradeLocation: detail\.tradeLocation \?\? item\.directTradeLocation/);
  assert.doesNotMatch(explore, /type DirectTradeConfirmState/);
  assert.doesNotMatch(explore, /function DirectTradeConfirmModal/);
  assert.doesNotMatch(explore, /이 상품은 직거래만 가능한 매물이에요/);
  assert.doesNotMatch(explore, /열기 전 확인/);
  assert.doesNotMatch(explore, /그래도 상세 분석 열기/);
  assert.doesNotMatch(explore, /\/api\/packs\/pool\/direct-location/);
  assert.doesNotMatch(explore, /원본에서 위치 확인/);
  assert.doesNotMatch(explore, /const hasDetailEntitlement = hasPaidOrFreeDetailAccess\(detailAccessSnapshot, freeDetailRemaining\)/);
  assert.doesNotMatch(explore, /isDirectOnlyItem\(item\) && hasDetailEntitlement/);
  assert.match(explore, /void openItemDetail\(item\)/);
});

test("detail modal leads with exact money and market evidence instead of boilerplate decision", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const profitIndex = modal.indexOf(">예상 순익</span>");
  const sellerIndex = modal.indexOf("<SellerTrustPanel card={card} />");
  const comparableIndex = modal.indexOf("<ComparableListingsPanel card={card} mode={mode} />");
  const graphIndex = modal.indexOf("<DetailMarketGraphSection card={card} />");

  assert.doesNotMatch(modal, /function PurchaseDecisionHeader/);
  assert.doesNotMatch(modal, /구매 판단 요약/);
  assert.doesNotMatch(modal, /근거 확인 후 판단/);
  assert.doesNotMatch(modal, /<PurchaseDecisionHeader card=\{card\} \/>/);
  assert.ok(profitIndex > 0, "profit should render before softer judgement copy");
  assert.ok(sellerIndex > profitIndex, "seller trust should stay near the top after money/risk");
  assert.ok(comparableIndex > sellerIndex, "market comparables should follow money and seller trust");
  assert.ok(graphIndex > comparableIndex, "market graph should stay after concrete comparable listings");
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
