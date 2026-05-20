// Wave 266b (2026-05-20): 번개장터 API deep sweep — 우리 catalog의 fashion SKU 학습용.
//
// 사용자 명령 (Wave 266 1차 미완):
//   "db sweep이 아니라 번개장터 api deep sweep하고 우리 있는 sku, lane 학습용
//    카탈로그 보강 및 파서 강화 학습 하라했는데"
//
// 차이:
//   - Wave 266 (1차): mvp_raw_listings DB sweep — 이미 fetch된 매물만 검사
//   - Wave 266b: 번개장터 API 직접 호출 — fresh live 풀에서 우리 SKU 검증
//
// 학습 흐름:
//   1. catalog 의 fashion (shoe/clothing/bag) SKU 추출
//   2. SKU 별 search query (brand + model name) → searchPage(query, page=0, n=96)
//   3. 각 매물 ruleMatch + parser 적용 → 3가지 결과:
//      - TP (true positive): 이 SKU로 매칭
//      - SKU_mismatch: 다른 SKU로 매칭 (broad catalog contamination 가능)
//      - unmatched: 어떤 SKU도 매칭 X (catalog 누락)
//   4. unmatched 매물 frequent token 분석 → 새 keyword 후보
//   5. type_unknown 매물 → parser regex 누락 keyword 후보
//   6. 결과를 docs/AUDIT_LOG 에 학습용 JSON report 저장.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";
import { CATALOG, ruleMatch, type Sku } from "@/lib/catalog";
import { parseFashionMobility } from "@/lib/parsers/wave92-fashion-mobility";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const FASHION_CATEGORIES = new Set(["shoe", "clothing", "bag"]);

type PerSkuResult = {
  skuId: string;
  brand: string;
  modelName: string;
  category: string;
  query: string;
  fetched: number;
  tp: number; // 매물 N건 중 이 SKU로 매칭
  spread: Record<string, number>; // 어떤 SKU로 다 매칭됐는지 (skuId -> count)
  unmatched: number;
  typeUnknown: number;
  unmatchedSamples: string[];
  typeUnknownSamples: string[];
  spreadSamples: Record<string, string[]>; // 다른 SKU 매칭 sample 1-2개
};

// SKU → search query 변환.
// Wave 267 보강 — Jordan 같은 narrow SKU 들이 "Nike Air" query 사용해서 TP 0% 되던 문제 fix.
//   ① searchQueries override → 박혀있으면 그것 사용
//   ② Korean alias 중 가장 specific (5자+) → 우선 사용
//   ③ Korean modelName 추출 → 가장 informative
//   ④ fallback: full English modelName (괄호 제거)
function pickQuery(sku: Sku): string | null {
  if (sku.searchQueries && sku.searchQueries.length > 0) {
    return sku.searchQueries[0];
  }
  // alias 중 한글 5자+ 가장 specific
  const longKoAliases = sku.aliases.filter((a) => /[가-힣]/.test(a) && a.length >= 5);
  if (longKoAliases.length > 0) {
    return longKoAliases.sort((a, b) => b.length - a.length)[0];
  }
  // model name 전체 추출 (괄호 안 제거)
  if (sku.modelName) {
    // "Air Jordan 1 High (Chicago Lost and Found)" → "Air Jordan 1 High Chicago Lost and Found"
    const cleaned = sku.modelName.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
    // brand 이미 modelName 에 포함된 경우 중복 제거
    if (cleaned.toLowerCase().includes(sku.brand.toLowerCase().split(" ")[0])) {
      return cleaned;
    }
    return `${sku.brand} ${cleaned}`.trim();
  }
  // 짧은 한글 alias fallback
  const koAliases = sku.aliases.filter((a) => /[가-힣]/.test(a));
  if (koAliases.length > 0) {
    return koAliases.sort((a, b) => b.length - a.length)[0];
  }
  return null;
}

// frequent token 추출 — name 텍스트에서 brand/model 토큰 후 noise 제거.
const STOP_TOKENS = new Set([
  "", "정품", "신상", "새상품", "새 상품", "미개봉", "미사용", "택제거", "택달림",
  "팝니다", "급처", "할인", "특가", "가격인하", "거의새것", "거의 새것",
  "사이즈", "사이즈mm", "신발", "운동화", "가방", "옷", "의류",
  "남성", "여성", "남자", "여자", "남여", "공용", "유니섹스",
  "free", "size", "mm", "cm", "kg",
  // 사이즈 / 색상 일반
  "블랙", "화이트", "그레이", "네이비", "베이지", "브라운", "레드", "그린", "옐로우", "오렌지", "퍼플", "핑크", "민트",
  "black", "white", "grey", "gray", "navy", "beige", "brown", "red", "green", "yellow", "orange", "purple", "pink", "mint",
  "라지", "미디움", "스몰", "large", "medium", "small", "xl", "xs", "xxl",
]);

function extractTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[()[\]\\/.,!?:;|"'`~@#$%^&*+=<>]/g, " ")
    .split(/\s+/)
    .filter((t) => {
      if (t.length < 2) return false;
      if (STOP_TOKENS.has(t)) return false;
      if (/^\d+$/.test(t)) return false; // 숫자 단독 제외 (사이즈)
      return true;
    });
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function diagnoseSku(sku: Sku): Promise<PerSkuResult | null> {
  const query = pickQuery(sku);
  if (!query) return null;

  // page 0, n=96 — fresh score 순.
  let items: SearchItem[] = [];
  try {
    items = await searchPage(query, 0, { order: "score", limit: 96 });
  } catch {
    return null;
  }
  if (items.length === 0) return null;

  const result: PerSkuResult = {
    skuId: sku.id,
    brand: sku.brand,
    modelName: sku.modelName,
    category: sku.category,
    query,
    fetched: items.length,
    tp: 0,
    spread: {},
    unmatched: 0,
    typeUnknown: 0,
    unmatchedSamples: [],
    typeUnknownSamples: [],
    spreadSamples: {},
  };

  for (const item of items) {
    const matched = ruleMatch(item.name, "");
    if (matched) {
      if (matched.id === sku.id) {
        result.tp += 1;
      } else {
        result.spread[matched.id] = (result.spread[matched.id] ?? 0) + 1;
        const arr = result.spreadSamples[matched.id] ?? [];
        if (arr.length < 2) arr.push(item.name);
        result.spreadSamples[matched.id] = arr;
      }
    } else {
      result.unmatched += 1;
      if (result.unmatchedSamples.length < 10) result.unmatchedSamples.push(item.name);
    }

    // parser 적용 — type 추출 정확도 검증.
    // Wave 267 보강: field name 카테고리별 정확 추출 (shoe_product_type / bag_product_type / clothing_product_type)
    if (FASHION_CATEGORIES.has(sku.category)) {
      try {
        const parsed = parseFashionMobility({
          title: item.name,
          description: "",
          category: sku.category,
          skuId: sku.id,
          skuName: sku.modelName,
          bunjangConditionLabel: null,
          defaultProductType: sku.defaultProductType,
        });
        const fieldName = `${sku.category}_product_type`;
        const productType = (parsed?.json as Record<string, unknown> | undefined)?.[fieldName] as string | undefined;
        if (!productType || productType === "type_unknown") {
          result.typeUnknown += 1;
          if (result.typeUnknownSamples.length < 10) result.typeUnknownSamples.push(item.name);
        }
      } catch {
        // parser error — skip
      }
    }
  }

  return result;
}

async function main() {
  const fashionSkus = CATALOG.filter((sku) => FASHION_CATEGORIES.has(sku.category));
  console.log(`총 fashion SKU: ${fashionSkus.length}`);

  const results: PerSkuResult[] = [];
  let i = 0;
  for (const sku of fashionSkus) {
    i += 1;
    if (i % 10 === 0) console.log(`  [${i}/${fashionSkus.length}] ${sku.id}`);
    const r = await diagnoseSku(sku);
    if (r) results.push(r);
    await sleep(250); // throttle — API 부담 방지
  }

  // 학습용 분석:
  // 1. unmatched 매물 frequent token aggregate (catalog 누락 후보)
  const unmatchedTokenCount = new Map<string, number>();
  // 2. spread (broad SKU contamination)
  const broadContamination = new Map<string, { count: number; samples: Set<string> }>();
  // 3. type_unknown samples (parser 누락 후보)
  const typeUnknownTokens = new Map<string, number>();

  for (const r of results) {
    for (const sample of r.unmatchedSamples) {
      for (const t of extractTokens(sample)) {
        unmatchedTokenCount.set(t, (unmatchedTokenCount.get(t) ?? 0) + 1);
      }
    }
    for (const [matchedSkuId, count] of Object.entries(r.spread)) {
      const existing = broadContamination.get(matchedSkuId) ?? { count: 0, samples: new Set<string>() };
      existing.count += count;
      const samples = r.spreadSamples[matchedSkuId] ?? [];
      for (const s of samples) existing.samples.add(`${r.skuId} → ${matchedSkuId}: ${s}`);
      broadContamination.set(matchedSkuId, existing);
    }
    for (const sample of r.typeUnknownSamples) {
      for (const t of extractTokens(sample)) {
        typeUnknownTokens.set(t, (typeUnknownTokens.get(t) ?? 0) + 1);
      }
    }
  }

  const topUnmatchedTokens = [...unmatchedTokenCount.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);
  const topContamination = [...broadContamination.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30);
  const topTypeUnknownTokens = [...typeUnknownTokens.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSkus: fashionSkus.length,
      skusWithResults: results.length,
      totalFetched: results.reduce((s, r) => s + r.fetched, 0),
      totalTP: results.reduce((s, r) => s + r.tp, 0),
      totalUnmatched: results.reduce((s, r) => s + r.unmatched, 0),
      totalTypeUnknown: results.reduce((s, r) => s + r.typeUnknown, 0),
      avgTPRate:
        results.length > 0
          ? results.reduce((s, r) => s + (r.fetched > 0 ? r.tp / r.fetched : 0), 0) / results.length
          : 0,
    },
    topUnmatchedTokens, // catalog mustContain 후보 — 자주 unmatched 등장하는 token
    topContamination: topContamination.map(([skuId, { count, samples }]) => ({
      contaminatedSkuId: skuId,
      count,
      samples: [...samples].slice(0, 5),
    })),
    topTypeUnknownTokens, // parser regex 후보
    lowTPSkus: results
      .filter((r) => r.fetched >= 10 && r.tp / r.fetched < 0.3)
      .sort((a, b) => a.tp / a.fetched - b.tp / b.fetched)
      .slice(0, 30)
      .map((r) => ({
        skuId: r.skuId,
        brand: r.brand,
        modelName: r.modelName,
        query: r.query,
        fetched: r.fetched,
        tp: r.tp,
        tpRate: Math.round((r.tp / r.fetched) * 100),
        unmatched: r.unmatched,
        topSpread: Object.entries(r.spread)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
        unmatchedSamples: r.unmatchedSamples,
      })),
    highTypeUnknownSkus: results
      .filter((r) => r.fetched >= 10 && r.typeUnknown / r.fetched > 0.3)
      .sort((a, b) => b.typeUnknown / b.fetched - a.typeUnknown / a.fetched)
      .slice(0, 20)
      .map((r) => ({
        skuId: r.skuId,
        category: r.category,
        fetched: r.fetched,
        typeUnknown: r.typeUnknown,
        typeUnknownRate: Math.round((r.typeUnknown / r.fetched) * 100),
        typeUnknownSamples: r.typeUnknownSamples,
      })),
  };

  const outDir = path.join(appDir, "docs/AUDIT_LOG");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `2026-05-20-wave266b-bunjang-api-deep-sweep.json`);
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`✓ 저장 ${outPath}`);
  console.log(`Summary: ${report.summary.totalSkus} SKU / ${report.summary.totalFetched} 매물 / TP ${report.summary.totalTP} (${Math.round(report.summary.avgTPRate * 100)}%)`);
  console.log(`         Unmatched ${report.summary.totalUnmatched} / Type Unknown ${report.summary.totalTypeUnknown}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
