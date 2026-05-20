import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("detail modal starts with a beginner guide before dense analysis", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /function BeginnerGuideWalkthrough/);
  assert.match(modal, /data-beginner-guide-fullscreen/);
  assert.match(modal, /guideModeActive && activeRevealCard/);
  assert.match(modal, /!guideModeActive \? \(/);
  assert.match(modal, /&& !guideModeActive \? \(/);
  assert.match(modal, /초보자 가이드/);
  assert.match(modal, /판매자 신뢰/);
  assert.match(modal, /구매 전 체크/);
  assert.match(modal, /비교 매물/);
  assert.match(modal, /시세 흐름/);
  assert.match(modal, /매입가/);
  assert.match(modal, /되팔 때 비용/);
  assert.match(modal, /안전결제/);
  assert.match(modal, /되팔 곳/);
  assert.match(modal, /판매 속도/);
  assert.match(modal, /이 매물 자세히 살펴볼래요/);
  assert.match(modal, /이 매물 자세히 보기/);
  assert.match(modal, /초보자 가이드 스킵하기/);
  assert.match(modal, /onPrev/);
  assert.match(modal, /retreatBeginnerGuide/);
  assert.match(modal, /이전/);
  assert.ok(modal.includes("disabled={!canGoPrev}"));
  assert.match(modal, /BEGINNER_GUIDE_AUTO_SHOW_LIMIT = 5/);
  assert.match(modal, /BEGINNER_GUIDE_AUTO_HIDE_SKIP_THRESHOLD = 6/);
  assert.match(modal, /BEGINNER_GUIDE_HANDLED_PIDS_STORAGE_KEY/);
  assert.match(modal, /BEGINNER_GUIDE_SKIP_COUNT_STORAGE_KEY/);
  assert.match(modal, /shouldAutoShowBeginnerGuide/);

  const order = modal.slice(
    modal.indexOf("function beginnerGuideSteps"),
    modal.indexOf("function displayProfitRange"),
  );
  assert.ok(order.indexOf("marketCompareGuideStep(card)") < order.indexOf("marketTrendGuideStep(card)"));
  assert.ok(order.indexOf("marketTrendGuideStep(card)") < order.indexOf("velocityGuideStep(card)"));
  assert.ok(order.indexOf("velocityGuideStep(card)") < order.indexOf("buyCostGuideStep(card)"));
  assert.ok(order.indexOf("channelGuideStep(card)") < order.indexOf("purchaseCheckGuideStep(card)"));
  assert.match(modal, /eyebrow: "2\. 비교 매물"/);
  assert.match(modal, /eyebrow: "4\. 판매 속도"/);
  assert.match(modal, /eyebrow: "5\. 매입가"/);
  assert.match(modal, /eyebrow: "8\. 구매 전 체크"/);
});

test("detail modal uses the mobile detail shell on desktop", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const skeleton = modal.slice(
    modal.indexOf("function RevealResultSkeleton"),
    modal.indexOf("// 2026-05-15"),
  );
  const revealCard = modal.slice(
    modal.indexOf("function RevealCardItem"),
    modal.indexOf("function GuidePreviewPanel"),
  );
  const footer = modal.slice(
    modal.indexOf("function ModalActionFooter"),
    modal.indexOf("function FixedBunjangFooter"),
  );

  assert.match(modal, /data-mobile-detail-shell/);
  assert.match(modal, /sm:w-\[min\(480px,calc\(100vw-32px\)\)\]/);
  assert.match(modal, /sm:max-w-\[480px\]/);
  assert.match(modal, /PC에서도 모바일 상세 셸/);
  assert.doesNotMatch(modal, /sm:max-w-6xl/);
  assert.doesNotMatch(modal, /sm:h-auto sm:max-h-\[88vh\]/);
  assert.doesNotMatch(skeleton, /lg:grid-cols-2|sm:grid-cols|sm:h-\[|sm:w-\[|sm:flex|sm:block/);
  assert.doesNotMatch(revealCard, /lg:grid-cols-2|sm:grid-cols|sm:h-\[|sm:w-\[|hidden sm:block|sm:hidden/);
  assert.doesNotMatch(footer, /hidden sm:block|sm:hidden|sm:p-3/);
});

test("beginner guide uses existing evidence without guaranteed-profit copy", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /sellerReviewRating/);
  assert.match(modal, /sellerReviewCount/);
  assert.match(modal, /SELLER_TRUST_MIN_REVIEW_COUNT = 10/);
  assert.match(modal, /BEGINNER_PURCHASE_CHECK_LIMIT = 4/);
  assert.match(modal, /beginnerPurchaseChecks/);
  assert.match(modal, /data-beginner-guide-purchase-check/);
  assert.match(modal, /구매 전에 이것만 물어보면 돼요/);
  assert.match(modal, /혼자 보면 놓치기 쉬운 질문/);
  assert.match(modal, /사진이 적어요/);
  assert.match(modal, /배터리 상태를 물어보세요/);
  assert.match(modal, /잠금 해제 상태를 확인해요/);
  assert.match(modal, /정품 확인 포인트를 먼저 봐요/);
  assert.match(modal, /구성품을 확인해요/);
  assert.match(modal, /imageCount/);
  assert.match(modal, /photoCount: card\.savedDetail\?\.imageCount/);
  assert.match(modal, /categorySlug: categoryForBeginnerGuide\(card\)/);
  assert.match(modal, /이 상품 판매자는 후기가/);
  assert.match(modal, /평점은/);
  assert.match(modal, /판단 표본이 적어요/);
  assert.match(modal, /data-beginner-guide-trust-highlight/);
  assert.match(modal, /data-beginner-guide-trust-metric/);
  assert.match(modal, /BeginnerGuideStarGlyph/);
  assert.match(modal, /평점이 <strong/);
  assert.match(modal, /후기가 <strong/);
  assert.match(modal, /marketConditionLabel\(card\)/);
  assert.match(modal, /conditionComparisonGroupLabel\(card\)/);
  assert.match(modal, /conditionComparisonMethodLine\(card\)/);
  assert.match(modal, /conditionBasisSentence\(card\)/);
  assert.match(modal, /conditionProductLabel\(card\)/);
  assert.match(modal, /data-beginner-guide-condition-basis/);
  assert.match(modal, /끼리 비교했어요/);
  assert.match(modal, /득템잡이는 번개장터에 있는/);
  assert.match(modal, /하자가 있는 상품/);
  assert.match(modal, /\$\{groupLabel\} 중에서도 싸게 나왔어요/);
  assert.match(modal, /return "미개봉품"/);
  assert.match(modal, /아래에는 기준이 된 매물을 비싼 순으로 보여드릴게요/);
  assert.match(modal, /사용감이 어느 정도 있는 상품끼리/);
  assert.match(modal, /\.sort\(\(a, b\) => \(b\.price \?\? 0\) - \(a\.price \?\? 0\)\)/);
  assert.match(modal, /저렴/);
  assert.match(modal, /data-beginner-guide-product-image/);
  assert.match(modal, /data-beginner-guide-market-evidence/);
  assert.match(modal, /data-beginner-guide-comparables/);
  assert.match(modal, /BeginnerGuideComparablePreview/);
  assert.match(modal, /INITIAL_VISIBLE = 4/);
  assert.match(modal, /EXPANDED_VISIBLE = 8/);
  assert.match(modal, /visibleListings/);
  assert.match(modal, /비교 매물 \$\{moreCount\.toLocaleString\("ko-KR"\)\}개 더 보기/);
  assert.match(modal, /MarketHistoryChart/);
  assert.match(modal, /data-beginner-guide-market-trend/);
  assert.match(modal, /data-beginner-guide-buy-cost/);
  assert.match(modal, /data-beginner-guide-resell-cost/);
  assert.match(modal, /판매자 무료배송/);
  assert.match(modal, /배송비를 누가 부담하는지 한 번 더 확인/);
  assert.match(modal, /되팔 때 드는 비용을 빼요/);
  assert.match(modal, /수수료·배송비까지 뺀 예상 차익/);
  assert.match(modal, /그 비용까지 뺀 뒤 남는 예상 차익/);
  assert.ok(modal.includes('<BunjangLogo className="h-6 w-6 rounded-full" />'));
  assert.match(modal, /내가 낼 배송비/);
  assert.match(modal, /data-beginner-guide-safe-payment/);
  assert.match(modal, /구매확정/);
  assert.match(modal, /data-beginner-guide-channel-profit/);
  assert.match(modal, /당근 직거래/);
  assert.match(modal, /minyoiGuideStepIn/);
  assert.match(modal, /data-beginner-guide-reopen/);
  assert.match(modal, /쉽게 보기/);
  assert.match(modal, /recordBeginnerGuideSkipped\(activeRevealPid\)/);
  assert.match(modal, /recordBeginnerGuideCompleted\(activeRevealPid\)/);
  assert.match(modal, /medianHoursToSold/);
  assert.match(modal, /observedSoldSampleCount/);
  assert.match(modal, /dailySoldCountLabel/);
  assert.match(modal, /되팔면 보통/);
  assert.match(modal, /팔리는 편이에요/);
  assert.match(modal, /돈이 얼마나 오래 묶일지/);
  assert.match(modal, /동일 모델 하루 평균 판매량/);
  assert.match(modal, /동일 모델 하루 판매량/);
  assert.match(modal, /비슷한 거래 기록/);
  assert.match(modal, /거래 기록 데이터를 받는 중이에요/);
  assert.match(modal, /표본 부족/);
  assert.match(modal, /h-14 w-14/);
  assert.match(modal, /후기와 평점이 없어요/);
  assert.match(modal, /번개장터 신규 판매자/);
  assert.match(modal, /requestedAnalysisPidsRef/);
  assert.match(modal, /guidePrimaryButtonClass/);
  assert.match(modal, /data-bunjang-exit-confirm/);
  assert.match(modal, /원본 매물로 이동하기 전/);
  assert.match(modal, /확인하고 번개장터 보기/);
  assert.match(modal, /더 살펴볼래요/);
  assert.doesNotMatch(modal, /지금까지 핵심 판단 근거|비교 표본 .* 실제 결과/);
  assert.doesNotMatch(modal, /안에 팔린 기록이 있어요/);
  assert.doesNotMatch(modal, /상태가 비슷한 매물보다 낮아요|상태가 비슷한 매물보다 싸게 나왔어요|그 기준보다 .* 낮아요|같은 상태 매물을 기준/);
  assert.doesNotMatch(modal, /판매완료 누적|판매완료 표본|시세 거래 표본|거래완료 표본|최근 등록/);
  assert.doesNotMatch(modal, /0원로|수집중|후기 데이터는 아직 충분하지/);
  assert.doesNotMatch(modal, /무조건|본전|수익 보장|돈을 벌|얼마를 벌/);
});

test("cost assurance does not turn market delta into buyer shipping", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const snapshot = modal.slice(
    modal.indexOf("function costAssuranceSnapshot"),
    modal.indexOf("// Wave 2026-05-19 v2"),
  );

  assert.match(modal, /DEFAULT_BUYER_SHIPPING_FEE_MAX = 3_500/);
  assert.match(snapshot, /buyerShippingLow = 0/);
  assert.match(snapshot, /buyerShippingHigh = freeShipping \? 0 : DEFAULT_BUYER_SHIPPING_FEE_MAX/);
  assert.match(snapshot, /resalePriceFromProfit\(card\.expectedProfitMin, buyCostHigh\)/);
  assert.match(snapshot, /resalePriceFromProfit\(card\.expectedProfitMax, buyCostLow\)/);
  assert.match(modal, /수익 기준 시세/);
  assert.doesNotMatch(snapshot, /salePrice - card\.expectedProfit/);
  assert.doesNotMatch(snapshot, /buyCostLow - card\.price/);
});

test("market velocity reads the stable all-condition materialization", () => {
  const packOpen = source("src/lib/pack-open.ts");
  const sync = source("scripts/sync-market-velocity.mjs");

  assert.match(packOpen, /"condition_class"/);
  assert.match(packOpen, /condition_class=eq\.all/);
  assert.match(packOpen, /observed_sold_sample_count\.desc/);
  assert.match(sync, /condition_class text not null default 'all'/);
  assert.match(sync, /primary key \(date, comparable_key, condition_class\)/);
  assert.match(sync, /on conflict \(date, comparable_key, condition_class\)/);
});

test("pack reveal exposes listing photo count for beginner checks", () => {
  const packOpen = source("src/lib/pack-open.ts");

  assert.match(packOpen, /imageCount: number \| null/);
  assert.match(packOpen, /image_count: number \| null/);
  assert.match(packOpen, /shop_review_count,image_count,num_comment/);
  assert.match(packOpen, /imageCount: rawMeta\.image_count/);
});
