import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const rootDir = path.join(appDir, "..");
const outDir = path.join(appDir, "rule-mining");

const SEARCH_QUERIES = [
  "에어팟",
  "에어팟 프로",
  "에어팟 프로2",
  "에어팟 4세대",
  "에어팟 맥스",
  "애플워치",
  "애플워치 se",
  "애플워치 9",
  "애플워치 10",
  "애플워치 울트라",
  "갤럭시워치",
  "갤럭시 워치 6",
  "갤럭시 워치 7",
  "갤럭시 워치 울트라",
];

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
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
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

async function collectSamples({ limit, pages }) {
  const byPid = new Map();
  for (const query of SEARCH_QUERIES) {
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
      console.log(`detail ${index + 1}/${selected.length}`);
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

async function callOpenAi(samples) {
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
          "Analyze these Bunjang listings and propose high-precision noise filtering rules for resale candidate scoring. Categories: counterfeit, parts, buying, callout, damaged, accessory, multi, suspicious_deep_discount, normal_positive. Include evidence pids and exact Korean keywords.",
        output_schema: {
          rules: [
            {
              category: "counterfeit|parts|buying|callout|damaged|accessory|multi|suspicious_deep_discount|normal_positive",
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

function markdownReport({ generatedAt, samples, heuristicSummary, aiResult }) {
  const lines = [];
  lines.push("# Rule Mining Report");
  lines.push("");
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

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(rootDir, "poc", ".env"));

  const limit = Number(argValue("--limit", "250"));
  const pages = Number(argValue("--pages", "2"));
  const generatedAt = new Date().toISOString();
  await mkdir(outDir, { recursive: true });

  console.log(`collecting samples: limit=${limit}, pages=${pages}`);
  const samples = await collectSamples({ limit, pages });
  const heuristicSummary = summarizeHeuristics(samples);
  const aiResult = await callOpenAi(samples);

  const result = { generatedAt, samples, heuristicSummary, aiResult };
  await writeFile(path.join(outDir, "latest_samples.json"), JSON.stringify(samples, null, 2), "utf-8");
  await writeFile(path.join(outDir, "latest_rules.json"), JSON.stringify(result, null, 2), "utf-8");
  await writeFile(path.join(outDir, "RULE_MINING_REPORT.md"), markdownReport(result), "utf-8");

  console.log(`samples=${samples.length}`);
  console.log(`ai_used=${aiResult ? "yes" : "no"}`);
  console.log(`report=${path.join(outDir, "RULE_MINING_REPORT.md")}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
