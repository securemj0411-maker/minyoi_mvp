#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CATEGORY_TREE_URL = "https://api.bunjang.co.kr/api/1/categories/list.json";
const CATEGORY_PRODUCTS_URL =
  "https://api.bunjang.co.kr/api/search/v8/pw/product/specs/category";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

const TECH_ROOT_IDS = new Set(["600", "610"]);
const DEFAULT_SAMPLE_SIZE = 30;
const DEFAULT_MAX_CATEGORIES = 48;
const ACCESSORY_CATEGORY_RE =
  /케이스|보호필름|액세서리|주변기기|케이블|충전기|가방|키보드|마우스|부품|저장장치/i;
const SAMPLE_NOISE_RE =
  /매입|삽니다|구매합니다|구매원함|출장|파손|고장|불량|부품|목업|케이스|보호필름|액세서리|충전기|케이블|스트랩|박스|가방/i;

function parseArg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  return raw.slice(prefix.length);
}

function parseIntArg(name, fallback) {
  const parsed = Number.parseInt(parseArg(name, String(fallback)), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent": USER_AGENT,
      origin: "https://m.bunjang.co.kr",
      referer: "https://m.bunjang.co.kr/",
    },
  });

  if (!response.ok) {
    throw new Error(`Bunjang request failed: ${response.status} ${url}`);
  }

  return response.json();
}

function getCategoryNodes(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.categories)) return payload.categories;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.categories)) return payload.data.categories;
  throw new Error("Unknown category tree response shape");
}

function flattenCategories(nodes, parents = []) {
  return nodes.flatMap((node) => {
    const id = String(node.id);
    const row = {
      id,
      title: node.title ?? "",
      count: Number(node.count ?? 0),
      depth: parents.length + 1,
      pathIds: [...parents.map((parent) => parent.id), id],
      pathTitles: [...parents.map((parent) => parent.title), node.title ?? ""],
      childCount: Array.isArray(node.categories) ? node.categories.length : 0,
    };

    const children = Array.isArray(node.categories)
      ? flattenCategories(node.categories, [...parents, row])
      : [];
    return [row, ...children];
  });
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower));
}

function toPrice(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number.parseInt(digits, 10);
}

function productArrayCandidates(value, arrays = []) {
  if (Array.isArray(value)) {
    const productLikeCount = value.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.pid || item.productId || item.productSeq) &&
        (item.name || item.productName || item.title),
    ).length;

    if (productLikeCount > 0) {
      arrays.push(value);
    }

    for (const item of value) productArrayCandidates(item, arrays);
    return arrays;
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      productArrayCandidates(child, arrays);
    }
  }

  return arrays;
}

function extractProducts(payload) {
  const arrays = productArrayCandidates(payload);
  const largest = arrays.sort((a, b) => b.length - a.length)[0] ?? [];
  return largest
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      pid: String(item.pid ?? item.productId ?? item.productSeq ?? ""),
      name: String(item.name ?? item.productName ?? item.title ?? ""),
      price: toPrice(item.price ?? item.productPrice ?? item.salePrice),
      status: String(item.status ?? item.saleStatus ?? item.productStatus ?? ""),
      imageUrl:
        item.productImage ??
        item.imageUrl ??
        item.product_image ??
        item.thumbnailUrl ??
        null,
      faved: Number(item.numFaved ?? item.num_faved ?? item.favoriteCount ?? item.faved ?? 0) || 0,
      shopName: item.shop?.name ?? item.shopName ?? item.sellerName ?? null,
    }))
    .filter((item) => item.pid && item.name);
}

function familyForCategory(row) {
  const pathText = row.pathTitles.join(" ");
  const checks = [
    [/일반폰|피처폰|폴더폰/i, "legacy_mobile"],
    [/휴대폰|스마트폰|아이폰|갤럭시/i, "smartphone"],
    [/태블릿|아이패드|갤럭시탭/i, "tablet"],
    [/웨어러블|워치|밴드|스마트워치|시계/i, "wearable_watch"],
    [/오디오|이어폰|헤드폰|헤드셋|스피커|음향/i, "audio"],
    [/PC\/노트북|노트북|맥북|컴퓨터|데스크탑|모니터/i, "pc_laptop"],
    [/PC부품|저장장치|SSD|그래픽카드|CPU|메모리/i, "pc_parts"],
    [/게임|콘솔|플레이스테이션|닌텐도|엑스박스/i, "game_console"],
    [/카메라|DSLR|렌즈|캠코더/i, "camera"],
    [/생활가전|청소기|공기청정|선풍기|가습기|제습기/i, "home_appliance"],
    [/주방가전|커피|전자레인지|오븐|밥솥|에어프라이어|정수기/i, "kitchen_appliance"],
    [/미용가전|드라이기|고데기|면도기|마사지/i, "beauty_appliance"],
    [/냉장고|에어컨|세탁기|건조기|TV|사무기기/i, "large_appliance"],
  ];

  return checks.find(([regex]) => regex.test(pathText))?.[1] ?? "other_tech";
}

function coverageForFamily(family) {
  if (family === "legacy_mobile") return "not_started";
  if (["smartphone", "tablet", "pc_laptop"].includes(family)) return "internal_only";
  if (["audio", "wearable_watch"].includes(family)) return "ready_partial";
  if (family.includes("appliance")) return "not_started";
  return "not_started";
}

function actionFor(row, sample) {
  const family = familyForCategory(row);
  const median = sample.priceStats.median ?? 0;
  const count = row.count;

  if (isAccessoryCategory(row) || sample.noiseRate >= 0.35 || family === "pc_parts") {
    return "observe_noisy";
  }
  if (family === "legacy_mobile") return "observe";
  if (family === "large_appliance" && median >= 300000) return "defer_logistics_heavy";
  if (count >= 15000 && median >= 70000 && family !== "other_tech") return "mine_now";
  if (count >= 5000 && median >= 50000) return "mine_next";
  if (count >= 5000) return "observe";
  return "defer";
}

function isAccessoryCategory(row) {
  return ACCESSORY_CATEGORY_RE.test(row.pathTitles.join(" "));
}

function scoreCategory(row, sample) {
  const family = familyForCategory(row);
  const familyBoost = {
    smartphone: 35,
    tablet: 32,
    wearable_watch: 30,
    audio: 28,
    pc_laptop: 26,
    home_appliance: 22,
    kitchen_appliance: 18,
    beauty_appliance: 14,
    camera: 14,
    game_console: 13,
    pc_parts: 6,
    large_appliance: 4,
    legacy_mobile: 2,
    other_tech: 2,
  }[family] ?? 0;
  const countScore = Math.min(30, Math.log10(Math.max(1, row.count)) * 8);
  const median = sample.priceStats.median ?? 0;
  const priceScore = Math.min(28, Math.log10(Math.max(1, median / 1000)) * 8);
  const sampleScore = Math.min(10, sample.sampleCount / 3);
  const noisyPenalty = family === "pc_parts" || family === "large_appliance" ? 10 : 0;
  const accessoryPenalty = isAccessoryCategory(row) ? 25 : 0;
  const sampleNoisePenalty = Math.round((sample.noiseRate ?? 0) * 30);
  return Math.round(
    familyBoost + countScore + priceScore + sampleScore - noisyPenalty - accessoryPenalty - sampleNoisePenalty,
  );
}

function summarizeProducts(products) {
  const prices = products.map((item) => item.price).filter((price) => Number.isFinite(price));
  const noiseCount = products.filter((item) => SAMPLE_NOISE_RE.test(item.name)).length;
  const statuses = products.reduce((acc, item) => {
    const key = item.status || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    sampleCount: products.length,
    priceStats: {
      p25: percentile(prices, 0.25),
      median: percentile(prices, 0.5),
      p75: percentile(prices, 0.75),
    },
    noiseCount,
    noiseRate: products.length > 0 ? noiseCount / products.length : 0,
    statusCounts: statuses,
    sampleNames: products.slice(0, 8).map((item) => ({
      pid: item.pid,
      name: item.name,
      price: item.price,
      status: item.status,
    })),
  };
}

async function fetchCategoryProducts(categoryId, sampleSize) {
  const url = new URL(CATEGORY_PRODUCTS_URL);
  url.searchParams.set("categoryId", categoryId);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", "0");
  url.searchParams.set("size", String(sampleSize));
  const payload = await fetchJson(url);
  return extractProducts(payload).slice(0, sampleSize);
}

function formatWon(value) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function buildMarkdown({ generatedAt, roots, priorities, treeSource, productSource }) {
  const topRoots = roots
    .slice(0, 12)
    .map(
      (row) =>
        `| ${row.id} | ${row.pathTitles.join(" > ")} | ${row.count.toLocaleString("ko-KR")} | ${row.childCount} |`,
    )
    .join("\n");

  const priorityRows = priorities
    .slice(0, 35)
    .map((item) => {
      const row = item.category;
      const sample = item.sample;
      return `| ${item.rank} | ${row.id} | ${row.pathTitles.join(" > ")} | ${item.family} | ${row.count.toLocaleString("ko-KR")} | ${formatWon(sample.priceStats.median)} | ${sample.sampleCount} | ${Math.round(sample.noiseRate * 100)}% | ${item.coverage} | ${item.action} |`;
    })
    .join("\n");

  const sampleBlocks = priorities
    .slice(0, 12)
    .map((item) => {
      const names = item.sample.sampleNames
        .slice(0, 5)
        .map((sample) => `  - ${sample.name} · ${formatWon(sample.price)} · ${sample.status || "status_unknown"}`)
        .join("\n");
      return `### ${item.category.pathTitles.join(" > ")} (${item.category.id})\n\n${names || "  - 샘플 없음"}`;
    })
    .join("\n\n");

  return `# 번개장터 테크/가전 카테고리 디스커버리

- 생성 시각: ${generatedAt}
- 카테고리 소스: ${treeSource}
- 상품 샘플 소스: ${productSource}
- 우선 루트: 600 디지털, 610 가전제품

## 결론

지금 확장은 제품군을 상상해서 정하지 말고, 번개장터 실제 카테고리 트리와 샘플 매물 기반으로 정한다. MVP 우선순위는 사업계획서 방향대로 테크/가전/스마트기기이며, 후보팩 공개는 기존 readiness gate를 통과한 카테고리만 허용한다. 일반 명품/기계식 시계는 스마트기기가 아니므로 이번 우선 루트에서 제외한다.

현재 이미 일부 다루는 축은 오디오/웨어러블이고, 스마트폰/태블릿/노트북은 내부 학습 중이다. 가전은 아직 카탈로그와 물류/배송 리스크 모델이 없으므로 샘플 수집과 노이즈 분석부터 시작한다.

## 상위 루트

| ID | 경로 | 매물 수 | 하위 수 |
|---|---|---:|---:|
${topRoots}

## 테크/가전 우선순위

| Rank | ID | 경로 | 제품군 | 매물 수 | 샘플 중앙가 | 샘플 | 샘플 노이즈 | 현재 커버리지 | 제안 |
|---:|---|---|---|---:|---:|---:|---:|---|---|
${priorityRows}

## 상위 카테고리 샘플

${sampleBlocks}

## 운영 결정

- 카테고리 확장 순서는 '번개장터 카테고리 발견 -> 샘플 매물 확인 -> mine:category 실행 -> REVIEW/approval -> readiness 승격'으로 고정한다.
- MacBook처럼 특정 제품군을 깊게 파는 작업은 필요하지만, 확장 로드맵을 정할 때는 먼저 시장 카테고리 전체를 본다.
- 가전은 가격대가 좋아도 부피/배송/설치/고장 리스크가 커서 후보팩 공개보다 별도 리스크 모델이 먼저다.
- PC부품/저장장치는 매물 수가 많아도 부품/호환성 노이즈가 커서 바로 후보팩으로 열지 않는다.
`;
}

async function main() {
  const sampleSize = parseIntArg("sample-size", DEFAULT_SAMPLE_SIZE);
  const maxCategories = parseIntArg("max-categories", DEFAULT_MAX_CATEGORIES);
  const outDir = path.resolve(parseArg("out-dir", "category-intelligence/category-discovery"));
  const generatedAt = new Date().toISOString();

  const rawTree = await fetchJson(CATEGORY_TREE_URL);
  const categories = flattenCategories(getCategoryNodes(rawTree));
  const roots = categories.filter((row) => row.depth === 1).sort((a, b) => b.count - a.count);
  const techRows = categories
    .filter((row) => row.pathIds.some((id) => TECH_ROOT_IDS.has(id)))
    .filter((row) => row.depth > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxCategories);

  const sampled = [];
  for (const row of techRows) {
    try {
      const products = await fetchCategoryProducts(row.id, sampleSize);
      const sample = summarizeProducts(products);
      const family = familyForCategory(row);
      sampled.push({
        category: row,
        family,
        coverage: coverageForFamily(family),
        sample,
        action: actionFor(row, sample),
      });
      process.stdout.write(".");
    } catch (error) {
      process.stdout.write("x");
      sampled.push({
        category: row,
        family: familyForCategory(row),
        coverage: "unknown",
        sample: summarizeProducts([]),
        action: "fetch_failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  process.stdout.write("\n");

  const priorities = sampled
    .map((item) => ({
      ...item,
      priorityScore: scoreCategory(item.category, item.sample),
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  await mkdir(outDir, { recursive: true });

  const latest = {
    generatedAt,
    sources: {
      categoryTree: CATEGORY_TREE_URL,
      categoryProducts: CATEGORY_PRODUCTS_URL,
    },
    parameters: { sampleSize, maxCategories },
    roots,
    priorities,
  };

  await writeFile(path.join(outDir, "category_tree.json"), JSON.stringify(rawTree, null, 2));
  await writeFile(path.join(outDir, "latest.json"), JSON.stringify(latest, null, 2));
  await writeFile(
    path.join(outDir, "REPORT.md"),
    buildMarkdown({
      generatedAt,
      roots,
      priorities,
      treeSource: CATEGORY_TREE_URL,
      productSource: CATEGORY_PRODUCTS_URL,
    }),
  );

  console.log(`Wrote ${path.join(outDir, "REPORT.md")}`);
  console.log("Top priority categories:");
  for (const item of priorities.slice(0, 10)) {
    console.log(
      `${item.rank}. ${item.category.id} ${item.category.pathTitles.join(" > ")} ` +
        `[${item.family}] count=${item.category.count} median=${formatWon(item.sample.priceStats.median)} action=${item.action}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
