import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const rootDir = path.join(appDir, "..");
const outDir = path.join(appDir, "category-intelligence");

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
    aiHints:
      "스마트폰 카테고리입니다. SKU 축은 모델명, 저장용량(128/256/512/1TB), 자급제/통신사, 정상해지/선택약정, 배터리 성능, 액정/후면/카메라 파손, 부품폰, 메인보드, 액정만, 공기계, 분실/락/잠김 여부가 중요합니다. 단순 케이스/필름/충전기/박스 단독은 노이즈입니다.",
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
    aiHints:
      "태블릿 카테고리입니다. SKU 축은 세대/칩셋, 화면 크기, 저장용량, Wi-Fi/셀룰러, 펜 포함 여부입니다. 노이즈는 케이스/키보드/펜슬/필름 단독, 액정 파손, 휘어짐, 터치 불량, 부품용입니다.",
  },
  laptop: {
    label: "Laptop",
    queries: [
      "맥북 에어 m1", "맥북 에어 m2", "맥북 에어 m3", "맥북 프로 m1",
      "맥북 프로 m2", "맥북 프로 m3", "그램 노트북", "갤럭시북",
    ],
    seedSkus: [
      "macbook-air-m1", "macbook-air-m2", "macbook-air-m3",
      "macbook-pro-m1", "macbook-pro-m2", "macbook-pro-m3",
      "lg-gram", "galaxy-book",
    ],
    aiHints:
      "노트북 카테고리입니다. SKU 축은 모델/칩셋/연식, RAM, SSD, 화면 크기입니다. 노이즈는 충전기/파우치/부품용/액정파손/침수/키보드불량/배터리 사이클 과다입니다.",
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
    aiHints:
      "소형가전/전자기기 확장 후보입니다. SKU 축이 다양하므로 먼저 거래량, 가격 분포, 노이즈 패턴을 보는 것이 목표입니다. 노이즈는 부품/고장/소모품/호환 액세서리/구매글/다중상품입니다.",
  },
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};

const NOISE_SEEDS = {
  accessory: ["케이스", "필름", "강화유리", "충전기", "케이블", "박스만", "파우치", "거치대"],
  parts: ["부품용", "부품", "액정만", "메인보드", "배터리만", "본체만", "고장폰", "파손폰"],
  damaged: ["고장", "파손", "액정깨짐", "액정 깨짐", "후면파손", "침수", "불량", "터치불량", "잠김", "락걸림"],
  buying: ["삽니다", "구합니다", "매입", "구매합니다", "급구"],
  counterfeit: ["짭", "가품", "레플", "이미테이션", "정품아님", "타오바오"],
  multi: ["일괄", "묶음", "각각", "선택", "여러대", "여러개"],
  // 업자성/미끼성. 정상 본품 가격 분포에서 반드시 제외.
  commercial: [
    "재고정리", "선착순특가", "선착순 특가", "선착순 한정", "한정판매", "마지막입고", "마지막 입고",
    "극소량보유", "극소량 보유", "완납폰", "제휴카드", "유심 그대로", "유심그대로",
    "통신사 특가", "신규개통", "번호이동",
  ],
};

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
  } catch {
    // Optional env file.
  }
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compact(text) {
  return String(text ?? "").toLowerCase().replace(/\s+/g, "");
}

function includesAny(text, keywords) {
  const c = compact(text);
  return keywords.filter((keyword) => c.includes(compact(keyword)));
}

function quantile(values, q) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
}

function median(values) {
  return quantile(values, 0.5);
}

function noiseHits(sample) {
  const title = sample.name;
  const text = `${sample.name}\n${sample.description}`;
  const hits = {};
  for (const [type, keywords] of Object.entries(NOISE_SEEDS)) {
    const source = type === "accessory" ? title : text;
    const found = includesAny(source, keywords);
    if (found.length > 0) hits[type] = found;
  }
  return hits;
}

function isLikelyCoreListing(sample, category) {
  const noisyTypes = new Set(Object.keys(sample.noiseHits));
  if (["accessory", "parts", "buying", "counterfeit", "multi", "commercial"].some((type) => noisyTypes.has(type))) return false;
  if (category === "smartphone" && sample.price < 50000) return false;
  if (category === "tablet" && sample.price < 50000) return false;
  if (category === "laptop" && sample.price < 100000) return false;
  return true;
}

function roughModelKey(name) {
  const t = compact(name);
  const patterns = [
    [/아이폰(?:\s*)?(1[1-6])(?:프로맥스|프로 max|promax|pro max)/i, "iphone-$1-pro-max"],
    [/아이폰(?:\s*)?(1[1-6])(?:프로|pro)/i, "iphone-$1-pro"],
    [/아이폰(?:\s*)?(1[1-6])(?:플러스|plus)/i, "iphone-$1-plus"],
    [/아이폰(?:\s*)?(1[1-6])/i, "iphone-$1"],
    [/갤럭시s(2[0-5])울트라|s(2[0-5])ultra/i, "galaxy-s$1$2-ultra"],
    [/갤럭시s(2[0-5])플러스|s(2[0-5])plus/i, "galaxy-s$1$2-plus"],
    [/갤럭시s(2[0-5])|s(2[0-5])/i, "galaxy-s$1$2"],
    [/z플립\s*([3-7])|zflip\s*([3-7])/i, "galaxy-z-flip$1$2"],
    [/z폴드\s*([3-7])|zfold\s*([3-7])/i, "galaxy-z-fold$1$2"],
    [/아이패드프로/i, "ipad-pro"],
    [/아이패드에어/i, "ipad-air"],
    [/아이패드미니/i, "ipad-mini"],
    [/맥북에어/i, "macbook-air"],
    [/맥북프로/i, "macbook-pro"],
  ];
  for (const [pattern, key] of patterns) {
    const match = t.match(pattern);
    if (!match) continue;
    return key.replace(/\$(\d)/g, (_, i) => match[Number(i)] ?? "");
  }
  return "unknown";
}

function extractStorageGb(text) {
  const raw = String(text ?? "").toLowerCase();
  const match = raw.match(/(?:^|[^0-9])((?:64|128|256|512))\s*(?:g|gb|기가)/) || raw.match(/(?:^|[^0-9])(1)\s*(?:t|tb|테라)/);
  if (!match) return null;
  return match[1] === "1" ? 1024 : Number(match[1]);
}

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
  return (data.list ?? []).map((item) => ({
    pid: String(item.pid ?? ""),
    url: `https://m.bunjang.co.kr/products/${item.pid}`,
    name: String(item.name ?? ""),
    price: toInt(item.price),
    numFaved: toInt(item.num_faved),
    query,
    freeShipping: item.free_shipping === true || item.free_shipping === "1",
  })).filter((item) => item.pid);
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
    brand: String(product.brand ?? ""),
    saleStatus: String(product.saleStatus ?? ""),
    productSpecs: product.productSpecs ?? null,
    reviewRating: shop.reviewRating == null ? null : Number(shop.reviewRating),
    reviewCount: toInt(shop.reviewCount),
  };
}

async function collectSamples({ queries, limit, pages }) {
  const byPid = new Map();
  for (const query of queries) {
    for (let page = 0; page < pages; page += 1) {
      const items = await searchPage(query, page);
      for (const item of items) {
        if (!byPid.has(item.pid)) byPid.set(item.pid, item);
      }
      await sleep(120);
    }
  }

  const selected = [...byPid.values()].slice(0, limit);
  const samples = [];
  for (const [index, item] of selected.entries()) {
    const detail = await fetchDetail(item.pid);
    await sleep(180);
    if (!detail) continue;
    const sample = {
      ...item,
      ...detail,
      roughModelKey: roughModelKey(item.name),
      storageGb: extractStorageGb(`${item.name}\n${detail.description}`),
    };
    sample.noiseHits = noiseHits(sample);
    samples.push(sample);
    if ((index + 1) % 25 === 0) console.log(`  detail ${index + 1}/${selected.length}`);
  }
  return samples;
}

function priceDistribution(samples, category) {
  const byKey = new Map();
  const coreSamples = samples.filter((sample) => isLikelyCoreListing(sample, category));
  for (const sample of coreSamples) {
    const key = sample.roughModelKey || "unknown";
    if (!byKey.has(key)) byKey.set(key, []);
    if (sample.price > 0) byKey.get(key).push(sample.price);
  }
  return [...byKey.entries()]
    .map(([key, prices]) => ({
      key,
      count: prices.length,
      min: Math.min(...prices),
      p25: quantile(prices, 0.25),
      median: median(prices),
      p75: quantile(prices, 0.75),
      max: Math.max(...prices),
      core_sample_count: prices.length,
      excluded_from_price_count: samples.length - coreSamples.length,
    }))
    .sort((a, b) => b.count - a.count);
}

function heuristicDistribution(samples) {
  const byType = {};
  const keywordCounts = {};
  for (const sample of samples) {
    for (const [type, hits] of Object.entries(sample.noiseHits)) {
      byType[type] = (byType[type] ?? 0) + 1;
      keywordCounts[type] ??= {};
      for (const hit of hits) keywordCounts[type][hit] = (keywordCounts[type][hit] ?? 0) + 1;
    }
  }
  return { byType, keywordCounts };
}

function compactSamplesForAi(samples) {
  const limit = Number(process.env.CATEGORY_AI_SAMPLE_LIMIT ?? 50);
  return samples.slice(0, limit).map((sample) => ({
    pid: sample.pid,
    title: sample.name,
    price: sample.price,
    query: sample.query,
    rough_model_key: sample.roughModelKey,
    storage_gb: sample.storageGb,
    noise_types: Object.keys(sample.noiseHits),
    description: sample.description.slice(0, 380),
  }));
}

function extractJson(text) {
  const raw = text.trim();
  if (raw.startsWith("{")) return JSON.parse(raw);
  const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/);
  if (match) return JSON.parse(match[1]);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
}

async function callOpenAi({ samples, category, config, prices }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || hasFlag("--no-ai")) return null;
  const model = process.env.OPENAI_CATEGORY_MODEL || "gpt-4.1-mini";
  const prompt = [
    {
      role: "system",
      content:
        "You are a Korean secondhand resale category expansion analyst. Return only valid JSON. Your job is to propose SKU catalog candidates, aliases, and high-precision noise rules from real Bunjang samples. Be conservative and cite sample pids.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task:
          "Analyze this category for scalable expansion. Produce SKU candidates, alias candidates, noise filter candidates, price distribution notes, and review warnings. Do not suggest automatic deployment. Prefer rules with clear evidence. Avoid broad terms that would remove normal listings. SKU ids should represent stable catalog products only: brand + model + generation + storage/capacity when important. Never put condition(new/used/mint), seller type, or listing state into SKU ids; those are listing attributes, not catalog identity.",
        category,
        category_label: config.label,
        seed_skus: config.seedSkus,
        category_hints: config.aiHints,
        price_distribution: prices.slice(0, 20),
        output_schema: {
          sku_candidates: [
            {
              id: "string",
              brand: "string",
              model_name: "string",
              aliases: ["string"],
              differentiators: ["storage|carrier|generation|size|chip|capacity|other"],
              evidence_pids: ["string"],
              confidence: "high|medium|low",
            },
          ],
          noise_rules: [
            {
              listing_type: "accessory|parts|damaged|buying|counterfeit|multi|callout|commercial",
              add_to: "BUYING_KEYWORDS|CALLOUT_KEYWORDS|PARTS_KEYWORDS|DAMAGED_KEYWORDS|ACCESSORY_TITLE_KEYWORDS|MULTI_KEYWORDS|COMMERCIAL_STRONG_KEYWORDS|COMMERCIAL_WEAK_KEYWORDS|regex|none",
              keywords_or_regex: ["string"],
              negative_context: ["string"],
              evidence_pids: ["string"],
              confidence: "high|medium|low",
              rationale_ko: "string",
            },
          ],
          alias_rules: [
            {
              canonical: "string",
              aliases: ["string"],
              evidence_pids: ["string"],
              confidence: "high|medium|low",
            },
          ],
          price_notes_ko: ["string"],
          review_warnings_ko: ["string"],
          next_actions_ko: ["string"],
        },
        samples: compactSamplesForAi(samples),
      }),
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  let res;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: prompt,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`OpenAI category intelligence failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return extractJson(json.choices?.[0]?.message?.content ?? "");
}

function markdownCatalog({ config, category, generatedAt, aiResult, prices }) {
  const lines = [];
  lines.push(`# ${config.label} — Catalog Suggestions`);
  lines.push("");
  lines.push(`- category: ${category}`);
  lines.push(`- generated_at: ${generatedAt}`);
  lines.push("");
  if (!aiResult) {
    lines.push("AI 분석이 실행되지 않았습니다.");
    return `${lines.join("\n")}\n`;
  }
  lines.push("## SKU Candidates");
  lines.push("");
  lines.push("| confidence | id | brand | model | aliases | differentiators | evidence |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const sku of aiResult.sku_candidates ?? []) {
    lines.push(`| ${sku.confidence} | ${sku.id} | ${sku.brand} | ${sku.model_name} | ${(sku.aliases ?? []).join(", ")} | ${(sku.differentiators ?? []).join(", ")} | ${(sku.evidence_pids ?? []).join(", ")} |`);
  }
  lines.push("");
  lines.push("## Alias Rules");
  lines.push("");
  for (const rule of aiResult.alias_rules ?? []) {
    lines.push(`- **${rule.canonical}** (${rule.confidence}): ${(rule.aliases ?? []).join(", ")} — pid ${(rule.evidence_pids ?? []).join(", ")}`);
  }
  lines.push("");
  lines.push("## Price Distribution Snapshot");
  lines.push("");
  lines.push("| rough key | count | p25 | median | p75 |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const row of prices.slice(0, 20)) {
    lines.push(`| ${row.key} | ${row.count} | ${row.p25.toLocaleString("ko-KR")} | ${row.median.toLocaleString("ko-KR")} | ${row.p75.toLocaleString("ko-KR")} |`);
  }
  lines.push("");
  lines.push("## Price Notes");
  lines.push("");
  for (const note of aiResult.price_notes_ko ?? []) lines.push(`- ${note}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function markdownNoise({ config, category, generatedAt, aiResult, distribution }) {
  const lines = [];
  lines.push(`# ${config.label} — Noise Rule Suggestions`);
  lines.push("");
  lines.push(`- category: ${category}`);
  lines.push(`- generated_at: ${generatedAt}`);
  lines.push("");
  lines.push("## Heuristic Distribution");
  lines.push("");
  lines.push("| type | count | top keywords |");
  lines.push("|---|---:|---|");
  for (const [type, count] of Object.entries(distribution.byType).sort((a, b) => b[1] - a[1])) {
    const top = Object.entries(distribution.keywordCounts[type] ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([kw, n]) => `${kw}(${n})`)
      .join(", ");
    lines.push(`| ${type} | ${count} | ${top} |`);
  }
  lines.push("");
  if (!aiResult) {
    lines.push("AI 분석이 실행되지 않았습니다.");
    return `${lines.join("\n")}\n`;
  }
  lines.push("## AI Noise Rules");
  lines.push("");
  for (const rule of aiResult.noise_rules ?? []) {
    lines.push(`- **[${rule.confidence}] ${rule.listing_type} → ${rule.add_to}**: ${(rule.keywords_or_regex ?? []).map((k) => `\`${k}\``).join(", ")}`);
    if (rule.rationale_ko) lines.push(`  - 사유: ${rule.rationale_ko}`);
    lines.push(`  - 근거 pid: ${(rule.evidence_pids ?? []).join(", ") || "-"}`);
    if ((rule.negative_context ?? []).length > 0) lines.push(`  - 제외 컨텍스트: ${rule.negative_context.map((k) => `\`${k}\``).join(", ")}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function markdownReview({ config, category, generatedAt, samples, aiResult }) {
  const lines = [];
  lines.push(`# ${config.label} — Category Expansion Review`);
  lines.push("");
  lines.push(`- category: ${category}`);
  lines.push(`- generated_at: ${generatedAt}`);
  lines.push(`- samples: ${samples.length}`);
  lines.push(`- ai_used: ${aiResult ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Review Warnings");
  lines.push("");
  for (const warning of aiResult?.review_warnings_ko ?? []) lines.push(`- ${warning}`);
  lines.push("");
  lines.push("## Next Actions");
  lines.push("");
  for (const action of aiResult?.next_actions_ko ?? []) lines.push(`- ${action}`);
  lines.push("");
  lines.push("## Sample Rows");
  lines.push("");
  for (const sample of samples.slice(0, 30)) {
    lines.push(`- ${sample.pid} / ${sample.name} / ${sample.price.toLocaleString("ko-KR")}원 / ${sample.roughModelKey} / noise=${Object.keys(sample.noiseHits).join(",") || "-"}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function runCategory({ category, config, limit, pages, generatedAt }) {
  const categoryDir = path.join(outDir, category);
  await mkdir(categoryDir, { recursive: true });
  let samples;
  if (hasFlag("--reuse-samples")) {
    samples = JSON.parse(await readFile(path.join(categoryDir, "samples.json"), "utf-8"));
    // Recompute noise hits with current seeds — noise rules evolve faster than samples.
    for (const sample of samples) {
      sample.noiseHits = noiseHits(sample);
    }
    console.log(`\n[${category}] reusing samples (${samples.length}) — noiseHits refreshed`);
  } else {
    console.log(`\n[${category}] collecting samples (limit=${limit}, pages=${pages})`);
    samples = await collectSamples({ queries: config.queries, limit, pages });
  }
  const prices = priceDistribution(samples, category);
  const distribution = heuristicDistribution(samples);
  console.log(`[${category}] samples=${samples.length} — calling AI`);
  let aiResult = null;
  try {
    aiResult = await callOpenAi({ samples, category, config, prices });
  } catch (err) {
    console.error(`[${category}] AI failed: ${err.message}`);
  }

  await writeFile(path.join(categoryDir, "samples.json"), JSON.stringify(samples, null, 2), "utf-8");
  await writeFile(path.join(categoryDir, "price_distribution.json"), JSON.stringify(prices, null, 2), "utf-8");
  await writeFile(path.join(categoryDir, "noise_distribution.json"), JSON.stringify(distribution, null, 2), "utf-8");
  await writeFile(path.join(categoryDir, "ai-intelligence.json"), JSON.stringify(aiResult ?? { skipped: true }, null, 2), "utf-8");
  await writeFile(path.join(categoryDir, "catalog_SUGGESTIONS.md"), markdownCatalog({ config, category, generatedAt, aiResult, prices }), "utf-8");
  await writeFile(path.join(categoryDir, "noise_PATCH.md"), markdownNoise({ config, category, generatedAt, aiResult, distribution }), "utf-8");
  await writeFile(path.join(categoryDir, "REVIEW.md"), markdownReview({ config, category, generatedAt, samples, aiResult }), "utf-8");

  console.log(`[${category}] output=${categoryDir} ai_used=${aiResult ? "yes" : "no"}`);
  return { category, samples: samples.length, aiUsed: Boolean(aiResult) };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(rootDir, "poc", ".env"));

  const limit = Number(argValue("--limit", "300"));
  const pages = Number(argValue("--pages", "2"));
  const categoryArg = argValue("--category", "smartphone");
  const generatedAt = new Date().toISOString();
  const requested = categoryArg === "all"
    ? Object.keys(CATEGORIES)
    : categoryArg.split(",").map((c) => c.trim()).filter(Boolean);

  for (const cat of requested) {
    if (!CATEGORIES[cat]) {
      console.error(`unknown category: ${cat}. available: ${Object.keys(CATEGORIES).join(", ")}, all`);
      process.exit(1);
    }
  }

  await mkdir(outDir, { recursive: true });
  console.log(`category intelligence: ${requested.join(", ")}`);
  const summaries = [];
  for (const cat of requested) {
    summaries.push(await runCategory({ category: cat, config: CATEGORIES[cat], limit, pages, generatedAt }));
  }
  console.log("\n=== summary ===");
  for (const s of summaries) console.log(`${s.category}: samples=${s.samples}, ai_used=${s.aiUsed}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
