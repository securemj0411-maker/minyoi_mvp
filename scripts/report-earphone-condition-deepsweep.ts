import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const decisionDir = path.join(appDir, "docs", "DECISIONS");

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  comparable_key: string | null;
  last_verified_at: string | null;
};

type RawRow = {
  pid: number;
  name: string | null;
  description_preview: string | null;
  sku_id: string | null;
  sku_name: string | null;
  price: number | null;
  source: string | null;
  listing_state: string | null;
  sale_status: string | null;
  detail_status: string | null;
  listing_type: string | null;
  bunjang_condition_label: string | null;
  last_seen_at: string | null;
};

type ParsedPidRow = {
  pid: number;
  parsed_at: string | null;
};

type Finding = {
  pid: number;
  title: string;
  price: number | null;
  source: string | null;
  skuId: string | null;
  comparableKey: string | null;
  poolStatus: string | null;
  expectedProfitMin: number | null;
  listingState: string | null;
  saleStatus: string | null;
  conditionClass: string;
  conditionNotes: string[];
  flags: string[];
  text: string;
};

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional local env file.
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

async function fetchAll<T>(baseUrl: string, limit: number, orderBy?: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  const ordered = orderBy ? `${baseUrl}&order=${encodeURIComponent(orderBy)}` : baseUrl;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset);
    const page = await fetchJson<T>(`${ordered}&limit=${pageLimit}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageLimit) break;
  }
  return rows;
}

function rawSelect() {
  return [
    "pid",
    "name",
    "description_preview",
    "sku_id",
    "sku_name",
    "price",
    "source",
    "listing_state",
    "sale_status",
    "detail_status",
    "listing_type",
    "bunjang_condition_label",
    "last_seen_at",
  ].join(",");
}

async function fetchPoolRows(limit: number, statusesCsv: string) {
  const statuses = statusesCsv.split(",").map((item) => item.trim()).filter(Boolean).join(",") || "ready,reserved";
  const select = "pid,status,category,expected_profit_min,expected_profit_max,comparable_key,last_verified_at";
  const url = `${tableUrl("mvp_candidate_pool")}?select=${select}&category=eq.earphone&status=in.(${statuses})`;
  return fetchAll<PoolRow>(url, limit, "last_verified_at.desc.nullslast");
}

async function fetchRawByPid(pids: number[]) {
  const rows: RawRow[] = [];
  for (const part of chunk([...new Set(pids)], 180)) {
    rows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=${rawSelect()}&pid=in.(${part.join(",")})&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchRecentEarphoneRaw(limit: number, windowHours: number) {
  const since = hoursAgo(windowHours);
  const parsedUrl = `${tableUrl("mvp_listing_parsed")}?select=pid,parsed_at&category=eq.earphone&parsed_at=gte.${encodeURIComponent(since)}`;
  const parsedRows = await fetchAll<ParsedPidRow>(parsedUrl, limit, "parsed_at.desc.nullslast");
  return fetchRawByPid(parsedRows.map((row) => Number(row.pid)).filter(Number.isFinite));
}

function countBy(rows: Finding[], keyFn: (row: Finding) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row) || "(null)";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function normalized(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasNegated(text: string, target: string) {
  return new RegExp(`${target}.{0,18}(?:없|없음|없습니다|없어요|아님|아닙니다|정상|잘\\s*(?:됨|됩니다|작동))`).test(text);
}

function learnedFlags(textRaw: string) {
  const text = normalized(textRaw);
  const compact = text.replace(/\s+/g, "");
  const flags: string[] = [];
  const hasBothSides = /(?:양쪽|좌우|왼쪽.{0,16}오른쪽|오른쪽.{0,16}왼쪽|좌측.{0,16}우측|우측.{0,16}좌측)/.test(text);
  if (!hasBothSides && /(?:한\s*쪽만|한쪽만|한\s*짝|한짝|왼쪽\s*(?:만|유닛|이어버드|이어폰)|오른쪽\s*(?:만|유닛|이어버드|이어폰)|좌측\s*(?:만|유닛)|우측\s*(?:만|유닛)|l\s*유닛|r\s*유닛|left\s*only|right\s*only)/i.test(text)) {
    flags.push("learned_single_side_unit");
  }
  if (/(?:왼쪽|오른쪽|좌측|우측|한쪽|이어버드|유닛\s*(?:은|는|이|가|을|를|만)).{0,18}(?:없|없는|없음|분실|잃어|미포함)|유닛\s*(?:없|없는|없음|분실|잃어|미포함)|(?:없|없는|없음|분실|잃어|미포함).{0,18}(?:왼쪽|오른쪽|좌측|우측|한쪽|이어버드|유닛)/.test(text)) {
    flags.push("learned_missing_unit");
  }
  if (!hasNegated(text, "(?:소리|음질|사운드|오디오|스피커|좌우)") && /(?:소리|음질|사운드|오디오).{0,24}(?:안\s*나|안나|안\s*들|안들|작게\s*나|먹먹|끊|튀|깨짐|이상|문제|불량)|(?:한쪽|왼쪽|오른쪽).{0,20}(?:안\s*들|안들|소리\s*안|소리\s*작|작게\s*나)|지지직|잡음|화이트\s*노이즈/.test(text)) {
    flags.push("learned_audio_issue");
  }
  if (!hasNegated(text, "(?:노캔|노이즈\\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc|주변음|투명\\s*모드)") && /(?:노캔|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc|주변음|투명\s*모드).{0,28}(?:불량|고장|문제|이상|안\s*됨|안됨|작동\s*안|지지직|잡음|먹통)/.test(text)) {
    flags.push("learned_anc_issue");
  }
  if (!hasNegated(text, "(?:마이크|통화|전화)") && /(?:마이크|통화|전화).{0,24}(?:이상|불량|안\s*됨|안됨|문제|고장|먹통|소리\s*작|작동\s*안)/.test(text)) {
    flags.push("learned_mic_issue");
  }
  if (!hasNegated(text, "(?:페어링|연결|블루투스)") && /(?:페어링|연결|블루투스).{0,24}(?:안\s*됨|안됨|불량|문제|끊김|끊겨|먹통|인식\s*불|불안정)/.test(text)) {
    flags.push("learned_pairing_issue");
  }
  if (!hasNegated(text, "(?:배터리|충전)") && /배터리.{0,24}(?:빨리\s*닳|광탈|방전|오래\s*못|짧|효율\s*(?:낮|나쁨|안\s*좋))|충전(?!기).{0,24}(?:안\s*됨|안됨|불량|문제|고장|인식\s*불|안\s*되)|광탈|방전/.test(text)) {
    flags.push("learned_battery_or_charge_issue");
  }
  if (/(?:충전\s*)?케이스\s*(?:만|단품)|유닛\s*(?:없|없는|없음|분실|미포함).{0,18}(?:충전\s*)?케이스|(?:충전\s*)?케이스.{0,18}유닛\s*(?:없|없는|없음|분실|미포함)/.test(text)) {
    flags.push("learned_charging_case_only");
  }
  if (!/(?:깨짐|파손|크랙|찢어|침수).{0,18}(?:없|없음|없습니다|없이|아님|아닙니다)|파손\s*우려/.test(text) && /깨졌|깨짐|깨진|깨져|파손|크랙|금\s*갔|부러|휘어|침수|안\s*닫|안닫|닫힘\s*불량|찢어짐|찢김/.test(text)) {
    flags.push("learned_physical_damage");
  }
  if (!/(?:오염|이염|얼룩|냄새|담배).{0,18}(?:없|없음|없습니다|없이|아님|아닙니다|깨끗)/.test(text) && /오염|이염|얼룩|때\s*탐|때탐|화장품|냄새|담배|땀/.test(text)) {
    flags.push("learned_hygiene_warning");
  }
  if (/노캔(?:안되는|없는|x|ㄴㄴ|미지원)|비\s*노캔|ancx/.test(compact)) {
    flags.push("variant_no_anc_not_defect");
  }
  return [...new Set(flags)];
}

function summarizeFindings(rows: Array<{ raw: RawRow; pool?: PoolRow }>) {
  const findings: Finding[] = [];
  for (const { raw, pool } of rows) {
    const title = raw.name ?? "";
    const description = raw.description_preview ?? "";
    const parsed = parseListingOptions({
      category: "earphone",
      skuId: raw.sku_id,
      skuName: raw.sku_name,
      title,
      description,
      bunjangConditionLabel: raw.bunjang_condition_label,
    });
    const learned = learnedFlags(`${title}\n${description}`);
    const hardByCurrentParser = parsed.conditionClass === "flawed" || parsed.conditionNotes.some((note) =>
      [
        "single_side_only",
        "parts_only",
        "accessory_compatible_for_other_product",
        "repair_or_defect_signal",
        "earphone_single_side_unit",
        "earphone_case_only",
        "earphone_audio_issue",
        "earphone_anc_issue",
        "earphone_mic_issue",
        "earphone_pairing_issue",
        "earphone_battery_issue",
        "earphone_physical_damage",
      ].includes(note),
    );
    const learnedHard = learned.some((flag) => flag !== "variant_no_anc_not_defect" && flag !== "learned_hygiene_warning");
    if (!learnedHard && !hardByCurrentParser) continue;
    if (hardByCurrentParser && learned.length === 0) continue;
    findings.push({
      pid: Number(raw.pid),
      title,
      price: raw.price,
      source: raw.source,
      skuId: raw.sku_id,
      comparableKey: parsed.comparableKey,
      poolStatus: pool?.status ?? null,
      expectedProfitMin: pool?.expected_profit_min ?? null,
      listingState: raw.listing_state,
      saleStatus: raw.sale_status,
      conditionClass: parsed.conditionClass,
      conditionNotes: parsed.conditionNotes,
      flags: [
        ...learned,
        ...(hardByCurrentParser ? ["current_parser_hard"] : ["current_parser_not_hard"]),
      ],
      text: description.slice(0, 260),
    });
  }
  return findings;
}

function renderMarkdown(report: {
  generatedAt: string;
  scope: Record<string, unknown>;
  totals: Record<string, unknown>;
  byFlag: Record<string, number>;
  bySource: Record<string, number>;
  candidates: Finding[];
}) {
  const lines: string[] = [
    "# Earphone Condition Deep Sweep",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Scope",
    ...Object.entries(report.scope).map(([key, value]) => `- ${key}: ${String(value)}`),
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${String(value)}`),
    "",
    "## By Flag",
    ...Object.entries(report.byFlag).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## By Source",
    ...Object.entries(report.bySource).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Samples",
  ];
  for (const sample of report.candidates.slice(0, 80)) {
    lines.push(`- pid ${sample.pid}: ${sample.title} / ${sample.source} / pool=${sample.poolStatus ?? "-"} / class=${sample.conditionClass} / notes=${sample.conditionNotes.join(",") || "-"} / flags=${sample.flags.join(",")}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });
  await mkdir(decisionDir, { recursive: true });

  const scope = arg("scope", "pool");
  const limit = Number(arg("limit", "5000"));
  const windowHours = Number(arg("window-hours", "168"));
  const statuses = arg("pool-statuses", "ready,reserved");
  const decisionLog = arg("decision-log", "");

  let poolRows: PoolRow[] = [];
  let rawRows: RawRow[] = [];
  if (scope === "pool") {
    poolRows = await fetchPoolRows(limit, statuses);
    rawRows = await fetchRawByPid(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite));
  } else {
    rawRows = await fetchRecentEarphoneRaw(limit, windowHours);
  }
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  const rows = rawRows.map((raw) => ({ raw, pool: poolByPid.get(Number(raw.pid)) }));
  const candidates = summarizeFindings(rows);
  const byFlag: Record<string, number> = {};
  for (const row of candidates) {
    for (const flag of row.flags) byFlag[flag] = (byFlag[flag] ?? 0) + 1;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    scope: { scope, limit, windowHours, poolStatuses: statuses },
    totals: {
      poolRows: poolRows.length,
      rawRows: rawRows.length,
      candidateRows: candidates.length,
      currentParserNotHardRows: candidates.filter((row) => row.flags.includes("current_parser_not_hard")).length,
      currentParserHardRows: candidates.filter((row) => row.flags.includes("current_parser_hard")).length,
    },
    byFlag: Object.fromEntries(Object.entries(byFlag).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    bySource: countBy(candidates, (row) => row.source),
    candidates: candidates.slice(0, 400),
  };

  const suffix = scope === "pool" ? "pool" : "recent";
  const jsonPath = path.join(reportsDir, `earphone-condition-deepsweep-${suffix}-latest.json`);
  const mdPath = path.join(reportsDir, `earphone-condition-deepsweep-${suffix}-latest.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown(report));
  if (decisionLog) {
    await writeFile(path.join(decisionDir, decisionLog), renderMarkdown(report));
  }
  console.log(JSON.stringify({ jsonPath, mdPath, totals: report.totals, byFlag: report.byFlag, bySource: report.bySource }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
