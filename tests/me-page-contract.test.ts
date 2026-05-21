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

test("/me detail refresh keeps market price and profit on the same basis", () => {
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(dashboard, /function recomputeCurrentProfitFromMarketBasis/);
  assert.match(dashboard, /SELLING_FEE_RATE/);
  assert.match(dashboard, /RESELL_SHIPPING_FEE/);
  assert.match(dashboard, /SAFETY_BUFFER/);
  assert.match(dashboard, /const marketBasis = detailData\.analysis\?\.marketBasis \?\? item\.marketBasis/);
  assert.match(dashboard, /const recomputedProfit = recomputeCurrentProfitFromMarketBasis\(item, marketBasis\)/);
  assert.match(dashboard, /marketGapKrw: recomputedProfit\?\.min \?\? item\.marketGapKrw/);
  assert.match(dashboard, /marketGapKrwMax: recomputedProfit\?\.max \?\? item\.marketGapKrwMax/);
  assert.match(dashboard, /marketStale: recomputedProfit \? recomputedProfit\.max <= 0 : item\.marketStale/);
});

test("/me user modal explains recommendation trust in plain language", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /왜 이 상품을 추천했나요\?/);
  assert.doesNotMatch(modal, /왜 이걸 추천했나요\?/);
  assert.match(modal, /recommendationFeatureCards/);
  assert.match(modal, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(modal, /createPortal/);
  assert.match(modal, /const \[portalRoot, setPortalRoot\] = useState<HTMLElement \| null>\(null\)/);
  assert.match(modal, /setPortalRoot\(document\.body\)/);
  assert.match(modal, /aria-haspopup="dialog"/);
  assert.match(modal, /aria-label="추천 이유 자세히 보기"/);
  assert.match(modal, /recommendation-reason-dialog fixed left-1\/2 top-1\/2/);
  assert.match(modal, /-translate-x-1\/2 -translate-y-1\/2/);
  assert.match(modal, /max-h-\[min\(82dvh,640px\)\]/);
  assert.match(modal, /max-h-\[calc\(min\(82dvh,640px\)-74px\)\]/);
  assert.match(modal, /@keyframes recommendationReasonSettle/);
  assert.match(modal, /transform: translate\(-50%, calc\(-50% \+ 10px\)\)/);
  assert.match(modal, /animation: recommendationReasonSettle 130ms ease-out/);
  assert.match(modal, /setOpen\(true\)/);
  assert.match(modal, /setOpen\(false\)/);
  assert.doesNotMatch(modal, /recommendation-reason-dialog fixed left-1\/2 top-\[72px\]/);
  assert.match(modal, /시세보다/);
  assert.match(modal, /비용 차감 통과/);
  assert.match(modal, /회전/);
  assert.match(modal, /오늘 유입 많음/);
  assert.match(modal, /좋은 점/);
  assert.match(modal, /확인할 점/);
  assert.match(modal, /계산 기준 보기/);
  assert.match(modal, /셀러 후기/);
  assert.match(modal, /사용감은 같은 등급 시세에 반영/);
  assert.match(modal, /상태가 다른 매물을 섞어 시세를 부풀리지 않아요/);
  assert.doesNotMatch(modal, /const reasons: \{ icon: ReactNode; title: string; body: string \}\[\]/);
  assert.doesNotMatch(modal, /recommendationReasonSettle[\s\S]*scale\(0\.98\)/);
  assert.doesNotMatch(modal, /같은 모델로 묶었어요/);
  assert.doesNotMatch(modal, /비용을 빼고 계산했어요/);
  assert.doesNotMatch(modal, />\s*band \{card\.band\}/);
});

test("/me modal keeps market evidence compact before the graph on mobile", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const graphIndex = modal.indexOf("<MarketHistoryChart");
  const trustIndex = modal.indexOf("<MarketGraphTrustLine");
  const comparableIndex = modal.indexOf("<ComparableListingsPanel card={card} mode={mode} />");

  assert.match(modal, /compactSourceLabel/);
  assert.match(modal, /표본 \{market\.sampleCount\.toLocaleString/);
  assert.match(modal, /신뢰 \{confidenceLabel\}/);
  assert.match(modal, /data-detail-market-graph-before-comparables/);
  assert.match(modal, /hidden sm:inline-flex/);
  assert.match(modal, /그래프 기준 보기/);
  assert.ok(graphIndex >= 0 && trustIndex > graphIndex);
  assert.ok(comparableIndex > graphIndex);
});

test("/me market graph labels Bunjang-sourced prices explicitly", () => {
  const chart = source("src/components/market-history-chart.tsx");

  assert.match(chart, /번개장터 시세 30일 추이/);
  assert.match(chart, /번개장터 호가/);
  assert.match(chart, /번개장터 거래가/);
  assert.match(chart, /번개장터 거래 0건 — 호가 추정/);
  assert.match(chart, /다나와 · 번개 미개봉 추이/);
  assert.match(chart, /번개 미개봉 호가/);
  assert.match(chart, /번개 미개봉 거래가/);
});

test("/me reveal profit block stays compact so the graph remains visible", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.doesNotMatch(modal, /border-l-\[3px\]/);
  assert.match(modal, /text-lg font-black leading-tight tabular-nums sm:text-sm sm:font-bold/);
  assert.match(modal, /text-\[#00a862\] dark:text-\[#5dffae\]/);
  assert.match(modal, /text-\[13px\] font-black tabular-nums/);
  assert.doesNotMatch(dashboard, /shadow-\[inset_3px_0_0_#00c471\]/);
  assert.match(dashboard, /sm:border-emerald-200\/80 sm:bg-emerald-50\/35/);
  assert.match(dashboard, /text-\[15px\] font-black tabular-nums text-\[#00a862\][\s\S]*sm:text-sm sm:font-bold/);
  assert.match(modal, /gap-x-1\.5 gap-y-0\.5 text-\[13px\] font-bold tabular-nums/);
  assert.doesNotMatch(modal, /text-xl font-black leading-tight tabular-nums sm:text-2xl/);
  assert.match(modal, /line-clamp-2 text-\[17px\] font-black leading-6/);
  assert.doesNotMatch(modal, /text-lg font-bold leading-tight tabular-nums sm:text-xl/);
  assert.doesNotMatch(modal, /text-base font-semibold leading-tight tabular-nums/);
  assert.doesNotMatch(modal, /text-sm font-bold leading-tight tabular-nums sm:text-base/);
  assert.doesNotMatch(modal, /text-2xl font-black tabular-nums/);
  assert.doesNotMatch(modal, /border-emerald-200\/85 bg-emerald-50\/35/);
});

test("/me mobile product feed uses dense rows with larger thumbnails", () => {
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(dashboard, /grid-cols-\[118px_minmax\(0,1fr\)\]/);
  assert.match(dashboard, /sm:grid-cols-\[76px_minmax\(0,1fr\)\]/);
  assert.match(dashboard, /border-x-0 border-t-0 border-b/);
  assert.match(dashboard, /sizes="\(max-width: 639px\) 118px, 76px"/);
  assert.match(dashboard, /line-clamp-2/);
  assert.doesNotMatch(dashboard, /sm:shadow-\[inset_3px_0_0_#00c471\]/);
});

test("/me mobile reveal card keeps safety signals out of the middle content", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const reasonIndex = modal.indexOf("function RecommendationReasonPanel");
  const revealIndex = modal.indexOf("function RevealCardItem");
  const footerIndex = modal.indexOf("function GuidePreviewPanel", revealIndex);
  const revealSection = modal.slice(revealIndex, footerIndex);
  const mobileSignalIndex = modal.indexOf("<VerdictBadgesMini card={card} />", reasonIndex);
  const desktopSignalIndex = modal.indexOf("<VerdictBadgesMini card={card} />", revealIndex);

  assert.ok(reasonIndex >= 0 && revealIndex > reasonIndex);
  assert.ok(!(mobileSignalIndex > reasonIndex && mobileSignalIndex < revealIndex));
  assert.ok(desktopSignalIndex > revealIndex);
  assert.doesNotMatch(modal, /function ProductSafetyPanel/);
  assert.doesNotMatch(modal, /<ProductSafetyPanel card=\{card\}/);
  assert.match(modal, /const safetyScore = buildRiskScore\(revealRiskScoreInput\(card\)\)/);
  assert.match(modal, /triggerLabel=\{safetyScore\.label\}/);
  assert.doesNotMatch(revealSection, /grid-cols-\[104px_minmax/);
  assert.match(modal, /function RevealProductImage/);
  assert.match(modal, /left-1\/2 h-\[145px\] w-screen -translate-x-1\/2/);
  assert.match(modal, /sm:left-auto sm:mx-0 sm:h-\[132px\] sm:w-\[132px\] sm:translate-x-0/);
  assert.match(modal, /rounded-none/);
  assert.match(modal, /p-0 sm:p-2/);
  assert.match(modal, /scale-\[1\.08\] rounded-none object-contain object-center/);
  assert.match(modal, /sm:scale-100 sm:rounded-md/);
  assert.doesNotMatch(modal, /rounded-none object-cover object-center/);
  assert.match(modal, /aria-label="상품 사진 크게 보기"/);
  assert.match(modal, />\s*크게 보기\s*<\/button>/);
  assert.match(modal, /createPortal\(largePreview, document\.body\)/);
  assert.match(modal, /max-h-\[88dvh\] w-full max-w-3xl/);
  assert.match(modal, /hidden text-xs font-semibold leading-5/);
  assert.match(modal, /추가 신호 \{hiddenMobileCount\}개/);
  assert.match(modal, /bg-\[#00c471\]/);
  assert.match(modal, /text-sm font-black text-white/);
  assert.match(modal, /min-w-0 flex-1/);
  assert.doesNotMatch(modal, /mt-2 w-full border-l-\[3px\]/);
  assert.doesNotMatch(modal, /mt-2 w-full rounded-lg border px-2\.5 py-1\.5/);
  assert.match(modal, /mt-1\.5 w-full px-0 py-0/);
  assert.doesNotMatch(modal, /<ConditionChip conditionClass=\{card\.marketBasis\?\.conditionClass \?\? null\} showHelp \/>/);
  assert.doesNotMatch(modal, /hidden sm:block[\s\S]*<RevealRiskScoreMini card=\{card\} \/>/);
  assert.doesNotMatch(modal, /<RevealRiskScoreMini card=\{card\} \/>/);
  assert.match(modal, /hidden sm:block[\s\S]*<MarketBasisMini card=\{card\} \/>/);
});

test("/me reveal detail removes nested card frames on narrow screens", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /order-1 grid gap-3 overflow-hidden rounded-none border-0 bg-transparent p-0 shadow-none ring-0/);
  assert.match(modal, /sm:rounded-2xl sm:border sm:border-\[#dfd6c9\]/);
  assert.match(modal, /rounded-none border-0 bg-transparent p-0 shadow-none dark:bg-transparent sm:rounded-2xl/);
  assert.match(modal, /className="mt-2 border-t border-\[#e1dacd\] pt-2 sm:rounded-xl/);
});

test("/me reveal detail behaves like a full-screen page on mobile", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(modal, /h-dvh max-h-dvh/);
  assert.match(modal, /z-\[90\]/);
  assert.match(modal, /rounded-none border-0/);
  assert.match(modal, /sm:max-h-\[88vh\]/);
  assert.match(modal, /sm:rounded-2xl sm:border/);
  assert.match(modal, /px-2\.5 py-1\.5/);
  assert.match(modal, /overflow-y-auto px-0 pb-3 pt-0 sm:p-4/);
  assert.match(modal, /min-w-0 w-full space-y-2\.5 px-3 sm:px-0/);
  assert.match(modal, /order-2 mx-3 space-y-2 rounded-2xl/);
  assert.match(modal, /flex min-h-8 items-center/);
  assert.match(modal, /-mx-\[10px\] mt-1 grid grid-cols-2 overflow-hidden bg-\[#d9e1d6\]/);
  assert.match(modal, /min-h-\[62px\] border-0 px-3 py-2 shadow-none sm:min-h-\[62px\] sm:rounded-lg sm:border/);
  assert.match(modal, /text-xs font-black text-zinc-500/);
  assert.match(modal, /text-\[17px\] font-black leading-5/);
  assert.match(modal, /text-xs font-bold text-zinc-500/);
  assert.doesNotMatch(modal, /gap-0\.5 sm:mx-0/);
  assert.match(modal, /reviewCount >= 100/);
  assert.match(modal, /reviewCount >= 30/);
  assert.match(modal, /reviewCount >= 10/);
  assert.match(modal, /reviewCount >= 10\) \{/);
  assert.match(modal, /후기 수 충분/);
  assert.doesNotMatch(modal, /후기 수 충분 · 근거 보기/);
  assert.doesNotMatch(modal, /차단 필터 통과 · 근거 보기/);
  assert.doesNotMatch(modal, /확인 포인트 있음 · 근거 보기/);
  assert.match(modal, /후기 적음/);
  assert.match(modal, /safety\.badge/);
  assert.doesNotMatch(modal, /grid grid-cols-\[auto_minmax\(0,1fr\)\] items-center/);
  assert.match(modal, /inline-flex shrink-0 items-center gap-1 whitespace-nowrap/);
  assert.match(modal, /flex min-w-0 items-center justify-between gap-1 text-xs font-bold/);
  assert.match(modal, /min-w-0 truncate/);
  assert.match(modal, /shrink-0 text-\[10px\] font-black text-zinc-400/);
  assert.match(modal, /aria-label="상세 닫기"/);
  assert.match(modal, />←<\/span>/);
  assert.doesNotMatch(modal, />\s*추천 상세\s*<\/div>/);
  assert.match(modal, /min-w-0 flex-1" aria-hidden="true"/);
  assert.match(modal, /inline-flex h-9 shrink-0 items-center rounded-xl bg-\[var\(--brand-accent-strong\)\] px-3/);
  assert.match(modal, />\s*대시보드\s*<\/button>/);
  assert.doesNotMatch(modal, /득템잡이 홈으로 이동/);
  assert.doesNotMatch(modal, /<span className="sm:hidden">뒤로<\/span>/);
  assert.match(dashboard, /REVEAL_DETAIL_QUERY_KEY = "reveal"/);
  assert.match(dashboard, /window\.history\.pushState\(\{ minyoiRevealPid: item\.pid \}/);
  assert.match(dashboard, /window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(dashboard, /window\.history\.back\(\)/);
});

test("/me reveal detail clears light gradients in dark mode", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");

  assert.match(modal, /rgba\(255,253,249,0\.22\),rgba\(238,231,218,0\.30\)\)\] dark:bg-none dark:bg-zinc-950\/20/);
  assert.match(modal, /#f8fcf5_0%,#eef7eb_100%\)\] sm:p-3\.5[\s\S]*sm:dark:bg-none sm:dark:bg-emerald-950\/20/);
  assert.match(modal, /#fffdf9_0%,#fbf6ee_100%\)\] sm:p-3[\s\S]*sm:dark:bg-none sm:dark:bg-zinc-900/);
  assert.match(modal, /#fffdf9_0%,#fbf7ef_100%\)\] p-3[\s\S]*dark:bg-none dark:bg-zinc-900/);
});

test("/me reveal detail keeps Bunjang fixed while sibling listings stay cached and list-shaped", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const riskScore = source("src/lib/risk-score.ts");
  const relatedIndex = modal.indexOf("<RelatedRevealStrip");
  const footerIndex = modal.indexOf("<ModalActionFooter", relatedIndex);
  const fixedCtaIndex = modal.indexOf("<FixedBunjangFooter", footerIndex);

  assert.match(modal, /function RelatedRevealStrip/);
  assert.match(modal, /function FixedBunjangFooter/);
  assert.match(modal, /내 다른 추천 매물/);
  assert.match(modal, /매입가 · 시세 · 상태를 같이 보고/);
  assert.match(modal, /mx-3 rounded-2xl border border-\[#e7dece\] bg-\[#fffdf9\] px-3 py-3/);
  assert.match(modal, /grid-cols-\[92px_minmax\(0,1fr\)\]/);
  assert.match(modal, /rounded-xl px-1\.5 py-3 text-left/);
  assert.match(modal, /매입 <b className="font-black tabular-nums/);
  assert.match(modal, /시세 <b className="font-black tabular-nums/);
  assert.match(modal, /<ConditionPhotoBadge conditionClass=\{item\.marketBasis\?\.conditionClass \?\? null\} compact \/>/);
  assert.match(modal, /상태 재확인/);
  assert.match(modal, /grid-cols-\[minmax\(0,0\.86fr\)_minmax\(0,1\.18fr\)\]/);
  assert.match(modal, /triggerLabel=\{safetyScore\.label\}/);
  assert.match(modal, /fixedSafetyCtaClass\(safetyScore\.tone\)/);
  assert.match(riskScore, /if \(tone === "safe"\) return "안전"/);
  assert.match(riskScore, /return `주의 \$\{hitCount\}건`/);
  assert.match(riskScore, /return `위험 \$\{hitCount\}건`/);
  assert.match(modal, /hideChevron/);
  assert.match(modal, /portalDetail/);
  assert.match(modal, /containerClassName="flex w-full min-w-0"/);
  assert.match(modal, /triggerClassName=\{fixedSafetyCtaClass\(safetyScore\.tone\)\}/);
  assert.match(modal, /번개장터에서 확인하기/);
  assert.match(modal, /매입가 · 시세 · 상태를 같이 보고/);
  assert.match(modal, /className="mt-2 divide-y divide-\[#eee5d8\]/);
  assert.match(modal, /className="group grid w-full min-w-0 grid-cols-\[92px_minmax/);
  assert.match(modal, /sizes="104px"/);
  assert.doesNotMatch(modal, /pb-24[\s\S]*sm:pb-28/);
  assert.match(modal, /overflow-y-auto px-0 pb-3 pt-0 sm:p-4/);
  assert.match(modal, /useLayoutEffect/);
  assert.match(modal, /const scrollAreaRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(modal, /const activeRevealPid = result\?\.result === "success" \? result\.reveals\[0\]\?\.pid \?\? null : null/);
  assert.match(modal, /function RelatedRevealStrip\(\{[\s\S]*onBeforeOpenRelatedItem/);
  assert.match(modal, /onBeforeOpenRelatedItem\?\.\(\);\s*onOpenRelatedItem\(item\.pid\)/);
  assert.match(modal, /const resetDetailScroll = useCallback/);
  assert.match(modal, /node\.scrollTop = 0/);
  assert.match(modal, /node\.scrollTo\(\{ top: 0, behavior \}\)/);
  assert.match(modal, /window\.requestAnimationFrame\(\(\) => resetDetailScroll\("auto"\)\)/);
  assert.match(modal, /key=\{activeRevealPid \?\? "empty"\}/);
  assert.match(modal, /onBeforeOpenRelatedItem=\{\(\) => resetDetailScroll\("auto"\)\}/);
  assert.match(modal, /ref=\{scrollAreaRef\}/);
  assert.ok(relatedIndex >= 0 && footerIndex > relatedIndex && fixedCtaIndex > footerIndex);
  assert.doesNotMatch(modal, /최근 검증 시점이 오래된 카드/);
  assert.doesNotMatch(modal, />\s*돌아가기\s*</);
  assert.doesNotMatch(modal, />\s*공략 보기\s*</);
  assert.doesNotMatch(modal, /onPreviewGuide/);
  assert.doesNotMatch(modal, /grid grid-cols-2 gap-2 sm:grid-cols-4/);
  assert.match(dashboard, /const relatedModalItems = selectedItem/);
  assert.match(dashboard, /price: item\.price/);
  assert.match(dashboard, /marketBasis: item\.marketBasis/);
  assert.match(dashboard, /relatedItems=\{relatedModalItems\}/);
  assert.match(dashboard, /onOpenRelatedItem=\{\(pid\) =>/);
  assert.match(dashboard, /openItem\(nextItem, "listing", \{ pushUrl: true \}\)/);
});

test("/me reveal detail hides operator memo and pushes generic disclaimer to the bottom", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const relatedIndex = modal.indexOf("<RelatedRevealStrip");
  const footerIndex = modal.indexOf("<ModalActionFooter", relatedIndex);
  const disclaimerIndex = modal.indexOf("시세 추천 유의사항", footerIndex);

  assert.doesNotMatch(modal, /검증 메모 · 추천 평가/);
  assert.doesNotMatch(modal, /매물 검증 결과 \/ 의심점 \/ 추천 품질 평가 자유 기록/);
  assert.match(modal, /<summary className="cursor-pointer list-none font-black text-\[#647064\]/);
  assert.match(modal, /AI 기반 시세 추천이며 수익을 보장하지 않습니다/);
  assert.ok(relatedIndex >= 0 && footerIndex > relatedIndex && disclaimerIndex > footerIndex);
});

test("/me shows every condition grade as a photo badge and removes duplicate plain grade chips", () => {
  const chip = source("src/components/condition-chip.tsx");
  const modal = source("src/components/pack-reveal-modal.tsx");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(chip, /export function ConditionPhotoBadge/);
  assert.match(chip, /PHOTO_BADGE_STYLES/);
  assert.match(chip, /mark: "S"/);
  assert.match(chip, /markClassName/);
  assert.match(chip, /rounded-\[10px\]/);
  assert.match(chip, /compact[\s\S]*style\.compactLabel/);
  assert.match(chip, /compact[\s\S]*whitespace-nowrap/);
  assert.match(chip, /unopened:[\s\S]*compactLabel: "미개봉"/);
  assert.match(chip, /mint:[\s\S]*compactLabel: "S급"/);
  assert.match(chip, /clean:[\s\S]*compactLabel: "A급"/);
  assert.match(chip, /normal:[\s\S]*compactLabel: "B급"/);
  assert.match(chip, /worn:[\s\S]*compactLabel: "사용감"/);
  assert.match(chip, /flawed:[\s\S]*compactLabel: "훼손"/);
  assert.match(chip, /low_batt:[\s\S]*compactLabel: "배터리"/);
  assert.match(chip, /export function UnopenedPhotoBadge/);
  assert.doesNotMatch(chip, /conditionClass !== "unopened"/);
  assert.match(modal, /import \{ ConditionPhotoBadge \}/);
  assert.match(modal, /<ConditionPhotoBadge conditionClass=\{card\.marketBasis\?\.conditionClass \?\? null\} \/>/);
  assert.doesNotMatch(modal, /ConditionChip/);
  assert.match(dashboard, /import \{ ConditionPhotoBadge \}/);
  assert.match(dashboard, /<ConditionPhotoBadge conditionClass=\{item\.marketBasis\?\.conditionClass \?\? null\} compact \/>/);
  assert.doesNotMatch(dashboard, /ConditionChip/);
});

test("/me keeps dashboard summary compact on mobile", () => {
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(dashboard, /sm:hidden/);
  assert.match(dashboard, /판매중 \{dashboardSummary\.activeCount/);
  assert.match(dashboard, /평균 \{signedKrw\(dashboardSummary\.avgProfit\)\}/);
  assert.match(dashboard, /hidden gap-2 sm:grid/);
});

test("guest main page makes masked listing titles strongly blurred", () => {
  const preview = source("src/components/preview-masked-dashboard.tsx");

  assert.match(preview, /maskedName/);
  assert.match(preview, /select-none truncate text-sm font-bold text-\[#223127\] blur-\[3px\]/);
  assert.doesNotMatch(preview, /text-\[#223127\] blur-\[1px\]/);
});

test("guest main page hides category clues and shows polished proof and budget chips", () => {
  const preview = source("src/components/preview-masked-dashboard.tsx");
  const api = source("src/app/api/preview-pool/route.ts");

  assert.doesNotMatch(preview, /CATEGORY_LABEL/);
  assert.doesNotMatch(preview, /CATEGORY_SVG/);
  assert.doesNotMatch(preview, /CATEGORY_GRADIENT/);
  assert.doesNotMatch(preview, /CategoryIcon/);
  assert.doesNotMatch(preview, /\{item\.category\}/);
  assert.match(preview, /alt="마스킹된 추천 매물"/);
  assert.match(preview, /<PackageIcon width=\{36\} height=\{36\} \/>/);
  assert.match(preview, /<ConditionPhotoBadge conditionClass=\{item\.conditionClass\} compact \/>/);
  assert.match(preview, /function priceBandLabel\(price: number\): string/);
  assert.match(preview, /if \(price <= 100_000\) return "10만원 이하"/);
  assert.match(preview, /if \(price <= 300_000\) return "10~30만원"/);
  assert.match(preview, /const budgetLabel = priceBandLabel\(item\.price\)/);
  assert.match(preview, /매입가 \{budgetLabel\}/);
  assert.match(preview, /function previewSignal\(item: PreviewItem\): PreviewSignal/);
  assert.match(preview, /후기 \$\{compactCount\(reviews\)\} 셀러/);
  assert.match(preview, /평균 \$\{daysLabel\(item\.medianHoursToSold\)\} 회전/);
  assert.match(preview, /시장 표본 \$\{compactCount\(item\.soldSampleCount\)\}건/);
  assert.match(preview, /SIGNAL_TONE_CLASS\[signal\.tone\]/);
  assert.match(api, /shop_review_rating,shop_review_count/);
  assert.match(api, /sellerReviewRating/);
  assert.match(api, /sellerReviewCount/);
});

test("/me seek-more modal starts with personalization and hides duplicate safety stats", () => {
  const meClient = source("src/components/me-dashboard-client.tsx");
  const workspace = source("src/components/recommendation-workspace.tsx");

  assert.doesNotMatch(meClient, /SafetyStatsBadge/);
  assert.doesNotMatch(meClient, /OnboardingBanner/);
  assert.match(meClient, /max-w-xl/);
  assert.match(meClient, /surface="modal"/);
  assert.match(workspace, /PERSONALIZATION_STORAGE_KEY/);
  assert.match(workspace, /type PersonalizationStep = "budget" \| "style"/);
  assert.match(workspace, /@keyframes seekStepIn/);
  assert.match(workspace, /매입 예산은 어느 정도가 편하세요/);
  assert.match(workspace, /어떤 후보를 먼저 볼까요/);
  assert.match(workspace, /질문 \{stepIndex\} \/ 2/);
  assert.match(workspace, /150만원 이하/);
  assert.match(workspace, /상한 없음/);
  assert.match(workspace, /맥북·프로 라인 포함/);
  assert.match(workspace, /빨리 팔릴 것/);
  assert.match(workspace, /수익 우선/);
  assert.match(workspace, /다음 질문/);
  assert.match(workspace, /조건 저장하고 추천 수 고르기/);
  assert.match(workspace, /surface=\{surface\}/);
  assert.match(workspace, /isModalSurface \? "w-full"/);
  assert.match(workspace, /추천 상품 수만 고르면 됩니다/);
  assert.match(workspace, /고급 검색/);
  assert.match(workspace, /showAdvancedSearch \? \(/);
  assert.match(workspace, /const MIN_PRICE_MAX_MANWON = 15/);
  assert.match(workspace, /type="range" min=\{MIN_PRICE_MAX_MANWON\} max=\{MAX_PRICE_MAX_MANWON\} step=\{5\}/);
  assert.doesNotMatch(workspace, /1\. 매입 가능한 최대 예산/);
  assert.doesNotMatch(workspace, /2\. 어떤 스타일인가요/);
  assert.doesNotMatch(workspace, /프로필을 고르고 세부 조건은 슬라이더로 조정합니다/);
});

test("pack open applies seek-more filters on the actual reveal path", () => {
  const workspace = source("src/components/recommendation-workspace.tsx");
  const openRoute = source("src/app/api/packs/open/route.ts");
  const packOpen = source("src/lib/pack-open.ts");

  assert.match(workspace, /categories: advancedFilters\.categories/);
  assert.match(workspace, /setLastRequest\(\{ pack, requestedCards, tokenCost, filters: filters \?\? null \}\)/);
  assert.match(workspace, /openPack\(lastRequest\.pack, lastRequest\.requestedCards, lastRequest\.filters\)/);
  assert.match(openRoute, /const filters = parseFilters\(payload\)/);
  assert.match(openRoute, /filters,\s*\n\s*tokensSpent/);
  assert.match(packOpen, /function candidateMatchesOpenFilters/);
  assert.match(packOpen, /const MIN_ADVANCED_PRICE_MAX_MANWON = 15/);
  assert.match(packOpen, /Math\.max\(MIN_ADVANCED_PRICE_MAX_MANWON, rawPriceMaxManwon\)/);
  assert.match(packOpen, /meta\.price\) > criteria\.maxPriceKrw/);
  assert.match(packOpen, /candidate\.expected_profit_min\) < criteria\.minProfitKrw/);
  assert.match(packOpen, /candidate\.confidence\) < criteria\.minConfidence/);
  assert.match(packOpen, /criteria\.categories\.has\(category\)/);
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

test("saved money counter includes inaccurate report token compensation", () => {
  const route = source("src/app/api/packs/me/saved-money/route.ts");
  const counter = source("src/components/saved-money-counter.tsx");

  assert.match(route, /COMPENSATION_FEEDBACK_TYPES = \["loss_report", "inaccurate_report"\]/);
  assert.match(route, /feedback_type=in\.\(\$\{COMPENSATION_FEEDBACK_TYPES\.join\(","\)\}\)/);
  assert.match(counter, /신고 보상 토큰/);
  assert.doesNotMatch(counter, /손해 보상 토큰/);
});

test("/me does not render saved money or monthly earned counters", () => {
  const meClient = source("src/components/me-dashboard-client.tsx");

  assert.doesNotMatch(meClient, /SavedMoneyCounter/);
  assert.doesNotMatch(meClient, /saved-money-counter/);
});

test("/me delete action soft-hides reveals without deleting feedback history", () => {
  const deleteRoute = source("src/app/api/packs/reveals/delete/route.ts");
  const meRoute = source("src/app/api/packs/me/route.ts");
  const migration = source("supabase/migrations/20260518103130_pack_reveals_soft_hide.sql");
  const schema = source("supabase/schema.sql");

  assert.match(deleteRoute, /method:\s*"PATCH"/);
  assert.match(deleteRoute, /hidden_at/);
  assert.match(deleteRoute, /hidden_reason/);
  assert.doesNotMatch(deleteRoute, /mvp_reveal_feedback[\s\S]*method:\s*"DELETE"/);
  assert.match(meRoute, /hidden_at=is\.null/);
  assert.match(migration, /add column if not exists hidden_at/);
  assert.match(migration, /mvp_pack_reveals_visible_user_idx/);
  assert.match(schema, /hidden_at timestamptz/);
});

test("/me modal exposes transaction state feedback actions", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const feedbackRoute = source("src/app/api/packs/reveals/feedback/route.ts");
  const migration = source("supabase/migrations/20260518103520_reveal_feedback_transaction_states.sql");
  const packOpen = source("src/lib/pack-open.ts");
  const meRoute = source("src/app/api/packs/me/route.ts");

  assert.match(modal, /거래 상태/);
  assert.match(modal, /문의했어요/);
  assert.match(modal, /매수했어요/);
  assert.match(modal, /포기했어요/);
  assert.match(dashboard, /currentFeedbackType=\{\s*selectedItem\?\.transactionFeedbackType/);
  assert.match(dashboard, /거래 상태 · \{TRANSACTION_FEEDBACK_LABEL/);
  assert.match(feedbackRoute, /"contacted"/);
  assert.match(feedbackRoute, /"passed"/);
  assert.match(migration, /'contacted'/);
  assert.match(migration, /'passed'/);
  assert.match(packOpen, /\| "contacted"/);
  assert.match(packOpen, /\| "passed"/);
  assert.match(meRoute, /contacted: 65/);
  assert.match(meRoute, /passed: 35/);
});

test("/me modal supports post-buy follow-up states", () => {
  const modal = source("src/components/pack-reveal-modal.tsx");
  const feedbackRoute = source("src/app/api/packs/reveals/feedback/route.ts");
  const migration = source("supabase/migrations/20260518103853_reveal_feedback_post_buy_states.sql");
  const packOpen = source("src/lib/pack-open.ts");
  const meRoute = source("src/app/api/packs/me/route.ts");

  assert.match(modal, /매수 후 진행/);
  assert.match(modal, /검수 완료/);
  assert.match(modal, /판매 등록/);
  assert.match(modal, /판매 완료/);
  assert.match(feedbackRoute, /"inspected"/);
  assert.match(feedbackRoute, /"listed"/);
  assert.match(feedbackRoute, /"resold"/);
  assert.match(migration, /'inspected'/);
  assert.match(migration, /'listed'/);
  assert.match(migration, /'resold'/);
  assert.match(packOpen, /\| "inspected"/);
  assert.match(packOpen, /\| "listed"/);
  assert.match(packOpen, /\| "resold"/);
  assert.match(meRoute, /resold: 76/);
  assert.match(meRoute, /listed: 74/);
  assert.match(meRoute, /inspected: 72/);
});

test("/me keeps report feedback separate from transaction progress", () => {
  const meRoute = source("src/app/api/packs/me/route.ts");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(meRoute, /TRANSACTION_FEEDBACK_PRIORITY/);
  assert.match(meRoute, /REPORT_FEEDBACK_PRIORITY/);
  assert.match(meRoute, /transactionFeedbackByPid/);
  assert.match(meRoute, /reportFeedbackByPid/);
  assert.match(meRoute, /transactionFeedbackType:/);
  assert.match(meRoute, /reportFeedbackType:/);
  assert.match(dashboard, /applyFeedbackState/);
  assert.match(dashboard, /reportFeedbackType/);
  assert.match(dashboard, /alreadyReportedLoss=\{selectedItem\?\.reportFeedbackType === "inaccurate_report"/);
  assert.doesNotMatch(dashboard, /피드백: \{item\.feedbackType\}/);
});

test("report compensation is granted by admin approval, not immediately", () => {
  const inaccurateReport = source("src/app/api/packs/reveals/inaccurate-report/route.ts");
  const lossReport = source("src/app/api/packs/reveals/loss-report/route.ts");
  const adminRoute = source("src/app/api/admin/loss-reports/route.ts");
  const adminClient = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/loss-reports/loss-reports-client.tsx");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const migration = source("supabase/migrations/20260518105624_admin_report_compensation_review.sql");
  const schema = source("supabase/schema.sql");

  assert.doesNotMatch(inaccurateReport, /refundUserCredits/);
  assert.doesNotMatch(lossReport, /refundUserCredits/);
  assert.match(inaccurateReport, /compensation_granted_tokens: 0/);
  assert.match(lossReport, /compensation_granted_tokens: 0/);
  assert.match(inaccurateReport, /pendingCompensationTokens: COMPENSATION_TOKENS/);
  assert.match(lossReport, /pendingCompensationTokens: COMPENSATION_TOKENS/);
  assert.match(adminRoute, /rpcUrl\("review_mvp_reveal_feedback_report"\)/);
  assert.match(adminRoute, /p_compensation_tokens: REPORT_COMPENSATION_TOKENS/);
  assert.match(adminRoute, /or=\(admin_status\.is\.null,admin_status\.eq\.pending\)/);
  assert.match(adminClient, /승인하고 토큰 지급/);
  assert.match(dashboard, /승인되면 토큰 \+\{lossReportResult\.pendingCompensation\}개 지급/);
  assert.match(migration, /for update/);
  assert.match(migration, /balance = balance \+ v_grant/);
  assert.match(migration, /compensation_granted_tokens/);
  assert.match(schema, /review_mvp_reveal_feedback_report/);
});
