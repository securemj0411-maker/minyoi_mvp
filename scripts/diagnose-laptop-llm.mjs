#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const EXTRACTOR_VERSION = "laptop-l1.5-llm-v2";
const TARGET_UNKNOWNS = new Set(["unknown_generation", "unknown_chip", "unknown_screen", "unknown_ram", "unknown_ssd"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);
const ALLOWED_SCOPE = new Set(["full_unit", "accessory", "parts", "service", "wanted", "unknown"]);
const ALLOWED_SCREENS = new Set([11, 12, 13, 14, 15, 16, 17]);
const ALLOWED_MEMORY = new Set([4, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128]);
const ALLOWED_SSD = new Set([128, 256, 512, 1024, 2048, 4096, 8192]);
const ALLOWED_RELEASE_YEARS = new Set(Array.from({ length: 19 }, (_, index) => 2008 + index));
const ALLOWED_CHIPS = new Set([
  "m1",
  "m1_pro",
  "m1_max",
  "m1_ultra",
  "m2",
  "m2_pro",
  "m2_max",
  "m2_ultra",
  "m3",
  "m3_pro",
  "m3_max",
  "m4",
  "m4_pro",
  "m4_max",
  "intel_i3",
  "intel_i5",
  "intel_i7",
  "intel_i9",
  "intel",
]);

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

await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function intArg(name, fallback, min, max) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 필요");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 필요");
  return { apikey: key, authorization: `Bearer ${key}` };
}

async function fetchJson(pathname) {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json();
}

function chunked(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

function inc(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function rows(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function contentHash(row) {
  return createHash("sha256")
    .update(JSON.stringify({
      title: row.name,
      price: row.price,
      description: row.description,
      parsed: row.parsed?.comparable_key,
    }))
    .digest("hex");
}

function unknownParts(parsed) {
  const fromJson = Array.isArray(parsed.parsed_json?.unknown_parts)
    ? parsed.parsed_json.unknown_parts.map(String)
    : [];
  const fromKey = String(parsed.comparable_key ?? "")
    .split("|")
    .filter((part) => part.startsWith("unknown_"));
  return [...new Set([...fromJson, ...fromKey])];
}

function targetUnknownParts(parsed) {
  return unknownParts(parsed).filter((part) => TARGET_UNKNOWNS.has(part));
}

function normalizeDescription(rawJson, preview) {
  const candidates = [
    rawJson?.description,
    rawJson?.product?.description,
    rawJson?.data?.description,
    rawJson?.data?.product?.description,
    rawJson?.item?.description,
  ];
  const found = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return String(found ?? preview ?? "").replace(/\s+/g, " ").trim().slice(0, 1200);
}

function normalizeChip(value) {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw === "unknown" || raw === "null") return null;
  const normalized = raw
    .replace(/apple\s*/g, "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace(/^i([3579])$/, "intel_i$1")
    .replace(/^intel_?core_?i([3579])$/, "intel_i$1");
  return ALLOWED_CHIPS.has(normalized) ? normalized : null;
}

function normalizeNumber(value, allowed) {
  if (value == null) return null;
  if (typeof value === "string" && ["", "unknown", "null"].includes(value.trim().toLowerCase())) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return allowed.has(rounded) ? rounded : null;
}

function normalizeExtraction(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw;
  const confidence = String(obj.confidence ?? "low").toLowerCase();
  return {
    listingScope: ALLOWED_SCOPE.has(String(obj.listing_scope ?? obj.listingScope ?? "unknown").toLowerCase())
      ? String(obj.listing_scope ?? obj.listingScope ?? "unknown").toLowerCase()
      : "unknown",
    chip: normalizeChip(obj.chip),
    screenSizeIn: normalizeNumber(obj.screen_size_in ?? obj.screenSizeIn, ALLOWED_SCREENS),
    ramGb: normalizeNumber(obj.ram_gb ?? obj.ramGb, ALLOWED_MEMORY),
    ssdGb: normalizeNumber(obj.ssd_gb ?? obj.ssdGb, ALLOWED_SSD),
    releaseYear: normalizeNumber(obj.release_year ?? obj.releaseYear, ALLOWED_RELEASE_YEARS),
    confidence: ALLOWED_CONFIDENCE.has(confidence) ? confidence : "low",
    assumedBaseModel: Boolean(obj.assumed_base_model ?? obj.assumedBaseModel ?? false),
    needsHumanReview: Boolean(obj.needs_human_review ?? obj.needsHumanReview ?? confidence === "low"),
    evidence: Array.isArray(obj.evidence) ? obj.evidence.map(String).slice(0, 5) : [],
    reason: String(obj.reason ?? "").slice(0, 300),
  };
}

function fixedUnknowns(candidate, extraction) {
  const fixed = [];
  const unknown = new Set(candidate.targetUnknowns);
  if (unknown.has("unknown_generation") && extraction.releaseYear) fixed.push("unknown_generation");
  if (unknown.has("unknown_chip") && extraction.chip) fixed.push("unknown_chip");
  if (unknown.has("unknown_screen") && extraction.screenSizeIn) fixed.push("unknown_screen");
  if (unknown.has("unknown_ram") && extraction.ramGb) fixed.push("unknown_ram");
  if (unknown.has("unknown_ssd") && extraction.ssdGb) fixed.push("unknown_ssd");
  return fixed;
}

function existingConflicts(candidate, extraction) {
  const parsed = candidate.parsed;
  const conflicts = [];
  if (parsed.chip && extraction.chip && parsed.chip !== extraction.chip) conflicts.push("chip");
  if (parsed.screen_size_in && extraction.screenSizeIn && Number(parsed.screen_size_in) !== extraction.screenSizeIn) conflicts.push("screen");
  if (parsed.ram_gb && extraction.ramGb && Number(parsed.ram_gb) !== extraction.ramGb) conflicts.push("ram");
  if (parsed.ssd_gb && extraction.ssdGb && Number(parsed.ssd_gb) !== extraction.ssdGb) conflicts.push("ssd");
  if (parsed.release_year && extraction.releaseYear && Number(parsed.release_year) !== extraction.releaseYear) conflicts.push("release_year");
  return conflicts;
}

function recommendation(candidate, extraction) {
  if (!extraction) return "not_run";
  if (extraction.listingScope && extraction.listingScope !== "full_unit") return `reject_scope:${extraction.listingScope}`;
  const fixed = fixedUnknowns(candidate, extraction);
  const conflicts = existingConflicts(candidate, extraction);
  if (conflicts.length > 0) return `human_review_conflict:${conflicts.join(",")}`;
  if (extraction.assumedBaseModel) return "human_review_assumed_base";
  if (extraction.needsHumanReview || extraction.confidence === "low") return "human_review_low_confidence";
  if (fixed.length === 0) return "no_change";
  return `candidate_fix:${fixed.join(",")}`;
}

function formatWon(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${num.toLocaleString("ko-KR")}원`;
}

function mdCell(value) {
  return String(value ?? "-").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").slice(0, 140);
}

function buildPrompt(candidate) {
  return [
    {
      role: "system",
      content:
        "You extract laptop variant specs from Korean secondhand listings. Return only JSON. Be conservative: if a spec is not explicit, return null. Do not infer base specs unless the text explicitly says base/basic/entry/깡통/기본형.",
    },
    {
      role: "user",
      content: JSON.stringify({
        schema: {
          listing_scope: "full_unit|accessory|parts|service|wanted|unknown",
          chip: "m1|m1_pro|m1_max|m2|m2_pro|m2_max|m3|m3_pro|m3_max|m4|m4_pro|m4_max|intel_i3|intel_i5|intel_i7|intel_i9|intel|null",
          screen_size_in: "11|12|13|14|15|16|17|null",
          release_year: "2008..2026|null",
          ram_gb: "4|8|12|16|18|24|32|36|48|64|96|128|null",
          ssd_gb: "128|256|512|1024|2048|4096|8192|null",
          confidence: "high|medium|low",
          assumed_base_model: "boolean",
          needs_human_review: "boolean",
          evidence: "short Korean snippets proving each extracted value",
          reason: "short Korean reason",
        },
        policy: [
          "전체 노트북 본품 판매가 아니면 listing_scope를 full_unit으로 두지 않는다.",
          "케이스, 하드쉘, 보호필름, 키보드, 트랙패드, 배터리, 액정, 로직보드, 충전기, 모니터, 스탠드, 수리/매입 글은 full_unit이 아니다.",
          "맥북 에어 기본 13인치처럼 흔한 기본값도 텍스트에 근거가 없으면 null로 둔다.",
          "13/14/15/16 같은 숫자는 화면 크기인지 명확할 때만 screen_size_in에 넣는다.",
          "연식은 2019년형/19년식/Late 2013/A2337처럼 명확한 근거가 있을 때만 release_year에 넣는다.",
          "256/512/1TB/2TB는 SSD 문맥일 때만 ssd_gb에 넣는다.",
          "8/16/24/32GB는 RAM 문맥일 때만 ram_gb에 넣는다.",
          "가격, 모델명, 추측만으로 사양을 채우지 않는다.",
        ],
        current_parse: {
          model: candidate.parsed.model,
          comparable_key: candidate.parsed.comparable_key,
          unknown_parts: candidate.targetUnknowns,
          chip: candidate.parsed.chip,
          screen_size_in: candidate.parsed.screen_size_in,
          release_year: candidate.parsed.release_year,
          laptop_model_number: candidate.parsed.parsed_json?.laptop_model_number ?? null,
          ram_gb: candidate.parsed.ram_gb,
          ssd_gb: candidate.parsed.ssd_gb,
        },
        heuristic_risk_tags: candidate.riskTags,
        listing: {
          title: candidate.name,
          price: candidate.price,
          description: candidate.description,
        },
      }),
    },
  ];
}

function heuristicRiskTags(title, description) {
  const text = `${title}\n${description}`.toLowerCase();
  const checks = [
    ["accessory_case", /(케이스|case|하드쉘|파우치|보호필름|필름|스킨|커버)/i],
    ["accessory_input", /(키보드|keyboard|마우스|mouse|트랙패드|터치패드|trackpad|touchpad)/i],
    ["parts_battery", /(배터리|battery|액정|로직보드|보드|부품|part)/i],
    ["charger_or_cable", /(충전기|어댑터|adapter|케이블|cable|맥세이프|magsafe)/i],
    ["external_display", /(모니터|monitor|display|디스플레이)/i],
    ["stand_or_dock", /(스탠드|거치대|독|dock|허브|hub)/i],
    ["wanted_or_buying", /(삽니다|매입|구해요|구매합니다|사요)/i],
    ["repair_service", /(수리|교체|업그레이드|업글|분해|청소)/i],
  ];
  return checks.filter(([, regex]) => regex.test(text)).map(([tag]) => tag);
}

async function callOpenAi(candidate, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { extraction: null, error: "OPENAI_API_KEY 없음", usage: null };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: buildPrompt(candidate),
      }),
    });
    if (!res.ok) return { extraction: null, error: `${res.status}: ${await res.text()}`, usage: null };
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { extraction: null, error: "응답 content 없음", usage: json.usage ?? null };
    return { extraction: normalizeExtraction(JSON.parse(content)), error: null, usage: json.usage ?? null };
  } catch (error) {
    return { extraction: null, error: error instanceof Error ? error.message : String(error), usage: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadLaptopCandidates(fetchLimit, reportLimit) {
  const parsedRows = await fetchJson(
    `/mvp_listing_parsed?select=pid,content_hash,category,family,model,comparable_key,chip,screen_size_in,release_year,ram_gb,ssd_gb,parse_confidence,needs_review,parsed_json&category=eq.laptop&order=parse_confidence.asc&limit=${fetchLimit}`,
  );
  const candidateParsed = parsedRows
    .map((row) => ({ ...row, targetUnknowns: targetUnknownParts(row) }))
    .filter((row) => row.targetUnknowns.length > 0);
  const pids = candidateParsed.map((row) => Number(row.pid)).filter(Number.isFinite);
  const rawMap = new Map();
  for (const chunk of chunked(pids, 200)) {
    const rawRows = await fetchJson(
      `/mvp_raw_listings?select=pid,name,price,description_preview,raw_json,listing_type,detail_status,last_seen_at&pid=in.(${chunk.join(",")})`,
    );
    for (const row of rawRows) rawMap.set(Number(row.pid), row);
  }
  return candidateParsed
    .map((parsed) => {
      const raw = rawMap.get(Number(parsed.pid));
      if (!raw || raw.listing_type !== "normal" || raw.detail_status !== "done") return null;
      const description = normalizeDescription(raw.raw_json, raw.description_preview);
      const riskTags = heuristicRiskTags(raw.name ?? "", description);
      return {
        pid: Number(parsed.pid),
        name: raw.name ?? "",
        price: raw.price,
        description,
        riskTags,
        lastSeenAt: raw.last_seen_at,
        parsed,
        targetUnknowns: parsed.targetUnknowns,
      };
    })
    .filter(Boolean)
    .slice(0, reportLimit);
}

function buildReport({ candidates, results, useAi, model, generatedAt, estimatedCostUsd }) {
  const byUnknown = new Map();
  const byRecommendation = new Map();
  const byRiskTag = new Map();
  for (const candidate of candidates) {
    for (const unknown of candidate.targetUnknowns) inc(byUnknown, unknown);
    for (const tag of candidate.riskTags) inc(byRiskTag, tag);
  }
  for (const item of results) inc(byRecommendation, item.recommendation);

  const lines = [];
  lines.push(`# Laptop L1.5 LLM Extractor Diagnosis`);
  lines.push("");
  lines.push(`- generated_at: ${generatedAt}`);
  lines.push(`- extractor_version: ${EXTRACTOR_VERSION}`);
  lines.push(`- mode: ${useAi ? "AI sample" : "dry-run candidate scan"}`);
  lines.push(`- model: ${useAi ? model : "not_called"}`);
  lines.push(`- candidates: ${candidates.length.toLocaleString("ko-KR")}`);
  lines.push(`- estimated_cost_usd: ${estimatedCostUsd == null ? "-" : estimatedCostUsd.toFixed(6)}`);
  lines.push("");
  lines.push("## Unknown Parts");
  lines.push("");
  lines.push("| unknown | count |");
  lines.push("| --- | ---: |");
  for (const [key, count] of rows(byUnknown)) lines.push(`| ${key} | ${count} |`);
  lines.push("");
  lines.push("## Heuristic Risk Tags");
  lines.push("");
  lines.push("| risk_tag | count |");
  lines.push("| --- | ---: |");
  for (const [key, count] of rows(byRiskTag)) lines.push(`| ${key} | ${count} |`);
  if (byRiskTag.size === 0) lines.push("| - | 0 |");
  lines.push("");
  lines.push("## Recommendation Summary");
  lines.push("");
  lines.push("| recommendation | count |");
  lines.push("| --- | ---: |");
  for (const [key, count] of rows(byRecommendation)) lines.push(`| ${mdCell(key)} | ${count} |`);
  lines.push("");
  lines.push("## Samples");
  lines.push("");
  lines.push("| pid | price | title | risks | unknowns | current_key | extraction | recommendation |");
  lines.push("| ---: | ---: | --- | --- | --- | --- | --- | --- |");
  for (const item of results) {
    const extraction = item.extraction
      ? [
          item.extraction.listingScope,
          item.extraction.chip,
          item.extraction.releaseYear ? `${item.extraction.releaseYear}y` : null,
          item.extraction.screenSizeIn ? `${item.extraction.screenSizeIn}in` : null,
          item.extraction.ramGb ? `${item.extraction.ramGb}GB RAM` : null,
          item.extraction.ssdGb ? `${item.extraction.ssdGb}GB SSD` : null,
          item.extraction.confidence,
          item.extraction.assumedBaseModel ? "assumed_base" : null,
        ].filter(Boolean).join(" / ")
      : (item.error ? `error: ${item.error}` : "not_run");
    lines.push(
      `| ${item.candidate.pid} | ${formatWon(item.candidate.price)} | ${mdCell(item.candidate.name)} | ${mdCell(item.candidate.riskTags.join(", "))} | ${mdCell(item.candidate.targetUnknowns.join(", "))} | ${mdCell(item.candidate.parsed.comparable_key)} | ${mdCell(extraction)} | ${mdCell(item.recommendation)} |`,
    );
  }
  lines.push("");
  lines.push("## Guardrails");
  lines.push("");
  lines.push("- 이 스크립트는 DB에 쓰지 않는다. 후보풀/팩 공개 로직에 영향 없음.");
  lines.push("- `--ai` 플래그가 있을 때만 OpenAI를 호출한다.");
  lines.push("- `assumed_base_model=true`, `confidence=low`, 기존 파서 값과 충돌하는 결과는 자동 승격 금지.");
  lines.push("- `listing_scope !== full_unit`이면 사양을 뽑아도 시세/후보풀에 반영하지 않는다.");
  lines.push("- 노트북 카테고리는 현재 `internal_only`라서, 추출 결과가 좋아도 별도 승격 결정 전까지 공개 후보팩에 들어가지 않는다.");
  lines.push("- 다음 단계에서 DB 캐시를 만들 경우 `pid + content_hash + extractor_version` 기준으로 캐시하고 RLS를 켠다.");
  return lines.join("\n");
}

const reportLimit = intArg("limit", 30, 1, 100);
const fetchLimit = intArg("fetch-limit", 1000, reportLimit, 5000);
const useAi = hasFlag("ai");
const model = process.env.OPENAI_LAPTOP_EXTRACTOR_MODEL || process.env.OPENAI_CLASSIFIER_MODEL || "gpt-4.1-mini";
const inputCost = Number(process.env.OPENAI_LAPTOP_EXTRACTOR_INPUT_USD_PER_1M ?? process.env.OPENAI_CLASSIFIER_INPUT_USD_PER_1M ?? 0.4);
const outputCost = Number(process.env.OPENAI_LAPTOP_EXTRACTOR_OUTPUT_USD_PER_1M ?? process.env.OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M ?? 1.6);

const candidates = await loadLaptopCandidates(fetchLimit, reportLimit);
const results = [];
let estimatedCostUsd = 0;

for (const candidate of candidates) {
  const item = { candidate, extraction: null, error: null, usage: null, recommendation: "not_run", hash: contentHash(candidate) };
  if (useAi) {
    const ai = await callOpenAi(candidate, model);
    item.extraction = ai.extraction;
    item.error = ai.error;
    item.usage = ai.usage;
    item.recommendation = recommendation(candidate, ai.extraction);
    const promptTokens = Number(ai.usage?.prompt_tokens ?? 0);
    const completionTokens = Number(ai.usage?.completion_tokens ?? 0);
    estimatedCostUsd += ((promptTokens * inputCost) + (completionTokens * outputCost)) / 1_000_000;
  }
  results.push(item);
}

await mkdir(reportsDir, { recursive: true });
const generatedAt = new Date().toISOString();
const fileDate = generatedAt.slice(0, 10);
const modeSlug = useAi ? "ai" : "dry-run";
const reportPath = path.join(reportsDir, `laptop-l1-llm-diagnosis-${fileDate}-${modeSlug}.md`);
await writeFile(reportPath, buildReport({
  candidates,
  results,
  useAi,
  model,
  generatedAt,
  estimatedCostUsd: useAi ? estimatedCostUsd : null,
}), "utf-8");

console.log(JSON.stringify({
  report: reportPath,
  mode: useAi ? "ai" : "dry-run",
  extractorVersion: EXTRACTOR_VERSION,
  candidates: candidates.length,
  estimatedCostUsd: useAi ? Number(estimatedCostUsd.toFixed(8)) : null,
}, null, 2));
