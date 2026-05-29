import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { skuById, type Sku } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const FASHION_CATEGORIES = new Set(["shoe", "clothing", "bag"]);
const HIGH_TIERS = new Set(["s_grade", "a_grade"]);
const HIGH_CLASSES = new Set(["mint", "unopened", "clean"]);
const LOW_SIGNAL_NOTES = new Set([
  "repair_or_defect_signal",
  "shoe_sole_crumbling",
  "shoe_hydrolysis",
  "shoe_stain_or_discoloration",
  "shoe_hygiene_warning",
  "shoe_upper_structural_damage",
  "shoe_insole_missing",
  "shoe_heel_worn_severe",
  "shoe_sole_separation",
  "bag_stain_or_discoloration",
  "bag_hygiene_warning",
  "bag_lining_damage",
  "bag_leather_damage",
  "bag_handle_worn",
  "bag_corner_worn",
  "bag_paint_peeling",
  "bag_mold",
  "clothing_pilling",
  "clothing_fading",
  "clothing_stretched",
  "clothing_seam_damage",
  "clothing_structural_damage",
  "clothing_slit_damage",
  "clothing_print_cracked",
  "clothing_stain",
]);

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  last_verified_at: string | null;
};

type RawRow = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  name: string | null;
  price: number | null;
  source: string | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
  sale_status: string | null;
};

type ParsedRow = {
  pid: number;
  parser_version: string | null;
  category: string | null;
  comparable_key: string | null;
  condition_class: string | null;
  condition_tier: string | null;
  parsed_json: Record<string, unknown> | null;
};

type Finding = {
  pid: number;
  status: string | null;
  source: string | null;
  category: string | null;
  title: string;
  price: number | null;
  rawSkuId: string | null;
  currentSkuId: string | null;
  poolKey: string | null;
  parsedKey: string | null;
  currentKey: string | null;
  storedClass: string | null;
  storedTier: string | null;
  currentClass: string | null;
  currentTier: string | null;
  currentNotes: string[];
  learnedFlags: string[];
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

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function inList(nums: number[]) {
  return `(${nums.join(",")})`;
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

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  for (const part of chunk([...new Set(pids)], 180)) {
    rows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,price,source,description_preview,bunjang_condition_label,sale_status&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchParsedRows(pids: number[]) {
  const rows: ParsedRow[] = [];
  for (const part of chunk([...new Set(pids)], 180)) {
    rows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,parser_version,category,comparable_key,condition_class,condition_tier,parsed_json&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchParsedCategoryRows(category: string, limit: number, pageSize: number, orderBy: string | null) {
  const rows: ParsedRow[] = [];
  const safePageSize = Math.max(50, Math.min(1000, pageSize));
  const select = "pid,parser_version,category,comparable_key,condition_class,condition_tier";
  const orderClause = orderBy ? `&order=${encodeURIComponent(orderBy)}` : "";
  for (let offset = 0; rows.length < limit; offset += safePageSize) {
    const pageLimit = Math.min(safePageSize, limit - rows.length);
    const page = await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=${select}&category=eq.${encodeURIComponent(category)}${orderClause}&limit=${pageLimit}&offset=${offset}`,
    );
    rows.push(...page.map((row) => ({ ...row, parsed_json: null })));
    if (page.length < pageLimit) break;
  }
  return rows;
}

function norm(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasNegated(text: string, tokenPattern: string) {
  return new RegExp(`${tokenPattern}.{0,18}(?:없|없음|없습니다|없어요|없는|없고|x|아님|아닙니다|제로|깨끗|거의\\s*없|전혀\\s*없)`).test(text)
    || new RegExp(`(?:없|없는|없고|깨끗).{0,18}${tokenPattern}`).test(text);
}

function isDisclaimer(text: string) {
  return /중고\s*(?:거래|상품?|제품|의류)?\s*특성상|빈티지\s*특성상|미처\s*발견(?:하지\s*)?못한|발견\s*못한\s*(?:하자|오염|얼룩|기스|이염)|(?:오염|이염|얼룩|올튐|뜯김|하자).{0,30}(?:있을\s*수|있을수)|미세한\s*(?:하자|오염|얼룩|기스|사용감).{0,24}(?:반품|환불|있을\s*수|있을수)|작은\s*(?:오염|하자).{0,24}(?:반품|환불)|하자\s*,?\s*이염.{0,24}(?:사진|확인)|사진에서\s*확인|예민하신\s*분/.test(text);
}

function learnedFashionFlags(rawText: string, category: string | null | undefined) {
  const text = norm(rawText);
  const flags: string[] = [];
  const disclaimer = isDisclaimer(text);
  const gradeTableOnly = /(?:상품|제품)?\s*등급\s*표|상태\s*등급|n\s*[-+]?\s*s?.{0,90}(?:상품|제품)?\s*등급|n\s*[-+]?\s*s?\s*[:：].{0,320}b\s*[:：]|상태\s*:\s*[a-z+-]+.{0,260}b\s*[:：]/.test(text);
  const packageDamageOnly = /(?:박스|속포장지|포장지|더스트백|쇼핑백|가방).{0,44}(?:찢|터짐|터진|뜯|튿|깨짐|깨진)|(?:찢|터짐|터진|뜯|튿|깨짐|깨진).{0,44}(?:박스|속포장지|포장지|더스트백|쇼핑백|가방)|찢어졌을\s*때/.test(text);
  const packageStainOnly = /(?:박스|속포장지|포장지).{0,18}(?:오염|얼룩|이염|변색|황변)|(?:오염|얼룩|이염|변색|황변).{0,18}(?:박스|속포장지|포장지)|(?:오염|얼룩|이염|변색|황변)\s*(?:도\s*)?아니|(?:오염|얼룩|이염|변색|황변).{0,10}(?:예방|방지)|(?:오염|스크래치).{0,12}강한|(?:색\s*바램|색바램)\s*아닌|변색\s*위험/.test(text);

  if (!gradeTableOnly && !packageDamageOnly && !hasNegated(text, "(?:찢어진|찢어짐|찢김|구멍|터짐|터진|해짐|헤짐|뜯김|뜯어짐|튿어짐|튿어진|깨짐|봉제|박음질|수선|보강)") && /찢어(?:짐|졌|진)|찢김|구멍\s*(?:있|있음|남|나|작)|터짐|터진|뜯김|뜯어짐|튿어짐|튿어진|깨짐|봉제\s*(?:풀|터|뜯)|박음질\s*(?:풀|터|뜯)|수선\s*(?:필요|해야|요망)|보강\s*(?:필요|해야)/.test(text)) {
    flags.push("learned_structural_damage");
  }
  if (!gradeTableOnly && !packageStainOnly && !hasNegated(text, "(?:이염|오염|얼룩|생활오염|황변|변색|색\\s*바램|색바램|색\\s*빠짐)") && !disclaimer && /이염|오염\s*(?:있|심|많|살짝|조금|도\s*많|으로)|생활\s*오염|생활오염|얼룩\s*(?:있|심|많|살짝|조금|크)|황변|변색|색\s*바램|색바램|색\s*빠짐/.test(text)) {
    flags.push("learned_stain_or_discoloration");
  }
  if (!hasNegated(text, "(?:곰팡이|냄새|악취|담배)") && /곰팡이|악취|냄새\s*(?:있|남|심)|담배\s*냄새/.test(text)) {
    flags.push("learned_hygiene_severe");
  }
  if (
    !hasNegated(text, "(?:보풀|필링|늘어남|늘어진|넥\\s*늘어|목\\s*늘어|소매\\s*늘어|밑단\\s*늘어)") &&
    !/(?:늘어남|늘어진|넥\s*늘어|목\s*늘어|소매\s*늘어|밑단\s*늘어).{0,12}(?:심하지\s*않|심한\s*편\s*아님|크지\s*않)/.test(text) &&
    category === "clothing" &&
    /보풀\s*(?:있|많|심)|필링|늘어남|늘어진|넥\s*늘어|목\s*늘어|소매\s*늘어|밑단\s*늘어/.test(text)
  ) {
    flags.push("learned_clothing_wear");
  }
  if (!hasNegated(text, "(?:프린팅|프린트|로고|인쇄)") && category === "clothing" && /(?:프린팅|프린트|로고|인쇄).{0,16}(?:갈라|벗겨|박리|찢어|지워)/.test(text)) {
    flags.push("learned_print_damage");
  }
  if (category === "shoe") {
    if (!hasNegated(text, "(?:가수분해|솔\\s*가루|미드솔\\s*가루)") && /가수분해|솔\s*가루|미드솔\s*가루|아웃솔\s*가루|솔\s*부서/.test(text)) {
      flags.push("learned_shoe_hydrolysis_or_crumbling");
    }
    if (!hasNegated(text, "(?:밑창|아웃솔|솔|뒷굽|굽)") && /밑창\s*(?:분리|벗겨|떨어|마모\s*심|완전\s*닳)|솔\s*(?:분리|떨어|마모\s*심)|뒷굽\s*(?:다\s*닳|완전\s*닳|마모\s*심)|굽\s*(?:완전\s*마모|많이\s*닳)/.test(text)) {
      flags.push("learned_shoe_sole_or_heel_damage");
    }
    if (!hasNegated(text, "(?:인솔|깔창)") && /인솔\s*(?:없|분실|빠짐|빠져)|깔창\s*(?:없|분실|빠짐|빠져)/.test(text)) {
      flags.push("learned_shoe_insole_missing");
    }
  }
  if (category === "bag") {
    if (!hasNegated(text, "(?:내피|안감|라이닝)") && /내피\s*(?:끈적|끈쩍|녹|벗겨|찢어|오염\s*심)|안감\s*(?:끈적|녹|벗겨|찢어)|라이닝\s*(?:끈적|녹|벗겨)/.test(text)) {
      flags.push("learned_bag_lining_damage");
    }
    if (!hasNegated(text, "(?:가죽|레더|코팅)") && /가죽\s*(?:까짐|벗겨|갈라짐|찢어|뜯김|뜯어짐|헤짐|해짐|크랙|박리)|레더\s*(?:까짐|벗겨|갈라|뜯|헤짐|해짐|크랙)|코팅\s*(?:벗겨|박리|들뜸)|바닥(?:이|은|는)?\s*(?:좀\s*)?(?:헤졌|헤짐|해짐)/.test(text)) {
      flags.push("learned_bag_leather_damage");
    }
    if (!hasNegated(text, "(?:손잡이|핸들|스트랩|어깨끈|크로스\\s*끈|끈|모서리|코너|페인팅|도장|페인트|똑딱이)") && /손잡이\s*(?:마모|닳|끊어|늘어|찢어|벗겨)|핸들\s*(?:마모|닳|끊어|늘어)|(?:스트랩|어깨끈|크로스\s*끈|끈).{0,18}(?:끊어|찢어|벗겨|수선\s*(?:필요|해야|가능)|분실|없음|빠짐)|똑딱이.{0,10}(?:빠짐|빠져|분실)|(?:그물|망사).{0,18}(?:튿어짐|튿어진|뜯김|뜯어짐|찢어)|모서리\s*(?:닳|벗겨|까짐|마모)|코너\s*(?:닳|벗겨|까짐|마모)|페인팅\s*(?:벗겨|박리|들뜸)|도장\s*(?:벗겨|박리|들뜸)|페인트\s*(?:벗겨|박리)/.test(text)) {
      flags.push("learned_bag_edge_handle_damage");
    }
  }
  if (disclaimer && flags.length === 0 && /오염|얼룩|기스|스크래치|사용감/.test(text)) {
    flags.push("report_only_disclaimer");
  }
  return [...new Set(flags)];
}

function tierFromParsedJson(parsedJson: Record<string, unknown> | null | undefined) {
  const conditionGrade = parsedJson?.condition_grade as { tier?: unknown } | undefined;
  return typeof conditionGrade?.tier === "string" ? conditionGrade.tier : null;
}

function tierFromCurrentParse(current: ReturnType<typeof parseListingOptions> | null) {
  return tierFromParsedJson(current?.parsedJson);
}

function hasLowSignal(notes: string[]) {
  return notes.some((note) => LOW_SIGNAL_NOTES.has(note));
}

function countBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row) || "(null)";
    out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function uniqueByPid(rows: Finding[]) {
  const seen = new Set<number>();
  const out: Finding[] = [];
  for (const row of rows) {
    if (seen.has(row.pid)) continue;
    seen.add(row.pid);
    out.push(row);
  }
  return out;
}

function summarize(pool: PoolRow[], rawByPid: Map<number, RawRow>, parsedByPid: Map<number, ParsedRow>) {
  const findings: Finding[] = [];
  for (const poolRow of pool) {
    const pid = Number(poolRow.pid);
    const raw = rawByPid.get(pid);
    const stored = parsedByPid.get(pid);
    if (!raw) continue;
    const currentSku = raw.sku_id ? skuById(raw.sku_id) ?? null : null;
    const category = currentSku?.category ?? poolRow.category;
    if (!FASHION_CATEGORIES.has(category ?? "")) continue;
    const parseCategory = (currentSku?.category ?? category) as Sku["category"];
    const current = parseListingOptions({
      title: raw.name ?? "",
      description: raw.description_preview ?? "",
      skuId: currentSku?.id ?? raw.sku_id,
      skuName: currentSku?.modelName ?? raw.sku_name,
      category: parseCategory,
      bunjangConditionLabel: raw.bunjang_condition_label,
      defaultProductType: currentSku?.defaultProductType ?? null,
    });
    const text = `${raw.name ?? ""}\n${raw.description_preview ?? ""}`;
    const learnedFlags = learnedFashionFlags(text, category);
    const currentTier = tierFromCurrentParse(current);
    const storedTier = stored?.condition_tier ?? tierFromParsedJson(stored?.parsed_json) ?? null;
    const currentClass = current?.conditionClass ?? null;
    const currentNotes = current?.conditionNotes ?? [];
    const suspiciousHigh = (
      learnedFlags.some((flag) => flag.startsWith("learned_")) &&
      (HIGH_TIERS.has(currentTier ?? "") || HIGH_TIERS.has(storedTier ?? "") || HIGH_CLASSES.has(currentClass ?? "") || HIGH_CLASSES.has(stored?.condition_class ?? "")) &&
      !hasLowSignal(currentNotes)
    );
    const learnedButNoCurrentSignal = learnedFlags.some((flag) => flag.startsWith("learned_")) && !hasLowSignal(currentNotes);
    const flags = [
      ...(learnedFlags.length > 0 ? ["has_learned_condition_signal"] : []),
      ...(suspiciousHigh ? ["suspicious_high_grade_condition_miss"] : []),
      ...(learnedButNoCurrentSignal ? ["learned_signal_without_current_note"] : []),
      ...learnedFlags,
    ];
    if (flags.length === 0) continue;
    findings.push({
      pid,
      status: poolRow.status,
      source: raw.source,
      category,
      title: raw.name ?? "",
      price: raw.price,
      rawSkuId: raw.sku_id,
      currentSkuId: currentSku?.id ?? null,
      poolKey: poolRow.comparable_key,
      parsedKey: stored?.comparable_key ?? null,
      currentKey: current?.comparableKey ?? null,
      storedClass: stored?.condition_class ?? null,
      storedTier,
      currentClass,
      currentTier,
      currentNotes,
      learnedFlags,
      flags,
      text: (raw.description_preview ?? "").slice(0, 320),
    });
  }
  return findings;
}

function renderMarkdown(report: {
  generatedAt: string;
  scope: Record<string, unknown>;
  totals: Record<string, unknown>;
  byFlag: Record<string, number>;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  gapSamples: Finding[];
  suspiciousSamples: Finding[];
  samples: Finding[];
}) {
  const lines = [
    "# Fashion Condition Deep Sweep",
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
    "## By Category",
    ...Object.entries(report.byCategory).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Samples",
  ];
  if (report.gapSamples.length > 0) {
    lines.push("", "## Gap Samples");
    for (const item of report.gapSamples.slice(0, 120)) {
      lines.push(`- pid ${item.pid}: ${item.title} / ${item.source} / ${item.category} / current=${item.currentClass}:${item.currentTier} / notes=${item.currentNotes.join(",") || "-"} / learned=${item.learnedFlags.join(",") || "-"} / text=${item.text.replace(/\s+/g, " ").slice(0, 180)}`);
    }
  }
  if (report.suspiciousSamples.length > 0) {
    lines.push("", "## Suspicious High-Grade Samples");
    for (const item of report.suspiciousSamples.slice(0, 120)) {
      lines.push(`- pid ${item.pid}: ${item.title} / ${item.source} / ${item.category} / stored=${item.storedClass}:${item.storedTier} / current=${item.currentClass}:${item.currentTier} / notes=${item.currentNotes.join(",") || "-"} / learned=${item.learnedFlags.join(",") || "-"} / text=${item.text.replace(/\s+/g, " ").slice(0, 180)}`);
    }
  }
  lines.push("", "## First Findings");
  for (const item of report.samples.slice(0, 120)) {
    lines.push(`- pid ${item.pid}: ${item.title} / ${item.source} / ${item.category} / stored=${item.storedClass}:${item.storedTier} / current=${item.currentClass}:${item.currentTier} / notes=${item.currentNotes.join(",") || "-"} / flags=${item.flags.join(",")}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const categories = arg("categories", "shoe,clothing,bag").split(",").map((item) => item.trim()).filter((item) => FASHION_CATEGORIES.has(item));
  const statuses = arg("statuses", "ready,reserved");
  const scope = arg("scope", "pool");
  const limit = Number(arg("limit", "5000"));
  const perCategoryLimit = Number(arg("per-category-limit", String(limit)));
  const pageSize = Number(arg("page-size", "500"));
  const parsedOrder = arg("order", "parsed_at.desc.nullslast");
  let parsedSeedRows: ParsedRow[] | null = null;
  const poolRows = scope === "parsed"
    ? await (async () => {
        const perCategoryRows: ParsedRow[] = [];
        for (const category of categories) {
          perCategoryRows.push(...await fetchParsedCategoryRows(category, perCategoryLimit, pageSize, parsedOrder || null));
        }
        parsedSeedRows = perCategoryRows;
        return perCategoryRows.map((row): PoolRow => ({
          pid: Number(row.pid),
          status: "parsed",
          category: row.category,
          comparable_key: row.comparable_key,
          expected_profit_min: null,
          expected_profit_max: null,
          last_verified_at: null,
        }));
      })()
    : await (async () => {
        const poolUrl = `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min,expected_profit_max,last_verified_at&category=in.(${categories.join(",")})&status=in.(${statuses})`;
        return fetchAll<PoolRow>(poolUrl, limit, "last_verified_at.desc.nullslast");
      })();
  const pids = poolRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const rawRows = await fetchRawRows(pids);
  const parsedRows = parsedSeedRows ?? await fetchParsedRows(pids);
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const findings = summarize(poolRows, rawByPid, parsedByPid);
  const byFlag: Record<string, number> = {};
  for (const item of findings) for (const flag of item.flags) byFlag[flag] = (byFlag[flag] ?? 0) + 1;

  const report = {
    generatedAt: new Date().toISOString(),
    scope: { categories, statuses, scope, limit, perCategoryLimit: scope === "parsed" ? perCategoryLimit : null, pageSize: scope === "parsed" ? pageSize : null },
    totals: {
      poolRows: poolRows.length,
      rawRows: rawRows.length,
      parsedRows: parsedRows.length,
      findingRows: findings.length,
      suspiciousHighGradeRows: findings.filter((item) => item.flags.includes("suspicious_high_grade_condition_miss")).length,
      learnedWithoutCurrentNoteRows: findings.filter((item) => item.flags.includes("learned_signal_without_current_note")).length,
    },
    byFlag: Object.fromEntries(Object.entries(byFlag).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    byCategory: countBy(findings, (row) => row.category),
    bySource: countBy(findings, (row) => row.source),
    gapSamples: uniqueByPid(findings.filter((item) => item.flags.includes("learned_signal_without_current_note"))).slice(0, 200),
    suspiciousSamples: uniqueByPid(findings.filter((item) => item.flags.includes("suspicious_high_grade_condition_miss"))).slice(0, 200),
    samples: findings.slice(0, 400),
  };

  const jsonPath = path.join(reportsDir, "fashion-condition-deepsweep-latest.json");
  const mdPath = path.join(reportsDir, "fashion-condition-deepsweep-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown(report));
  console.log(JSON.stringify({ jsonPath, mdPath, totals: report.totals, byFlag: report.byFlag, byCategory: report.byCategory, bySource: report.bySource }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
