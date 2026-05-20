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
  assert.match(modal, /비교 매물/);
  assert.match(modal, /시세 흐름/);
  assert.match(modal, /매입가/);
  assert.match(modal, /되팔 때 비용/);
  assert.match(modal, /안전결제/);
  assert.match(modal, /되팔 곳/);
  assert.match(modal, /판매 속도/);
  assert.match(modal, /이제 상세 분석으로 넘어가면 돼요/);
  assert.match(modal, /상세 분석 보기/);
  assert.match(modal, /초보자 가이드 스킵하기/);
  assert.match(modal, /onPrev/);
  assert.match(modal, /retreatBeginnerGuide/);
  assert.match(modal, /이전/);
  assert.ok(modal.includes("disabled={!canGoPrev}"));
  assert.match(modal, /BEGINNER_GUIDE_AUTO_SHOW_LIMIT = 3/);
  assert.match(modal, /BEGINNER_GUIDE_AUTO_HIDE_SKIP_THRESHOLD = 4/);
  assert.match(modal, /BEGINNER_GUIDE_HANDLED_PIDS_STORAGE_KEY/);
  assert.match(modal, /BEGINNER_GUIDE_SKIP_COUNT_STORAGE_KEY/);
  assert.match(modal, /shouldAutoShowBeginnerGuide/);
});

test("beginner guide uses existing evidence without guaranteed-profit copy", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /sellerReviewRating/);
  assert.match(modal, /sellerReviewCount/);
  assert.match(modal, /이 상품 판매자는 후기가/);
  assert.match(modal, /data-beginner-guide-trust-highlight/);
  assert.match(modal, /data-beginner-guide-trust-metric/);
  assert.match(modal, /BeginnerGuideStarGlyph/);
  assert.match(modal, /평점이 <strong/);
  assert.match(modal, /후기가 <strong/);
  assert.match(modal, /marketConditionLabel\(card\)/);
  assert.match(modal, /상태가 비슷한 .*매물의 시세를 모아봤어요/);
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
  assert.match(modal, /구매확정 전 확인/);
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
  assert.match(modal, /하루 평균 팔림/);
  assert.match(modal, /최근 7일 기준 하루/);
  assert.match(modal, /비슷한 거래 기록/);
  assert.match(modal, /판매 속도를 불러오는 중이에요/);
  assert.match(modal, /확인 중/);
  assert.match(modal, /h-14 w-14/);
  assert.match(modal, /후기와 평점이 없어요/);
  assert.match(modal, /번개장터 신규 판매자/);
  assert.match(modal, /requestedAnalysisPidsRef/);
  assert.match(modal, /guidePrimaryButtonClass/);
  assert.doesNotMatch(modal, /지금까지 핵심 판단 근거|비교 표본 .* 실제 결과/);
  assert.doesNotMatch(modal, /판매완료 누적|판매완료 표본|시세 거래 표본|거래완료 표본/);
  assert.doesNotMatch(modal, /0원로|수집중|후기 데이터는 아직 충분하지/);
  assert.doesNotMatch(modal, /무조건|본전|수익 보장|돈을 벌|얼마를 벌/);
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
