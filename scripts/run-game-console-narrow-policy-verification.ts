import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchDetail, searchPage, type SearchItem } from "../src/lib/bunjang";
import { detectSoldOut, isSoldOut } from "../src/lib/sold-out";

// 정책 (사용자 명시):
//  Switch OLED: switch_oled_base_unit_only — 본체+기본 구성만 comparable, 게임 1~2개는 AI L2/manual, 풀세트는 hard hold
//  PS5: Disc/Digital/Slim Disc/Slim Digital/Pro 별도 lane, 기본 컨트롤러 1개 포함 OK,
//       추가 컨트롤러/게임/액세서리는 AI L2/manual review
//  통합 금지: Disc↔Digital, Standard↔Slim↔Pro
//  catalog/option-parser/lane registry 변경 없음. 본 스크립트는 ad-hoc regex 자체 매칭.

type Classification =
  | "base_unit_only"
  | "review_ai_l2_manual"
  | "hard_hold"
  | "wrong_model"
  | "buying_or_fake_or_damaged";

type LaneSpec = {
  id: string;
  laneFamily: "switch_oled" | "ps5_standard_disc" | "ps5_standard_digital" | "ps5_slim_disc" | "ps5_slim_digital" | "ps5_pro";
  queries: string[];
  searchLimitPerQuery: number;
  detailCap: number;
  // 매물이 이 lane에 속하는지 확인 (wrong_model 분류)
  matchesLane: (title: string, description: string) => boolean;
  // 매물 분류 → base_unit_only / review / hard_hold / wrong_model
  classify: (title: string, description: string) => { class: Classification; reasons: string[] };
};

// ───── 공통 hard-hold 신호 (buy/fake/damaged) ─────
function commonBuyFakeDamaged(text: string): string[] {
  const reasons: string[] = [];
  if (/(삽니다|매입|구합니다|구매합니다|구매원함|매입합니다)/i.test(text)) reasons.push("buying_signal");
  if (/(가품|레플|이미테이션|짝퉁|호환\s*제품|비정품|모조)/i.test(text)) reasons.push("fake_signal");
  if (/(고장|파손|수리\s*요|침수|불량|부품용|전원\s*안|화면\s*안|소리\s*안|작동\s*안|먹통)/i.test(text)) {
    reasons.push("damaged_signal");
  }
  return reasons;
}

// ───── 게임 개수 추출 (Switch / PS5 공통) ─────
function countGameMentions(text: string): number {
  // "게임 N개", "N장", "N개 포함" 등 + 게임명 list patterns 추출 시도
  let count = 0;
  const explicitCount = text.match(/(게임|타이틀|패키지)\s*([0-9])\s*(개|장)/i);
  if (explicitCount?.[2]) count = Math.max(count, Number(explicitCount[2]));
  // 동봉 keyword 자체 — 정확한 게임 명시 없이 "게임 동봉" / "게임 포함"
  if (/(게임\s*동봉|게임\s*포함|타이틀\s*동봉|타이틀\s*포함)/i.test(text) && count === 0) count = 1;
  // 다수 게임 keyword
  if (/(다수\s*게임|여러\s*게임|게임\s*많음|타이틀\s*다수)/i.test(text)) count = Math.max(count, 3);
  return count;
}

function isFullSet(text: string): boolean {
  return /(풀세트|풀\s*세트|풀\s*패키지|풀패키지|올세트|풀\s*박스\s*\+\s*게임|풀구성)/i.test(text);
}

function isAccessoryBundle(text: string): boolean {
  return /(프로콘|프로\s*컨트롤러|pro\s*controller|충전\s*거치대|충전거치대|충전\s*독|충전독|헤드셋|이어셋|캐리\s*백|캐리백|보호\s*케이스\s*세트|스킨\s*세트|스티커|이중\s*스크린|스크린\s*보호\s*필름\s*세트)/i.test(text);
}

// ───── PS5 컨트롤러 개수 추출 ─────
function countPs5Controllers(text: string): number {
  let count = 1; // 기본 1개 가정
  // "컨트롤러 N개", "패드 N개"
  const explicitCount = text.match(/(컨트롤러|패드|듀얼센스|dualsense)\s*([0-9])\s*개/i);
  if (explicitCount?.[2]) count = Number(explicitCount[2]);
  // "추가 컨트롤러", "여분 컨트롤러", "2P", "콘트롤러 2"
  if (/(추가\s*컨트롤러|여분\s*컨트롤러|컨트롤러\s*추가|2p\b|컨트롤러\s*2개|패드\s*2개|듀얼센스\s*2)/i.test(text)) {
    count = Math.max(count, 2);
  }
  return count;
}

// ───── Switch OLED ─────
const switchOledSpec: LaneSpec = {
  id: "switch_oled_base_unit_only",
  laneFamily: "switch_oled",
  queries: [
    "닌텐도 스위치 OLED",
    "스위치 OLED",
    "Nintendo Switch OLED",
    "스위치 올레드",
    "닌텐도 OLED",
  ],
  searchLimitPerQuery: 25,
  detailCap: 30,
  matchesLane: (title, description) => {
    const t = `${title}\n${description}`.toLowerCase();
    const titleN = title.toLowerCase();
    if (!/(스위치|switch|닌텐도|nintendo)/i.test(t)) return false;
    if (!/(oled|올레드|유기\s*el|유기el)/i.test(t)) return false;
    // 잘못된 모델 차단 (Switch 2, Switch Lite, 구형 Switch)
    if (/(switch\s*2|스위치\s*2|닌텐도\s*2)/i.test(titleN)) return false;
    if (/(스위치\s*라이트|switch\s*lite|닌텐도\s*라이트)/i.test(titleN)) return false;
    return true;
  },
  classify: (title, description) => {
    const t = `${title}\n${description}`;
    const titleN = title.toLowerCase();
    const reasons: string[] = [];
    const buyFakeDamaged = commonBuyFakeDamaged(t);
    if (buyFakeDamaged.length > 0) return { class: "buying_or_fake_or_damaged", reasons: buyFakeDamaged };

    // 잘못된 모델
    if (/(switch\s*2|스위치\s*2|닌텐도\s*2)/i.test(titleN)) {
      return { class: "wrong_model", reasons: ["switch_2_not_oled"] };
    }
    if (/(스위치\s*라이트|switch\s*lite|닌텐도\s*라이트)/i.test(titleN)) {
      return { class: "wrong_model", reasons: ["switch_lite_not_oled"] };
    }
    if (!/(oled|올레드|유기\s*el|유기el)/i.test(t)) {
      return { class: "wrong_model", reasons: ["non_oled_switch"] };
    }

    // hard hold: 풀세트, 다수 게임, 프로콘/캐리백/충전거치대 번들
    if (isFullSet(t)) reasons.push("full_set_bundle");
    const games = countGameMentions(t);
    if (games >= 3) reasons.push(`multi_games_${games}`);
    if (isAccessoryBundle(t)) reasons.push("accessory_bundle");
    if (reasons.length > 0) return { class: "hard_hold", reasons };

    // review: 게임 1~2개 동봉
    if (games >= 1 && games <= 2) {
      reasons.push(`game_bundle_${games}`);
      return { class: "review_ai_l2_manual", reasons };
    }

    // 기본 구성만 OK
    return { class: "base_unit_only", reasons: [] };
  },
};

// ───── PS5 공통 분류 helper ─────
function ps5Classify(
  title: string,
  description: string,
  edition: "disc" | "digital",
  generation: "standard" | "slim" | "pro",
): { class: Classification; reasons: string[] } {
  const t = `${title}\n${description}`;
  const reasons: string[] = [];
  const buyFakeDamaged = commonBuyFakeDamaged(t);
  if (buyFakeDamaged.length > 0) return { class: "buying_or_fake_or_damaged", reasons: buyFakeDamaged };

  const titleN = title.toLowerCase();
  // 잘못된 세대
  if (generation !== "slim" && /(슬림|slim)/i.test(titleN)) {
    reasons.push("slim_signal_mismatch");
  }
  if (generation !== "pro" && /(프로|pro)\b/i.test(titleN) && !/(프로\s*컨트|pro\s*control)/i.test(titleN)) {
    reasons.push("pro_signal_mismatch");
  }
  if (generation !== "standard" && /(스탠다드|standard|일반판)/i.test(titleN)) {
    reasons.push("standard_signal_mismatch");
  }
  // 잘못된 edition
  if (edition === "digital" && /(디스크|disc|디스크\s*에디션|디스크\s*드라이브)/i.test(titleN)) {
    reasons.push("disc_signal_in_digital_lane");
  }
  if (edition === "disc" && /(디지털|digital|디지털\s*에디션)/i.test(titleN)) {
    reasons.push("digital_signal_in_disc_lane");
  }
  if (reasons.length > 0) return { class: "wrong_model", reasons };

  // hard hold: 풀세트, 다수 게임, 다수 컨트롤러
  if (isFullSet(t)) reasons.push("full_set_bundle");
  const games = countGameMentions(t);
  if (games >= 3) reasons.push(`multi_games_${games}`);
  const controllers = countPs5Controllers(t);
  if (controllers >= 3) reasons.push(`multi_controllers_${controllers}`);
  if (reasons.length > 0) return { class: "hard_hold", reasons };

  // review: 추가 컨트롤러 (2개), 게임 1~2개, 액세서리 (충전거치대, 헤드셋 등)
  if (controllers === 2) reasons.push("extra_controller");
  if (games >= 1 && games <= 2) reasons.push(`game_bundle_${games}`);
  if (isAccessoryBundle(t)) reasons.push("accessory_bundle");
  if (reasons.length > 0) return { class: "review_ai_l2_manual", reasons };

  // base
  return { class: "base_unit_only", reasons: [] };
}

function makePs5LaneSpec(
  edition: "disc" | "digital",
  generation: "standard" | "slim" | "pro",
  id: string,
  queries: string[],
): LaneSpec {
  return {
    id,
    laneFamily: `ps5_${generation}_${edition}` as LaneSpec["laneFamily"],
    queries,
    searchLimitPerQuery: 20,
    detailCap: 25,
    matchesLane: (title, description) => {
      const t = `${title}\n${description}`.toLowerCase();
      const titleN = title.toLowerCase();
      if (!/(ps5|플스5|플레이스테이션\s*5|playstation\s*5)/i.test(t)) return false;
      // generation 매칭
      if (generation === "slim" && !/(슬림|slim)/i.test(titleN)) return false;
      if (generation === "pro" && !/(프로|pro)\b/i.test(titleN)) return false;
      if (generation === "standard") {
        if (/(슬림|slim)/i.test(titleN)) return false;
        if (/(프로|pro)\b/i.test(titleN) && !/(프로\s*컨트|pro\s*control)/i.test(titleN)) return false;
      }
      // edition 매칭 (Pro는 Disc Drive 별매라 본체는 Digital base — disc 키워드가 없으면 digital base로 본다)
      if (generation === "pro") {
        // Pro lane은 본체 자체. Disc Drive는 별도 액세서리 처리
        return true;
      }
      if (edition === "digital" && /(디스크|disc)/i.test(titleN)) return false;
      if (edition === "disc" && /(디지털|digital)/i.test(titleN)) return false;
      return true;
    },
    classify: (title, description) => ps5Classify(title, description, edition, generation),
  };
}

const lanes: LaneSpec[] = [
  switchOledSpec,
  makePs5LaneSpec("disc", "standard", "ps5_disc_basic", [
    "PS5 디스크",
    "플스5 디스크",
    "PlayStation 5 Disc",
    "PS5 디스크 에디션",
    "PS5 본체 디스크",
  ]),
  makePs5LaneSpec("digital", "standard", "ps5_digital_basic", [
    "PS5 디지털",
    "플스5 디지털",
    "PlayStation 5 Digital",
    "PS5 디지털 에디션",
    "PS5 본체 디지털",
  ]),
  makePs5LaneSpec("disc", "slim", "ps5_slim_disc_basic", [
    "PS5 슬림 디스크",
    "플스5 슬림 디스크",
    "PS5 Slim Disc",
    "PS5 신형 디스크",
    "플레이스테이션 5 슬림 디스크",
  ]),
  makePs5LaneSpec("digital", "slim", "ps5_slim_digital_basic", [
    "PS5 슬림 디지털",
    "플스5 슬림 디지털",
    "PS5 Slim Digital",
    "PS5 신형 디지털",
    "플레이스테이션 5 슬림 디지털",
  ]),
  makePs5LaneSpec("digital", "pro", "ps5_pro_basic", [
    "PS5 프로",
    "플스5 프로",
    "PlayStation 5 Pro",
    "PS5 Pro",
    "플레이스테이션 5 프로",
  ]),
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function searchLane(lane: LaneSpec) {
  const collected = new Map<string, SearchItem>();
  for (const q of lane.queries) {
    await sleep(180);
    try {
      const items = await searchPage(q, 0, { order: "date", limit: lane.searchLimitPerQuery });
      for (const it of items) {
        if (!collected.has(it.pid)) collected.set(it.pid, it);
      }
    } catch (err) {
      console.warn(`[${lane.id}] search "${q}" failed:`, err instanceof Error ? err.message : err);
    }
  }
  return [...collected.values()];
}

type Verified = {
  item: SearchItem;
  detail: Awaited<ReturnType<typeof fetchDetail>>;
  classification: Classification;
  reasons: string[];
  inLane: boolean;
  sold: boolean;
};

async function verifyDetail(lane: LaneSpec, item: SearchItem): Promise<Verified> {
  await sleep(150);
  let detail = null;
  try {
    detail = await fetchDetail(item.pid);
  } catch (err) {
    console.warn(`[${lane.id}] detail ${item.pid} fetch error:`, err instanceof Error ? err.message : err);
  }
  if (!detail) {
    return { item, detail: null, classification: "wrong_model", reasons: ["detail_fetch_failed"], inLane: false, sold: false };
  }
  const description = detail.description ?? "";
  const inLane = lane.matchesLane(item.name, description);
  if (!inLane) {
    return { item, detail, classification: "wrong_model", reasons: ["not_in_target_lane"], inLane: false, sold: false };
  }
  const cls = lane.classify(item.name, description);
  const soldSignals = detectSoldOut(detail, item.price, { title: item.name });
  const sold = isSoldOut(soldSignals);
  return { item, detail, classification: cls.class, reasons: cls.reasons, inLane: true, sold };
}

function buildSummary(lane: LaneSpec, items: SearchItem[], verified: Verified[]) {
  const inLane = verified.filter((v) => v.inLane);
  const sold = inLane.filter((v) => v.sold);
  const live = inLane.filter((v) => !v.sold);
  const baseUnit = live.filter((v) => v.classification === "base_unit_only");
  const review = live.filter((v) => v.classification === "review_ai_l2_manual");
  const hardHold = live.filter((v) => v.classification === "hard_hold");
  const buyFakeDamaged = live.filter((v) => v.classification === "buying_or_fake_or_damaged");
  const wrongModel = verified.filter((v) => v.classification === "wrong_model");
  const detailFailed = verified.filter((v) => v.detail === null).length;

  const reasonCount = new Map<string, number>();
  for (const v of inLane) {
    if (v.sold) continue;
    for (const r of v.reasons) reasonCount.set(r, (reasonCount.get(r) ?? 0) + 1);
  }
  const reasonHist = [...reasonCount.entries()].sort((a, b) => b[1] - a[1]);

  const proshopCount = inLane.filter((v) => v.detail?.shopProshop || v.detail?.shopOfficialSeller).length;
  const prices = live.map((v) => v.item.price).filter((p) => p > 0).sort((a, b) => a - b);
  const median = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;
  const min = prices[0] ?? 0;
  const max = prices[prices.length - 1] ?? 0;

  const baseUnitPrices = baseUnit.map((v) => v.item.price).filter((p) => p > 0).sort((a, b) => a - b);
  const baseUnitMedian = baseUnitPrices.length > 0 ? baseUnitPrices[Math.floor(baseUnitPrices.length / 2)] : 0;

  return {
    lane: lane.id,
    laneFamily: lane.laneFamily,
    generatedAt: new Date().toISOString(),
    mode: "no_write_live_verification",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    candidatePoolPatch: false,
    catalogPatch: false,
    queries: lane.queries,
    search: {
      uniqueItems: items.length,
    },
    detail: {
      fetched: verified.length,
      fetchFailed: detailFailed,
      inLane: inLane.length,
      outOfLane: wrongModel.length,
      sold: sold.length,
      live: live.length,
      baseUnitOnly: baseUnit.length,
      reviewAiL2Manual: review.length,
      hardHold: hardHold.length,
      buyFakeDamaged: buyFakeDamaged.length,
    },
    reasonHistogram: Object.fromEntries(reasonHist),
    proshopOrOfficialCount: proshopCount,
    priceStatsLive: { count: prices.length, min, median, max },
    priceStatsBaseUnit: { count: baseUnitPrices.length, median: baseUnitMedian },
    rows: verified.map((v) => ({
      pid: v.item.pid,
      title: v.item.name,
      price: v.item.price,
      classification: v.classification,
      reasons: v.reasons,
      inLane: v.inLane,
      sold: v.sold,
      shopUid: v.detail?.shopUid ?? null,
      shopProshop: v.detail?.shopProshop ?? false,
      descPreview: (v.detail?.description ?? "").slice(0, 240),
    })),
  };
}

function statusLabel(v: Verified): string {
  if (v.detail === null) return "❓ detail_fail";
  if (!v.inLane) return "🚫 wrong_lane";
  if (v.sold) return "❌ sold";
  switch (v.classification) {
    case "base_unit_only":
      return "✅ base";
    case "review_ai_l2_manual":
      return "🤖 review";
    case "hard_hold":
      return "🚫 hold";
    case "buying_or_fake_or_damaged":
      return "🚫 buy/fake/damaged";
    case "wrong_model":
      return "🚫 wrong_model";
  }
}

function buildMarkdown(summary: ReturnType<typeof buildSummary>, verified: Verified[]) {
  const reasonRows = Object.entries(summary.reasonHistogram).map(([r, c]) => `| ${r} | ${c} |`).join("\n");
  const rowsMd = verified.map((v) => {
    const status = statusLabel(v);
    const reasons = v.reasons.join(", ") || "-";
    const title = v.item.name.length > 50 ? `${v.item.name.slice(0, 50)}…` : v.item.name;
    return `| ${v.item.pid} | ${status} | ${v.item.price.toLocaleString()} | ${reasons} | ${title} |`;
  }).join("\n");

  return `# ${summary.lane} — no-write live verification (정책 기반)

- generatedAt: ${summary.generatedAt}
- laneFamily: ${summary.laneFamily}
- mode: ${summary.mode}
- DB mutation / candidate-pool / public / catalog: false / false / false / false

## Queries (${summary.queries.length})

${summary.queries.map((q) => `- \`${q}\``).join("\n")}

## Counts

| metric | value |
| --- | ---: |
| unique items fetched | ${summary.search.uniqueItems} |
| detail fetched | ${summary.detail.fetched} |
| detail fetch failed | ${summary.detail.fetchFailed} |
| in-lane | ${summary.detail.inLane} |
| out-of-lane (wrong model/edition/generation) | ${summary.detail.outOfLane} |
| sold (in-lane) | ${summary.detail.sold} |
| live (in-lane, not sold) | ${summary.detail.live} |
| **✅ base_unit_only** | **${summary.detail.baseUnitOnly}** |
| 🤖 review (AI L2/manual) | ${summary.detail.reviewAiL2Manual} |
| 🚫 hard_hold | ${summary.detail.hardHold} |
| 🚫 buy/fake/damaged | ${summary.detail.buyFakeDamaged} |
| proshop/official seller | ${summary.proshopOrOfficialCount} |

## Reason Histogram (in-lane live)

| reason | count |
| --- | ---: |
${reasonRows || "| — | 0 |"}

## Price Stats (KRW)

- live total: count ${summary.priceStatsLive.count}, min ${summary.priceStatsLive.min.toLocaleString()}, median ${summary.priceStatsLive.median.toLocaleString()}, max ${summary.priceStatsLive.max.toLocaleString()}
- base_unit_only: count ${summary.priceStatsBaseUnit.count}, median ${summary.priceStatsBaseUnit.median.toLocaleString()}

## Verified Rows

| pid | status | price | reasons | title |
| --- | --- | ---: | --- | --- |
${rowsMd}
`;
}

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");

async function main() {
  await mkdir(REPORT_DIR, { recursive: true });
  const summaries: ReturnType<typeof buildSummary>[] = [];

  for (const lane of lanes) {
    console.log(`>>> ${lane.id} search start`);
    const items = await searchLane(lane);
    console.log(`  fetched ${items.length} unique items across ${lane.queries.length} queries`);

    const detailItems = items.slice(0, lane.detailCap);
    const verified: Verified[] = [];
    for (const item of detailItems) {
      verified.push(await verifyDetail(lane, item));
    }

    const summary = buildSummary(lane, items, verified);
    summaries.push(summary);

    await writeFile(path.join(REPORT_DIR, `${lane.id}-no-write-verification-latest.json`), JSON.stringify(summary, null, 2));
    await writeFile(path.join(REPORT_DIR, `${lane.id}-no-write-verification-latest.md`), buildMarkdown(summary, verified));

    console.log(`  wrote reports/${lane.id}-no-write-verification-latest.{json,md}`);
    console.log(`  inLane=${summary.detail.inLane}, base=${summary.detail.baseUnitOnly}, review=${summary.detail.reviewAiL2Manual}, hold=${summary.detail.hardHold}, sold=${summary.detail.sold}, wrong=${summary.detail.outOfLane}`);
  }

  console.log("\n=== summary ===");
  console.log(JSON.stringify(summaries.map((s) => ({
    lane: s.lane,
    fetched: s.detail.fetched,
    inLane: s.detail.inLane,
    baseUnitOnly: s.detail.baseUnitOnly,
    review: s.detail.reviewAiL2Manual,
    hardHold: s.detail.hardHold,
    sold: s.detail.sold,
    outOfLane: s.detail.outOfLane,
    baseUnitMedianKrw: s.priceStatsBaseUnit.median,
  })), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
