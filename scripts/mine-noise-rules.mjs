import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const rootDir = path.join(appDir, "..");
const outDir = path.join(appDir, "rule-mining");

const CATEGORIES = {
  airpods: {
    label: "AirPods",
    queries: [
      "에어팟",
      "에어팟 프로",
      "에어팟 프로2",
      "에어팟 4세대",
      "에어팟 맥스",
    ],
    skus: [
      "airpods-2",
      "airpods-3",
      "airpods-4",
      "airpods-pro-1",
      "airpods-pro-2-lightning",
      "airpods-pro-2-usbc",
      "airpods-max",
    ],
    aiHints:
      "AirPods 라인업입니다. 자주 발생하는 노이즈: 본체만/유닛만 (좌·우·한쪽), 충전케이스 단독 매물, 노이즈캔슬링 고장, USB-C/Lightning 커넥터 혼동, '4세대'와 '4세대 ANC(Pro 4)' 구분, '에어팟 프로 3/4' 같은 존재하지 않는 모델 표기. multiModelHits 정규식 (slash/comma 등으로 여러 모델 나열) 케이스도 자주 새고 있음.",
  },
  applewatch: {
    label: "Apple Watch",
    queries: [
      "애플워치",
      "애플워치 se",
      "애플워치 9",
      "애플워치 10",
      "애플워치 울트라",
    ],
    skus: [
      "applewatch-se1",
      "applewatch-se2",
      "applewatch-se3",
      "applewatch-series7",
      "applewatch-series8",
      "applewatch-series9",
      "applewatch-series10",
      "applewatch-ultra",
      "applewatch-ultra2",
    ],
    aiHints:
      "Apple Watch 라인업입니다. 자주 발생하는 노이즈: 스트랩/밴드 단독 판매, 배터리효율 80% 미만 표기 매물, GPS와 셀룰러(LTE) 모델 혼동, 사이즈(40·41·44·45·49mm) 두 개 이상 나열, 에르메스/Nike/하이브리드 에디션 가격 차이, '애플워치 SE 무세대' 같은 모호 표기. AirPods 대비 노이즈 어휘가 더 다양하므로 카테고리 특화 키워드 발굴이 중요.",
  },
  galaxywatch: {
    label: "Galaxy Watch",
    queries: [
      "갤럭시워치",
      "갤럭시 워치 6",
      "갤럭시 워치 7",
      "갤럭시 워치 울트라",
    ],
    skus: [
      "galaxywatch-6",
      "galaxywatch-7",
      "galaxywatch-ultra",
    ],
    aiHints:
      "Galaxy Watch 라인업입니다. 자주 발생하는 노이즈: 클래식 vs 일반 모델 혼동, LTE/블루투스 모델 혼동, 베젤·스트랩 단독 판매, 호환 액세서리(서드파티), 카탈로그 외 모델(갤워치 4·5)이 검색에 섞여 들어옴. '갤럭시 워치6 / 클래식 / 울트라' 같은 슬래시 나열 다중 모델은 multiModelHits 보강 후에도 새는 케이스가 있는지 확인 필요.",
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

const SEED_RULES = {
  counterfeit: ["타오바오", "타오바이", "taobao", "짭", "가품", "짝퉁", "레플", "레플리카", "이미테이션", "정품아님", "비정품"],
  parts: ["본체만", "본체", "유닛만", "유닛", "한쪽", "한짝", "케이스만", "충전케이스만", "액정만", "배터리만"],
  buying: ["구합니다", "구해요", "삽니다", "급구", "매입", "구매합니다"],
  damaged: ["고장", "하자", "충전안됨", "충전 안됨", "먹통", "작동안됨", "불량", "노캔 안됨", "툭툭", "끊김"],
  accessory: ["스트랩", "밴드", "파우치", "키링", "거치대", "필름", "강화유리", "커버", "실리콘", "이어팁"],
  multi: ["일괄", "묶음", "각각", "선택", "여러개", "재고"],
  callout: ["사지마세요", "사기당함", "사기꾼", "저격", "도용", "조심"],
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

function heuristicTypes(sample) {
  const text = `${sample.name}\n${sample.description}`;
  const hits = {};
  for (const [type, keywords] of Object.entries(SEED_RULES)) {
    const found = includesAny(text, keywords);
    if (found.length > 0) hits[type] = found;
  }
  if (sample.price > 0 && sample.skuHint === "AirPods Max" && sample.price < 80000) {
    hits.deep_discount = [`AirPods Max ${sample.price.toLocaleString("ko-KR")}원`];
  }
  return hits;
}

function skuHint(name) {
  const text = compact(name);
  if (text.includes("맥스") || text.includes("max")) return "AirPods Max";
  if (text.includes("프로") || text.includes("pro")) return "AirPods Pro";
  if (text.includes("에어팟")) return "AirPods";
  if (text.includes("애플워치") || text.includes("applewatch")) return "Apple Watch";
  if (text.includes("갤럭시")) return "Galaxy Watch";
  return "unknown";
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
    description: String(product.description ?? "").slice(0, 800),
    brand: String(product.brand ?? ""),
    saleStatus: String(product.saleStatus ?? ""),
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
      skuHint: skuHint(item.name),
    };
    sample.heuristicTypes = heuristicTypes(sample);
    samples.push(sample);
    if ((index + 1) % 25 === 0) {
      console.log(`  detail ${index + 1}/${selected.length}`);
    }
  }
  return samples;
}

function summarizeHeuristics(samples) {
  const byType = {};
  const keywordCounts = {};
  for (const sample of samples) {
    for (const [type, hits] of Object.entries(sample.heuristicTypes)) {
      byType[type] = (byType[type] ?? 0) + 1;
      keywordCounts[type] ??= {};
      for (const hit of hits) {
        keywordCounts[type][hit] = (keywordCounts[type][hit] ?? 0) + 1;
      }
    }
  }
  return { byType, keywordCounts };
}

function compactSamplesForAi(samples) {
  return samples.slice(0, 60).map((sample) => ({
    pid: sample.pid,
    name: sample.name,
    price: sample.price,
    query: sample.query,
    sku_hint: sample.skuHint,
    heuristic_types: Object.keys(sample.heuristicTypes),
    description: sample.description.slice(0, 320),
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

async function callOpenAi({ samples, category, config }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || hasFlag("--no-ai")) return null;

  const model = process.env.OPENAI_RULE_MODEL || "gpt-4.1-mini";
  const input = compactSamplesForAi(samples);
  const prompt = [
    {
      role: "system",
      content:
        "You are a Korean marketplace resale listing noise-rule miner. Return only valid JSON. Find patterns that should be filtered before scoring. Prefer high-precision Korean substring rules. Do not invent patterns unsupported by samples.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task:
          `Analyze these Bunjang listings for the "${config.label}" category and propose high-precision noise filtering rules to add to the existing pipeline. Existing keyword constants in pipeline.ts: BUYING_KEYWORDS, CALLOUT_KEYWORDS, PARTS_KEYWORDS, DAMAGED_KEYWORDS, ACCESSORY_TITLE_KEYWORDS, MULTI_KEYWORDS. Recommend additions only when supported by 2+ sample evidence. Categories: counterfeit, parts, buying, callout, damaged, accessory, multi, suspicious_deep_discount, normal_positive.`,
        category,
        category_label: config.label,
        category_skus: config.skus,
        category_hints: config.aiHints,
        output_schema: {
          rules: [
            {
              category: "counterfeit|parts|buying|callout|damaged|accessory|multi|suspicious_deep_discount|normal_positive",
              add_to_constant: "PARTS_KEYWORDS|DAMAGED_KEYWORDS|MULTI_KEYWORDS|ACCESSORY_TITLE_KEYWORDS|BUYING_KEYWORDS|CALLOUT_KEYWORDS|none",
              keywords: ["string"],
              negative_context: ["string"],
              confidence: "high|medium|low",
              rationale_ko: "string",
              evidence_pids: ["string"],
            },
          ],
          observations_ko: ["string"],
          recommended_code_changes_ko: ["string"],
        },
        samples: input,
      }),
    },
  ];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI rule mining failed: ${res.status} ${body}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "";
  return extractJson(content);
}

function markdownReport({ category, config, generatedAt, samples, heuristicSummary, aiResult }) {
  const lines = [];
  lines.push(`# Rule Mining Report — ${config.label}`);
  lines.push("");
  lines.push(`- category: ${category}`);
  lines.push(`- generated_at: ${generatedAt}`);
  lines.push(`- samples: ${samples.length}`);
  lines.push(`- ai_used: ${aiResult ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Heuristic Distribution");
  lines.push("");
  lines.push("| type | count | top keywords |");
  lines.push("|---|---:|---|");
  for (const [type, count] of Object.entries(heuristicSummary.byType).sort((a, b) => b[1] - a[1])) {
    const top = Object.entries(heuristicSummary.keywordCounts[type] ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([kw, n]) => `${kw}(${n})`)
      .join(", ");
    lines.push(`| ${type} | ${count} | ${top} |`);
  }
  lines.push("");
  lines.push("## AI Proposed Rules");
  lines.push("");
  if (!aiResult) {
    lines.push("- AI 분석은 실행되지 않았습니다. `OPENAI_API_KEY`를 설정하고 다시 실행하세요.");
  } else {
    lines.push("| category | confidence | keywords | evidence | rationale |");
    lines.push("|---|---|---|---|---|");
    for (const rule of aiResult.rules ?? []) {
      lines.push(
        `| ${rule.category} | ${rule.confidence} | ${(rule.keywords ?? []).join(", ")} | ${(rule.evidence_pids ?? []).join(", ")} | ${String(rule.rationale_ko ?? "").replace(/\|/g, "/")} |`,
      );
    }
    lines.push("");
    lines.push("## Observations");
    lines.push("");
    for (const obs of aiResult.observations_ko ?? []) lines.push(`- ${obs}`);
    lines.push("");
    lines.push("## Recommended Code Changes");
    lines.push("");
    for (const change of aiResult.recommended_code_changes_ko ?? []) lines.push(`- ${change}`);
  }
  lines.push("");
  lines.push("## High-Risk Samples");
  lines.push("");
  const risky = samples
    .filter((sample) => Object.keys(sample.heuristicTypes).length > 0)
    .slice(0, 20);
  for (const sample of risky) {
    lines.push(`- ${sample.pid} / ${sample.name} / ${sample.price.toLocaleString("ko-KR")}원 / ${Object.keys(sample.heuristicTypes).join(", ")}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function markdownPatch({ category, config, generatedAt, aiResult, samples }) {
  const lines = [];
  lines.push(`# ${config.label} — pipeline.ts 노이즈 키워드 추가 제안`);
  lines.push("");
  lines.push(`- category: ${category}`);
  lines.push(`- generated_at: ${generatedAt}`);
  lines.push(`- 사용법: 아래 권장 키워드를 \`mvp/src/lib/pipeline.ts\` 의 해당 상수 배열에 추가하고 \`npm run build\` 통과 확인. 검증 후 commit.`);
  lines.push("");

  if (!aiResult || !Array.isArray(aiResult.rules)) {
    lines.push("AI 분석이 실행되지 않아 패치 제안 없음. `OPENAI_API_KEY` 설정 후 재실행.");
    return `${lines.join("\n")}\n`;
  }

  const buckets = new Map();
  for (const rule of aiResult.rules) {
    const target = rule.add_to_constant && rule.add_to_constant !== "none"
      ? rule.add_to_constant
      : `(${rule.category})`;
    if (!buckets.has(target)) buckets.set(target, []);
    buckets.get(target).push(rule);
  }

  for (const [target, rules] of buckets.entries()) {
    lines.push(`## ${target} 추가 후보`);
    lines.push("");
    for (const rule of rules) {
      const kws = (rule.keywords ?? []).filter(Boolean);
      if (kws.length === 0) continue;
      const evidence = (rule.evidence_pids ?? []).slice(0, 4).join(", ") || "-";
      const conf = rule.confidence ?? "?";
      lines.push(`- **[${conf}]** ${kws.map((k) => `\`${k}\``).join(", ")}`);
      if (rule.rationale_ko) lines.push(`  - 사유: ${rule.rationale_ko}`);
      lines.push(`  - 근거 pid: ${evidence}`);
      if (Array.isArray(rule.negative_context) && rule.negative_context.length > 0) {
        lines.push(`  - 제외 컨텍스트: ${rule.negative_context.map((k) => `\`${k}\``).join(", ")}`);
      }
    }
    lines.push("");
  }

  lines.push("## 검수 노트 (AI observations)");
  lines.push("");
  for (const obs of aiResult.observations_ko ?? []) lines.push(`- ${obs}`);
  lines.push("");

  lines.push("## 샘플 평균 통계");
  lines.push("");
  const totalRisky = samples.filter((s) => Object.keys(s.heuristicTypes).length > 0).length;
  lines.push(`- 전체 샘플: ${samples.length}건`);
  lines.push(`- 휴리스틱 1개 이상 매칭: ${totalRisky}건 (${((totalRisky / Math.max(1, samples.length)) * 100).toFixed(1)}%)`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function runCategory({ category, config, limit, pages, generatedAt }) {
  const categoryDir = path.join(outDir, category);
  await mkdir(categoryDir, { recursive: true });

  console.log(`\n[${category}] collecting samples (limit=${limit}, pages=${pages})`);
  const samples = await collectSamples({ queries: config.queries, limit, pages });
  const heuristicSummary = summarizeHeuristics(samples);

  console.log(`[${category}] heuristics done — calling AI`);
  let aiResult = null;
  try {
    aiResult = await callOpenAi({ samples, category, config });
  } catch (err) {
    console.error(`[${category}] AI call failed: ${err.message}`);
  }

  await writeFile(path.join(categoryDir, "samples.json"), JSON.stringify(samples, null, 2), "utf-8");
  await writeFile(path.join(categoryDir, "distribution.json"), JSON.stringify(heuristicSummary, null, 2), "utf-8");
  await writeFile(path.join(categoryDir, "ai-suggestions.json"), JSON.stringify(aiResult ?? { skipped: true }, null, 2), "utf-8");
  await writeFile(
    path.join(categoryDir, "RULE_MINING_REPORT.md"),
    markdownReport({ category, config, generatedAt, samples, heuristicSummary, aiResult }),
    "utf-8",
  );
  await writeFile(
    path.join(categoryDir, "PATCH.md"),
    markdownPatch({ category, config, generatedAt, aiResult, samples }),
    "utf-8",
  );

  console.log(`[${category}] samples=${samples.length} ai_used=${aiResult ? "yes" : "no"}`);
  console.log(`[${category}] output=${categoryDir}`);
  return { category, samples: samples.length, aiUsed: Boolean(aiResult) };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(rootDir, "poc", ".env"));

  const limit = Number(argValue("--limit", "250"));
  const pages = Number(argValue("--pages", "2"));
  const categoryArg = argValue("--category", "all");
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
  console.log(`mining categories: ${requested.join(", ")}`);

  const summaries = [];
  for (const cat of requested) {
    const summary = await runCategory({
      category: cat,
      config: CATEGORIES[cat],
      limit,
      pages,
      generatedAt,
    });
    summaries.push(summary);
  }

  console.log("\n=== summary ===");
  for (const s of summaries) {
    console.log(`${s.category}: samples=${s.samples}, ai_used=${s.aiUsed}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
