/**
 * mine-category-intelligence-v2.mjs
 *
 * v2: embedding → clustering → AI cluster labeling → keyword auto-validation
 * v1과 달리 NOISE_SEEDS(사람이 미리 작성한 씨드) 없이 코퍼스에서 자율 발견.
 * 동일한 출력 파일 형식(catalog_SUGGESTIONS.md, noise_PATCH.md 등) + cluster_analysis.json 추가.
 *
 * 실행:
 *   node scripts/mine-category-intelligence-v2.mjs --category=smartphone
 *   node scripts/mine-category-intelligence-v2.mjs --category=smartphone --reuse-samples
 *   node scripts/mine-category-intelligence-v2.mjs --category=tablet --limit=600 --pages=3
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const rootDir = path.join(appDir, "..");
const outDir = path.join(appDir, "category-intelligence");

// ─── Category configs (v1과 동일) ─────────────────────────────────────────────

const CATEGORIES = {
  smartphone: {
    label: "Smartphone",
    queries: [
      "아이폰 15", "아이폰 15 프로", "아이폰 14 프로", "아이폰 13",
      "갤럭시 s24", "갤럭시 s23", "갤럭시 z플립", "갤럭시 z폴드",
    ],
    seedSkus: [
      "iphone-15", "iphone-15-pro", "iphone-15-pro-max",
      "iphone-14", "iphone-14-pro", "iphone-14-pro-max",
      "galaxy-s24", "galaxy-s24-ultra", "galaxy-s23", "galaxy-s23-ultra",
      "galaxy-z-flip5", "galaxy-z-flip6", "galaxy-z-fold5", "galaxy-z-fold6",
    ],
    minNormalPrice: 50000,
    clusterK: 18,
    aiHints: "스마트폰. 주요 노이즈: 케이스/필름/충전기(액세서리), 부품폰/액정만(부품), 고장/파손(파손), 매입글, 재고정리/완납폰/선착순특가/제휴카드(업자미끼), 일괄묶음(다중). 정상: 공기계, 자급제, 중고 본품.",
  },
  tablet: {
    label: "Tablet",
    queries: [
      "아이패드 프로", "아이패드 에어", "아이패드 미니", "아이패드 10세대",
      "갤럭시탭 s9", "갤럭시탭 s8", "갤럭시탭 s10",
    ],
    seedSkus: [
      "ipad-pro-m2", "ipad-pro-m4", "ipad-air-5", "ipad-air-6",
      "ipad-mini-6", "ipad-10", "galaxy-tab-s8", "galaxy-tab-s9", "galaxy-tab-s10",
    ],
    minNormalPrice: 80000,
    clusterK: 14,
    aiHints: "태블릿. 주요 노이즈: 케이스/키보드/펜슬/필름(액세서리), 액정파손/휘어짐/터치불량(파손), 부품용, 매입글. 정상: 공기계, Wi-Fi/셀룰러 본품.",
  },
  laptop: {
    label: "Laptop",
    queries: [
      "맥북 에어 m1", "맥북 에어 m2", "맥북 에어 m3",
      "맥북 프로 m2", "맥북 프로 m3", "그램 노트북", "갤럭시북",
    ],
    seedSkus: [
      "macbook-air-m1", "macbook-air-m2", "macbook-air-m3",
      "macbook-pro-m2", "macbook-pro-m3", "lg-gram", "galaxy-book",
    ],
    minNormalPrice: 150000,
    clusterK: 14,
    aiHints: "노트북. 주요 노이즈: 충전기/파우치 단독(액세서리), 액정파손/침수/키보드불량/배터리사이클과다(파손), 부품용, 매입글. 정상: 중고 본체.",
  },
  small_appliance: {
    label: "Small Appliance",
    queries: [
      "다이슨 에어랩", "다이슨 드라이기", "로보락", "닌텐도 스위치",
      "플스5", "소니 헤드폰", "보스 헤드폰",
    ],
    seedSkus: [
      "dyson-airwrap", "dyson-supersonic", "roborock", "nintendo-switch",
      "playstation-5", "sony-headphone", "bose-headphone",
    ],
    minNormalPrice: 30000,
    clusterK: 12,
    aiHints: "소형가전/전자기기. 노이즈: 부품/고장/소모품/호환액세서리/구매글/다중상품. 정상: 중고 본체.",
  },
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function argValue(name, fallback) {
  for (const arg of process.argv) {
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch { /* optional */ }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)))];
}

function extractJson(text) {
  const raw = text.trim();
  if (raw.startsWith("{") || raw.startsWith("[")) return JSON.parse(raw);
  const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/);
  if (match) return JSON.parse(match[1]);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("JSON not found in AI response");
}

// Korean text tokenization — whitespace split, remove short tokens and stopwords
const KO_STOPWORDS = new Set(["이", "그", "저", "을", "를", "이", "가", "은", "는", "에", "의", "로", "으로", "에서", "이다", "합니다", "있습니다", "있어요", "입니다", "됩니다", "해요", "해서", "하고", "하며", "또는", "또는", "및", "등", "때", "것", "수", "들"]);

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^가-힣a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !KO_STOPWORDS.has(t));
}

// ─── Bunjang API ──────────────────────────────────────────────────────────────

async function searchPage(query, page) {
  const url = new URL("https://api.bunjang.co.kr/api/1/find_v2.json");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", String(page));
  url.searchParams.set("n", "30");
  url.searchParams.set("stat_device", "w");
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.list ?? [])
    .map((item) => ({
      pid: String(item.pid ?? ""),
      name: String(item.name ?? ""),
      price: toInt(item.price),
      numFaved: toInt(item.num_faved),
      query,
      freeShipping: item.free_shipping === true || item.free_shipping === "1",
    }))
    .filter((item) => item.pid);
}

async function fetchDetail(pid) {
  const url = `https://api.bunjang.co.kr/api/pms/v1/products/${pid}/detail/web`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const json = await res.json();
  const product = json?.data?.product ?? {};
  const shop = json?.data?.shop ?? {};
  return {
    description: String(product.description ?? "").slice(0, 900),
    condition: String(product.condition ?? ""),
    saleStatus: String(product.saleStatus ?? ""),
    productSpecs: product.productSpecs ?? null,
    isProshop: shop.proshop === true || shop.isOfficialSeller === true,
    salesCount: toInt(shop.salesCount),
    reviewRating: shop.reviewRating == null ? null : Number(shop.reviewRating),
    reviewCount: toInt(shop.reviewCount),
  };
}

async function collectSamples({ queries, limit, pages }) {
  const byPid = new Map();
  for (const query of queries) {
    for (let page = 0; page < pages; page++) {
      const items = await searchPage(query, page);
      for (const item of items) {
        if (!byPid.has(item.pid)) byPid.set(item.pid, item);
      }
      await sleep(120);
    }
  }
  const selected = [...byPid.values()].slice(0, limit);
  const samples = [];
  for (const [idx, item] of selected.entries()) {
    const detail = await fetchDetail(item.pid);
    await sleep(180);
    if (!detail) continue;
    samples.push({ ...item, ...detail });
    if ((idx + 1) % 25 === 0) console.log(`  collected ${idx + 1}/${selected.length}`);
  }
  return samples;
}

// ─── Embedding ────────────────────────────────────────────────────────────────

async function embedBatch(texts, apiKey) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts, dimensions: 256 }),
  });
  if (!res.ok) throw new Error(`Embedding API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

async function embedSamples(samples, apiKey) {
  const BATCH = 100;
  const all = [];
  for (let i = 0; i < samples.length; i += BATCH) {
    const batch = samples.slice(i, i + BATCH);
    const texts = batch.map((s) => `${s.name}\n${s.description.slice(0, 300)}`);
    const embeddings = await embedBatch(texts, apiKey);
    all.push(...embeddings);
    if (i + BATCH < samples.length) {
      console.log(`  embedded ${Math.min(i + BATCH, samples.length)}/${samples.length}`);
      await sleep(300);
    }
  }
  return all; // index-aligned with samples
}

// ─── K-means clustering ───────────────────────────────────────────────────────

function cosineDist(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return 1 - dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

function assignToCentroids(embeddings, centroids) {
  return embeddings.map((e) => {
    let best = 0, bestDist = Infinity;
    for (let c = 0; c < centroids.length; c++) {
      const dist = cosineDist(e, centroids[c]);
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    return best;
  });
}

function recomputeCentroids(embeddings, assignments, k) {
  const dim = embeddings[0].length;
  const centroids = Array.from({ length: k }, () => new Float64Array(dim));
  const counts = new Int32Array(k);
  for (let i = 0; i < embeddings.length; i++) {
    const c = assignments[i];
    counts[c]++;
    for (let d = 0; d < dim; d++) centroids[c][d] += embeddings[i][d];
  }
  for (let c = 0; c < k; c++) {
    if (counts[c] > 0) for (let d = 0; d < dim; d++) centroids[c][d] /= counts[c];
  }
  return centroids;
}

function kMeans(embeddings, k, maxIter = 60) {
  // k-means++ initialization
  const centroids = [];
  const first = Math.floor(Math.random() * embeddings.length);
  centroids.push([...embeddings[first]]);
  while (centroids.length < k) {
    const dists = embeddings.map((e) => {
      let minD = Infinity;
      for (const c of centroids) minD = Math.min(minD, cosineDist(e, c));
      return minD;
    });
    const sum = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < dists.length; i++) {
      r -= dists[i];
      if (r <= 0) { centroids.push([...embeddings[i]]); break; }
    }
  }

  let assignments = assignToCentroids(embeddings, centroids);
  for (let iter = 0; iter < maxIter; iter++) {
    const newCentroids = recomputeCentroids(embeddings, assignments, k);
    const newAssignments = assignToCentroids(embeddings, newCentroids);
    const changed = newAssignments.filter((a, i) => a !== assignments[i]).length;
    assignments = newAssignments;
    if (changed === 0) break;
  }
  const finalCentroids = recomputeCentroids(embeddings, assignments, k);
  return { assignments, centroids: finalCentroids };
}

function clusterGroups(samples, assignments, k) {
  const groups = Array.from({ length: k }, () => []);
  samples.forEach((s, i) => groups[assignments[i]].push({ ...s, _idx: i }));
  return groups;
}

// Representative samples = closest to centroid
function representativeSamples(group, centroid, embeddings, n = 5) {
  return group
    .map((s) => ({ s, dist: cosineDist(embeddings[s._idx], centroid) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n)
    .map((x) => x.s);
}

// ─── OpenAI helpers ───────────────────────────────────────────────────────────

async function chatCompletion(messages, apiKey, { model = "gpt-4.1-mini", temperature = 0.1, json = true } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return json ? extractJson(text) : text;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Phase 3: AI cluster labeling ─────────────────────────────────────────────

async function labelCluster(clusterId, repSamples, clusterSize, category, config, apiKey) {
  const compacted = repSamples.map((s) => ({
    pid: s.pid,
    title: s.name,
    price: s.price,
    condition: s.condition,
    isProshop: s.isProshop,
    salesCount: s.salesCount,
    description: s.description.slice(0, 300),
  }));
  return chatCompletion([
    {
      role: "system",
      content: "You are a Korean secondhand market listing classifier. Return valid JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Classify this cluster of similar listings. Identify their common listing type and distinctive patterns.",
        category,
        category_hints: config.aiHints,
        cluster_id: clusterId,
        cluster_size: clusterSize,
        representative_samples: compacted,
        output_schema: {
          cluster_id: "number",
          listing_type: "normal|accessory|parts|damaged|buying|commercial|multi|counterfeit|ambiguous",
          confidence: "high|medium|low",
          rationale_ko: "왜 이 클러스터가 해당 타입인지 한국어로 설명",
          distinctive_keywords: ["이 클러스터를 구분짓는 핵심 단어들 (5~10개)"],
          negative_context: ["정상 매물에도 등장해서 제외하면 안 되는 컨텍스트 (예: 박스 포함)"],
          sku_hint: "normal 타입일 때만: 이 그룹이 대표하는 SKU 모델명 (예: iPhone 15 Pro 256GB)",
          price_note_ko: "가격 분포에서 특이한 점 (있으면)",
        },
      }),
    },
  ], apiKey);
}

// ─── Phase 4: Pattern extraction (TF-IDF style) ───────────────────────────────

function extractDistinctiveKeywords(noiseGroupSamples, normalGroupSamples, topN = 15) {
  const countWords = (samples) => {
    const freq = new Map();
    for (const s of samples) {
      const words = tokenize(`${s.name} ${s.description}`);
      for (const w of new Set(words)) freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    return freq;
  };
  const noiseFreq = countWords(noiseGroupSamples);
  const normalFreq = countWords(normalGroupSamples);
  const noiseTotal = Math.max(1, noiseGroupSamples.length);
  const normalTotal = Math.max(1, normalGroupSamples.length);

  const scored = [...noiseFreq.entries()]
    .filter(([, c]) => c >= 2)
    .map(([word, noiseCount]) => {
      const normalCount = normalFreq.get(word) ?? 0;
      const noiseRate = noiseCount / noiseTotal;
      const normalRate = normalCount / normalTotal;
      const score = noiseRate / (normalRate + 0.05); // +0.05 smoothing
      return { word, score, noiseCount, precision: noiseCount / (noiseCount + normalCount) };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

// ─── Phase 5: Keyword auto-validation ─────────────────────────────────────────

async function validateKeyword(keyword, expectedType, allSamples, apiKey) {
  const hits = allSamples.filter((s) =>
    `${s.name} ${s.description}`.toLowerCase().includes(keyword.toLowerCase())
  );
  if (hits.length === 0) return { keyword, precision: 0, hitCount: 0, validated: false };
  const sampleHits = hits.sort(() => Math.random() - 0.5).slice(0, 5).map((s) => ({
    pid: s.pid,
    title: s.name,
    price: s.price,
    description: s.description.slice(0, 200),
  }));

  const result = await chatCompletion([
    { role: "system", content: "Korean secondhand market listing evaluator. Return valid JSON only." },
    {
      role: "user",
      content: JSON.stringify({
        task: `이 매물들이 진짜 "${expectedType}" 타입인가? 각 매물에 대해 판단하고 전체 precision(0.0~1.0)을 계산해줘.`,
        expected_type: expectedType,
        keyword_used: keyword,
        listings: sampleHits,
        output_schema: {
          per_listing: [{ pid: "string", is_correct_type: "boolean", reason_ko: "string" }],
          precision: "number (0.0~1.0)",
          verdict_ko: "전체 평가 한 문장",
        },
      }),
    },
  ], apiKey);
  return { keyword, precision: result?.precision ?? 0, hitCount: hits.length, verdict: result?.verdict_ko, validated: true };
}

// ─── Price distribution (cluster-aware) ───────────────────────────────────────

function priceDistributionFromClusters(samples, normalIndices, config) {
  const normalSamples = samples.filter((_, i) => normalIndices.has(i) && samples[i].price >= config.minNormalPrice);

  // Group by rough model key (same regex as v1 for compatibility)
  function roughKey(name) {
    const t = name.toLowerCase().replace(/\s+/g, "");
    const patterns = [
      [/아이폰(1[1-6])(?:프로맥스|promax|pro max)/i, "iphone-$1-pro-max"],
      [/아이폰(1[1-6])(?:프로|pro)/i, "iphone-$1-pro"],
      [/아이폰(1[1-6])(?:플러스|plus)/i, "iphone-$1-plus"],
      [/아이폰(1[1-6])/i, "iphone-$1"],
      [/갤럭시s(2[0-5])울트라|s(2[0-5])ultra/i, "galaxy-s$1$2-ultra"],
      [/갤럭시s(2[0-5])플러스|s(2[0-5])plus/i, "galaxy-s$1$2-plus"],
      [/갤럭시s(2[0-5])|s(2[0-5])/i, "galaxy-s$1$2"],
      [/z플립([3-7])|zflip([3-7])/i, "galaxy-z-flip$1$2"],
      [/z폴드([3-7])|zfold([3-7])/i, "galaxy-z-fold$1$2"],
      [/아이패드프로/i, "ipad-pro"], [/아이패드에어/i, "ipad-air"],
      [/아이패드미니/i, "ipad-mini"], [/맥북에어/i, "macbook-air"],
      [/맥북프로/i, "macbook-pro"],
    ];
    for (const [pat, key] of patterns) {
      const m = t.match(pat);
      if (m) return key.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
    }
    return "unknown";
  }

  const byKey = new Map();
  for (const s of normalSamples) {
    const key = roughKey(s.name);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(s.price);
  }
  return [...byKey.entries()]
    .map(([key, prices]) => ({
      key,
      count: prices.length,
      min: Math.min(...prices),
      p25: quantile(prices, 0.25),
      median: quantile(prices, 0.5),
      p75: quantile(prices, 0.75),
      max: Math.max(...prices),
      core_sample_count: prices.length,
      excluded_count: samples.length - normalSamples.length,
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── Output formatters ────────────────────────────────────────────────────────

function markdownCatalog({ config, category, generatedAt, clusterLabels, prices }) {
  const normalClusters = clusterLabels.filter((c) => c.listing_type === "normal" && c.confidence !== "low");
  const lines = [
    `# ${config.label} — Catalog Suggestions (v2)`,
    "",
    `- category: ${category}`,
    `- generated_at: ${generatedAt}`,
    `- method: embedding-cluster-label`,
    "",
    "## Discovered Normal Clusters (SKU Candidates)",
    "",
    "| cluster | confidence | sku_hint | distinctive_keywords |",
    "|---|---|---|---|",
  ];
  for (const c of normalClusters) {
    lines.push(`| ${c.cluster_id} | ${c.confidence} | ${c.sku_hint ?? "-"} | ${(c.distinctive_keywords ?? []).slice(0, 5).join(", ")} |`);
  }
  lines.push("", "## Price Distribution Snapshot", "", "| rough key | count | p25 | median | p75 |", "|---|---:|---:|---:|---:|");
  for (const row of prices.slice(0, 20)) {
    lines.push(`| ${row.key} | ${row.count} | ${row.p25.toLocaleString("ko-KR")} | ${row.median.toLocaleString("ko-KR")} | ${row.p75.toLocaleString("ko-KR")} |`);
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

function markdownNoise({ config, category, generatedAt, clusterLabels, validatedKeywords }) {
  const noiseClusters = clusterLabels.filter((c) => c.listing_type !== "normal" && c.listing_type !== "ambiguous");
  const lines = [
    `# ${config.label} — Noise Rule Suggestions (v2)`,
    "",
    `- category: ${category}`,
    `- generated_at: ${generatedAt}`,
    `- method: cluster-discovered (auto-validated)`,
    "",
    "## Discovered Noise Clusters",
    "",
    "| cluster | type | confidence | distinctive_keywords | rationale |",
    "|---|---|---|---|---|",
  ];
  for (const c of noiseClusters) {
    lines.push(`| ${c.cluster_id} | ${c.listing_type} | ${c.confidence} | ${(c.distinctive_keywords ?? []).slice(0, 5).join(", ")} | ${c.rationale_ko ?? "-"} |`);
  }
  lines.push("", "## Auto-Validated Keywords", "", "> precision ≥ 0.80 → pipeline.ts에 추가 권장. 0.60~0.79 → 사람 검수 후 추가. < 0.60 → 제외.", "");
  const approved = validatedKeywords.filter((v) => v.precision >= 0.80);
  const review = validatedKeywords.filter((v) => v.precision >= 0.60 && v.precision < 0.80);
  const rejected = validatedKeywords.filter((v) => v.precision < 0.60);
  if (approved.length) {
    lines.push("### ✅ 자동 승인 (precision ≥ 0.80)", "");
    for (const v of approved) lines.push(`- \`${v.keyword}\` — precision: ${v.precision.toFixed(2)}, hits: ${v.hitCount}${v.verdict ? ` — ${v.verdict}` : ""}`);
    lines.push("");
  }
  if (review.length) {
    lines.push("### 🔍 사람 검수 필요 (0.60 ≤ precision < 0.80)", "");
    for (const v of review) lines.push(`- \`${v.keyword}\` — precision: ${v.precision.toFixed(2)}, hits: ${v.hitCount}${v.verdict ? ` — ${v.verdict}` : ""}`);
    lines.push("");
  }
  if (rejected.length) {
    lines.push("### ❌ 자동 기각 (precision < 0.60)", "");
    for (const v of rejected) lines.push(`- \`${v.keyword}\` — precision: ${v.precision.toFixed(2)}, hits: ${v.hitCount}`);
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

function markdownReview({ config, category, generatedAt, samples, clusterLabels, validatedKeywords }) {
  const ambiguous = clusterLabels.filter((c) => c.listing_type === "ambiguous" || c.confidence === "low");
  const lines = [
    `# ${config.label} — Category Expansion Review (v2)`,
    "",
    `- category: ${category}`,
    `- generated_at: ${generatedAt}`,
    `- samples: ${samples.length}`,
    `- clusters: ${clusterLabels.length}`,
    "",
    "## 클러스터 요약",
    "",
    "| cluster | type | confidence | size | sample titles |",
    "|---|---|---|---|---|",
  ];
  for (const c of clusterLabels) {
    const ex = (c._samples ?? []).slice(0, 2).map((s) => s.name).join(" / ");
    lines.push(`| ${c.cluster_id} | ${c.listing_type} | ${c.confidence} | ${c._size ?? "?"} | ${ex} |`);
  }
  if (ambiguous.length) {
    lines.push("", "## ⚠️ 사람 검수 필요 (모호 클러스터)", "");
    for (const c of ambiguous) {
      lines.push(`### Cluster ${c.cluster_id} — ${c.listing_type} (${c.confidence})`);
      lines.push(`- 사유: ${c.rationale_ko ?? "-"}`);
      for (const s of c._samples ?? []) lines.push(`  - ${s.pid} / ${s.name} / ${s.price?.toLocaleString("ko-KR")}원`);
      lines.push("");
    }
  }
  const approvedCount = validatedKeywords.filter((v) => v.precision >= 0.80).length;
  lines.push("", "## 키워드 검증 요약", "", `- 자동 승인: ${approvedCount}개`, `- 검수 필요: ${validatedKeywords.filter((v) => v.precision >= 0.60 && v.precision < 0.80).length}개`, `- 자동 기각: ${validatedKeywords.filter((v) => v.precision < 0.60).length}개`, "");
  return lines.join("\n") + "\n";
}

// ─── Main pipeline ─────────────────────────────────────────────────────────────

async function runCategory({ category, config, limit, pages, generatedAt, apiKey }) {
  const categoryDir = path.join(outDir, category);
  await mkdir(categoryDir, { recursive: true });

  // Phase 1: Collect
  let samples;
  if (hasFlag("--reuse-samples")) {
    samples = JSON.parse(await readFile(path.join(categoryDir, "samples.json"), "utf-8"));
    console.log(`\n[${category}] reusing ${samples.length} samples`);
  } else {
    console.log(`\n[${category}] collecting (limit=${limit}, pages=${pages})`);
    samples = await collectSamples({ queries: config.queries, limit, pages });
    await writeFile(path.join(categoryDir, "samples.json"), JSON.stringify(samples, null, 2));
  }
  console.log(`[${category}] samples: ${samples.length}`);

  // Phase 2: Embed (cache to embeddings.json)
  let embeddings;
  const embedPath = path.join(categoryDir, "embeddings.json");
  const shouldReembed = !hasFlag("--reuse-samples") || !await readFile(embedPath, "utf-8").then(() => true).catch(() => false);
  if (shouldReembed) {
    console.log(`[${category}] embedding ${samples.length} samples...`);
    embeddings = await embedSamples(samples, apiKey);
    await writeFile(embedPath, JSON.stringify(embeddings), "utf-8");
  } else {
    embeddings = JSON.parse(await readFile(embedPath, "utf-8"));
    if (embeddings.length !== samples.length) {
      console.log(`[${category}] embeddings mismatch, re-embedding...`);
      embeddings = await embedSamples(samples, apiKey);
      await writeFile(embedPath, JSON.stringify(embeddings), "utf-8");
    } else {
      console.log(`[${category}] reusing cached embeddings`);
    }
  }

  // Phase 3: K-means cluster
  const k = config.clusterK;
  console.log(`[${category}] clustering k=${k}...`);
  const { assignments, centroids } = kMeans(embeddings, k);
  const groups = clusterGroups(samples, assignments, k);

  // Phase 4: AI cluster labeling
  console.log(`[${category}] labeling ${k} clusters...`);
  const clusterLabels = [];
  for (let c = 0; c < k; c++) {
    const group = groups[c];
    if (!group.length) continue;
    const reps = representativeSamples(group, centroids[c], embeddings);
    let label;
    try {
      label = await labelCluster(c, reps, group.length, category, config, apiKey);
      await sleep(200);
    } catch (err) {
      console.error(`  cluster ${c} label failed: ${err.message}`);
      label = { cluster_id: c, listing_type: "ambiguous", confidence: "low", rationale_ko: "AI 레이블링 실패" };
    }
    label.cluster_id = c;
    label._size = group.length;
    label._samples = reps.map((s) => ({ pid: s.pid, name: s.name, price: s.price }));
    clusterLabels.push(label);
    process.stdout.write(`  [${c}/${k - 1}] ${label.listing_type} (${label.confidence}) — ${group.length}건\n`);
  }

  // Phase 5: Keyword extraction + validation
  const normalIndices = new Set();
  const noiseGroupSamples = [];
  for (const label of clusterLabels) {
    if (label.listing_type === "normal") {
      groups[label.cluster_id].forEach((s) => normalIndices.add(s._idx));
    } else if (label.listing_type !== "ambiguous") {
      noiseGroupSamples.push(...groups[label.cluster_id]);
    }
  }
  const normalSamples = samples.filter((_, i) => normalIndices.has(i));

  // Extract candidate keywords from noise clusters
  const rawKeywords = extractDistinctiveKeywords(noiseGroupSamples, normalSamples, 20);
  console.log(`[${category}] validating ${rawKeywords.length} keyword candidates...`);
  const validatedKeywords = [];
  for (const { word, precision: extractedPrecision } of rawKeywords.slice(0, 20)) {
    if (extractedPrecision < 0.50) continue; // pre-filter very noisy words
    const noiseLabel = clusterLabels.find((c) =>
      c.listing_type !== "normal" && (c.distinctive_keywords ?? []).some((k) => k.includes(word) || word.includes(k))
    );
    const expectedType = noiseLabel?.listing_type ?? "noise";
    try {
      const result = await validateKeyword(word, expectedType, samples, apiKey);
      validatedKeywords.push(result);
      await sleep(150);
    } catch (err) {
      console.error(`  keyword "${word}" validation failed: ${err.message}`);
    }
  }

  // Price distribution
  const prices = priceDistributionFromClusters(samples, normalIndices, config);

  // Outputs
  const clusterAnalysis = clusterLabels.map((c) => {
    const out = { ...c };
    delete out._samples;
    return out;
  });
  await writeFile(path.join(categoryDir, "cluster_analysis.json"), JSON.stringify(clusterAnalysis, null, 2));
  await writeFile(path.join(categoryDir, "price_distribution.json"), JSON.stringify(prices, null, 2));
  await writeFile(path.join(categoryDir, "catalog_SUGGESTIONS.md"), markdownCatalog({ config, category, generatedAt, clusterLabels, prices }));
  await writeFile(path.join(categoryDir, "noise_PATCH.md"), markdownNoise({ config, category, generatedAt, clusterLabels, validatedKeywords }));
  await writeFile(path.join(categoryDir, "REVIEW.md"), markdownReview({ config, category, generatedAt, samples, clusterLabels, validatedKeywords }));

  const approved = validatedKeywords.filter((v) => v.precision >= 0.80).length;
  console.log(`[${category}] done. normal clusters: ${normalIndices.size}/${samples.length}, approved keywords: ${approved}`);
  return { category, samples: samples.length, clusters: k, approvedKeywords: approved };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(rootDir, "poc", ".env"));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.error("OPENAI_API_KEY required"); process.exit(1); }

  const limit = Number(argValue("--limit", "500"));
  const pages = Number(argValue("--pages", "3"));
  const categoryArg = argValue("--category", "smartphone");
  const generatedAt = new Date().toISOString();
  const requested = categoryArg === "all"
    ? Object.keys(CATEGORIES)
    : categoryArg.split(",").map((c) => c.trim()).filter(Boolean);

  for (const cat of requested) {
    if (!CATEGORIES[cat]) { console.error(`Unknown category: ${cat}. Available: ${Object.keys(CATEGORIES).join(", ")}, all`); process.exit(1); }
  }

  await mkdir(outDir, { recursive: true });
  console.log(`mine-category-intelligence v2 — ${requested.join(", ")}`);
  const summaries = [];
  for (const cat of requested) {
    const result = await runCategory({ category: cat, config: CATEGORIES[cat], limit, pages, generatedAt, apiKey });
    summaries.push(result);
  }
  console.log("\n=== Summary ===");
  for (const s of summaries) console.log(`  ${s.category}: ${s.samples} samples, ${s.clusters} clusters, ${s.approvedKeywords} approved keywords`);
}

main().catch((err) => { console.error(err); process.exit(1); });
