import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { ruleMatch, skuById, type Sku } from "@/lib/catalog";
import { loadCategoryReadinessMap, loadLaneReadinessMap, type CategoryReadinessMap, type LaneReadinessMap } from "@/lib/category-readiness";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const DEFAULT_CATEGORIES = ["clothing", "shoe", "sport_golf", "game_console"] as const;
const TARGET_CATEGORIES = new Set<string>([
  ...DEFAULT_CATEGORIES,
  "bag",
  "bike",
  "camera",
  "desktop",
  "drone",
  "earphone",
  "home_appliance",
  "kickboard",
  "laptop",
  "lego",
  "monitor",
  "perfume",
  "smartphone",
  "smartwatch",
  "speaker",
  "tablet",
  "watch",
]);
const FASHION_CATEGORIES = new Set<string>(["clothing", "shoe"]);
const GRADE_KEY_TOKENS = new Set(["s_grade", "a_grade", "b_grade", "c_grade", "reject", "unknown_condition"]);

type ParsedRow = {
  pid: number;
  parser_version: string | null;
  category: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json: Record<string, unknown> | null;
  condition_class: string | null;
  condition_notes: string[] | null;
  condition_tier: string | null;
  condition_cluster: string | null;
  condition_confidence: number | null;
  condition_chips: string[] | null;
  parsed_at: string | null;
};

type RawRow = {
  pid: number;
  name: string | null;
  price: number | null;
  query: string | null;
  detail_status: string | null;
  listing_state: string | null;
  listing_type: string | null;
  listing_type_override: string | null;
  sale_status: string | null;
  sku_id: string | null;
  sku_name: string | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
  pool_eligible: boolean | null;
  score_dirty: boolean | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  detail_enriched_at: string | null;
};

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  profit_band: number | null;
  invalidated_reason: string | null;
};

type AuditRow = {
  pid: number;
  title: string | null;
  price: number | null;
  parsedCategory: string | null;
  rawSkuId: string | null;
  rawSkuCategory: string | null;
  currentSkuId: string | null;
  currentSkuCategory: string | null;
  dbKey: string | null;
  rawReparseKey: string | null;
  currentKey: string | null;
  dbParserVersion: string | null;
  currentParserVersion: string | null;
  dbNeedsReview: boolean | null;
  dbConfidence: number | null;
  currentNeedsReview: boolean | null;
  currentConfidence: number | null;
  dbConditionTier: string | null;
  currentConditionTier: string | null;
  dbKeyTier: string | null;
  currentKeyTier: string | null;
  conditionTierFromJson: string | null;
  poolStatus: string | null;
  poolKey: string | null;
  gateReason: string | null;
  canEnterPool: boolean | null;
  flags: string[];
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

async function fetchAll<T>(baseUrl: string, limit: number, orderBy: string) {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset);
    const sep = baseUrl.includes("?") ? "&" : "?";
    const page = await fetchJson<T>(`${baseUrl}${sep}order=${encodeURIComponent(orderBy)}&limit=${pageLimit}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageLimit) break;
  }
  return rows;
}

function parsedSelect() {
  return [
    "pid",
    "parser_version",
    "category",
    "comparable_key",
    "parse_confidence",
    "needs_review",
    "parsed_json",
    "condition_class",
    "condition_notes",
    "condition_tier",
    "condition_cluster",
    "condition_confidence",
    "condition_chips",
    "parsed_at",
  ].join(",");
}

function rawSelect() {
  return [
    "pid",
    "name",
    "price",
    "query",
    "detail_status",
    "listing_state",
    "listing_type",
    "listing_type_override",
    "sale_status",
    "sku_id",
    "sku_name",
    "description_preview",
    "bunjang_condition_label",
    "pool_eligible",
    "score_dirty",
    "first_seen_at",
    "last_seen_at",
    "detail_enriched_at",
  ].join(",");
}

async function fetchParsedRows(categories: string[], limit: number) {
  const url = `${tableUrl("mvp_listing_parsed")}?select=${parsedSelect()}&category=in.(${categories.join(",")})`;
  return fetchAll<ParsedRow>(url, limit, "parsed_at.desc");
}

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=${rawSelect()}&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchPoolRows(pids: number[]) {
  const rows: PoolRow[] = [];
  const select = "pid,status,category,comparable_key,expected_profit_min,expected_profit_max,profit_band,invalidated_reason";
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=${select}&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

function parseWithSku(raw: RawRow | undefined, sku: Sku | null) {
  if (!raw || !sku) return null;
  return parseListingOptions({
    title: raw.name ?? "",
    description: raw.description_preview ?? "",
    skuId: sku.id,
    skuName: sku.modelName,
    category: sku.category,
    bunjangConditionLabel: raw.bunjang_condition_label,
    defaultProductType: sku.defaultProductType ?? null,
  });
}

function toStoredTier(pid: number, parsed: ReturnType<typeof parseListingOptions> | null) {
  if (!parsed) return null;
  return String(toParsedListingRow(pid, parsed).condition_tier ?? "") || null;
}

function conditionGradeTier(parsedJson: Record<string, unknown> | null | undefined) {
  const grade = parsedJson?.condition_grade as { tier?: unknown } | null | undefined;
  return typeof grade?.tier === "string" ? grade.tier : null;
}

function keyTier(key: string | null | undefined) {
  const last = key?.split("|").at(-1) ?? null;
  return last && GRADE_KEY_TOKENS.has(last) ? last : null;
}

function comparableTier(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "s" || normalized === "s_grade") return "s_grade";
  if (normalized === "a" || normalized === "a_grade") return "a_grade";
  if (normalized === "b" || normalized === "b_grade") return "b_grade";
  if (normalized === "c" || normalized === "c_grade") return "c_grade";
  if (normalized === "d" || normalized === "reject") return "reject";
  if (normalized === "unknown" || normalized === "unknown_condition") return "unknown_condition";
  return normalized;
}

function tierMismatchIsActionable(conditionTier: string | null | undefined, keyGradeTier: string | null | undefined) {
  const tier = comparableTier(conditionTier);
  if (!tier || !keyGradeTier) return false;
  return tier !== keyGradeTier;
}

function categoryConflictFlags(category: string | null | undefined, text: string) {
  const t = text.toLowerCase()
    .replace(/부츠컷|bootcut/g, " ")
    .replace(/iron\s*g(?:re|ra)y|아이언\s*그레이/g, " ")
    .replace(/ironstone|아이언\s*스톤|아이언스톤/g, " ")
    .replace(/light\s*iron(?:\s*ore)?|라이트\s*아이언(?:\s*오어)?|아이언\s*오어/g, " ")
    .replace(/juventus|유벤투스/g, " ")
    .replace(/prima\s*loft|primaloft|프리마\s*로프트|프리마로프트|dry\s*loft|드라이\s*로프트|드라이로프트|aero\s*loft|에어로\s*로프트|에어로로프트|micro\s*loft|thermo\s*loft|하이\s*로프트|하이로프트|라바\s*로프트/g, " ")
    .replace(/air\s*force.{0,24}utility|에어\s*포스.{0,24}유틸리티|에어포스.{0,24}유틸리티/g, " ")
    .replace(/yeezy.{0,20}utility|이지.{0,20}유틸리티|utility\s*black|유틸리티\s*블랙/g, " ")
    .replace(/유틸리티.{0,16}(?:팬츠|바지|조끼|베스트|자켓|재킷|셔츠|블루종|점퍼|집업|트랙팬츠)|utility.{0,16}(?:pants|vest|jacket|shirt|blouson|jumper|zip)/g, " ")
    .replace(/(?:컨버스|척\s*70|운동화|스니커|스니커즈|슈즈|부츠|하이탑|로우탑|신발).{0,24}(?:유틸리티|utility)|(?:유틸리티|utility).{0,24}(?:하이탑|로우탑|운동화|스니커|스니커즈|슈즈|부츠|컨버스|척\s*70|신발)/g, " ")
    .replace(/하이브리드.{0,16}(?:자켓|재킷|바람막이|후드|후디|집업|베스트|조끼|다운볼)|hybrid.{0,16}(?:jacket|hoodie|vest|windbreaker|shell)/g, " ")
    .replace(/하이브리드.{0,16}(?:텍스처|부츠|슈즈|스니커|스니커즈|하이탑)|hybrid.{0,16}(?:texture|boots?|shoes?|sneakers?|hi(?:gh)?-?top)/g, " ")
    .replace(/우드\s*크레이프|wood\s*crepe/g, " ")
    .replace(/웨지\s*스트레이트|wedge\s*straight/g, " ")
    .replace(/닌텐도\s*64|nintendo\s*64/g, " ")
    .replace(/제로\s*퍼터|제로퍼터/g, " ")
    .replace(/골프웨어|골프\s*웨어|골프티|골프\s*티/g, " ")
    .replace(/게임\s*타이틀|게임\s*칩|게임칩|게임\s*팩|게임팩/g, " ")
    // Wedge heels/sandals are shoe terms, not golf-club wedge signals.
    .replace(/(?:미니|엑스)?웨지\s*(?:힐|heel|슬링백|샌들|샌달|구두|굽|키높이)|(?:힐|heel|슬링백|샌들|샌달|구두|굽|키높이).{0,8}(?:웨지|wedge)|(?:mini|x)?wedge\s*(?:heel|sandal)/g, " ");
  const shoeContext = /운동화|스니커|스니커즈|부츠|샌들|슬리퍼|로퍼|슈즈|러닝화|등산화|축구화|풋살화|sneaker|shoe|shoes|boot|sandal|loafer|slipper/.test(t);
  const denimShoeMaterial = shoeContext && /(?:데님|denim).{0,24}(?:운동화|스니커|스니커즈|부츠|샌들|슬리퍼|로퍼|슈즈|sneaker|shoe|shoes|boot|sandal|loafer|slipper)|(?:운동화|스니커|스니커즈|부츠|샌들|슬리퍼|로퍼|슈즈|sneaker|shoe|shoes|boot|sandal|loafer|slipper).{0,24}(?:데님|denim)/.test(t);
  const clothingText = denimShoeMaterial ? t.replace(/데님|denim|jeans/g, " ") : t;
  const clothing = /자켓|재킷|패딩|코트|후드|맨투맨|티셔츠|반팔|롱슬리브|셔츠|바지|팬츠|쇼츠|청바지|데님|(?:^|[^가-힣a-z0-9])니트(?:$|[^가-힣a-z0-9])|가디건|모자|볼캡|jacket|hoodie|shirt|pants|shorts|denim|jeans/.test(clothingText);
  const shoe = /운동화|스니커|스니커즈|부츠|샌들|슬리퍼|로퍼|슈즈|러닝화|등산화|축구화|풋살화|sneaker|shoe|shoes|boot|sandal|loafer|slipper/.test(t);
  const golf = /골프\s*(?:채|클럽)|드라이버|아이언|(?:^|[^가-힣a-z0-9])우드(?:$|[^가-힣a-z0-9])|[3579]\s*번\s*우드|우드\s*(?:샤프트|헤드)|퍼터|웨지|유틸리티|하이브리드|샤프트|로프트|벤투스|투어ad|tour\s*ad|driver|iron|putter|wedge|hybrid|shaft/.test(t);
  const game = /ps5|ps4|플스|플레이스테이션|닌텐도|스위치|switch|xbox|스팀덱|steam\s*deck|조이콘|듀얼센스|게임\s*타이틀|게임칩|카트리지/.test(t);
  const flags: string[] = [];
  if (category === "clothing" && shoe) flags.push("clothing_title_has_shoe_terms");
  if (category === "clothing" && golf) flags.push("clothing_title_has_golf_club_terms");
  if (category === "shoe" && clothing) flags.push("shoe_title_has_clothing_terms");
  if (category === "shoe" && golf) flags.push("shoe_title_has_golf_terms");
  if (category === "sport_golf" && clothing) flags.push("golf_title_has_clothing_terms");
  if (category === "sport_golf" && shoe) flags.push("golf_title_has_shoe_terms");
  if (category === "game_console" && (clothing || shoe || golf)) flags.push("game_title_has_non_game_terms");
  if (category !== "game_console" && game) flags.push("non_game_title_has_game_terms");
  return flags;
}

function inc(map: Record<string, number>, key: string | null | undefined) {
  const k = key || "(null)";
  map[k] = (map[k] ?? 0) + 1;
}

function percentile(values: number[], p: number) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))] ?? null;
}

function auditRow(
  parsed: ParsedRow,
  raw: RawRow | undefined,
  pool: PoolRow | undefined,
  currentReplay: "all" | "pool" | "none",
  categoryReadiness: CategoryReadinessMap,
  laneReadiness: LaneReadinessMap,
): AuditRow {
  const rawSku = raw?.sku_id ? skuById(raw.sku_id) ?? null : null;
  const shouldReplayCurrent = currentReplay === "all" || (
    currentReplay === "pool" &&
    (pool?.status === "ready" || pool?.status === "reserved")
  );
  const currentSku = shouldReplayCurrent && raw ? ruleMatch(raw.name ?? "", raw.description_preview ?? "") : rawSku;
  const rawReparse = parseWithSku(raw, rawSku);
  const currentReparse = shouldReplayCurrent ? parseWithSku(raw, currentSku) : null;
  const currentRow = currentReparse ? toParsedListingRow(parsed.pid, currentReparse) : null;
  const rawRow = rawReparse ? toParsedListingRow(parsed.pid, rawReparse) : null;
  const currentTier = currentRow?.condition_tier ? String(currentRow.condition_tier) : null;
  const rawTier = rawRow?.condition_tier ? String(rawRow.condition_tier) : null;
  const dbTierFromJson = conditionGradeTier(parsed.parsed_json);
  const dbKeyTier = keyTier(parsed.comparable_key);
  const currentKeyTier = keyTier(currentReparse?.comparableKey);
  const gate = evaluatePoolGate(
    { sku: currentSku, category: currentSku?.category ?? parsed.category as Sku["category"] | null },
    { categoryReadiness, laneReadiness },
  );
  const flags: string[] = [];
  const text = `${raw?.name ?? ""}\n${raw?.description_preview ?? ""}`;

  if (!raw) flags.push("missing_raw_row");
  if (!rawSku && raw?.sku_id) flags.push("raw_sku_not_in_catalog");
  if (rawSku && rawSku.category !== parsed.category) flags.push("raw_sku_category_differs_from_parsed_category");
  if (currentSku && currentSku.category !== parsed.category) flags.push("current_sku_category_differs_from_parsed_category");
  if (shouldReplayCurrent && raw?.sku_id && !currentSku) flags.push("raw_sku_rejected_by_current_catalog");
  if (shouldReplayCurrent && raw?.sku_id && currentSku && raw.sku_id !== currentSku.id) flags.push("raw_sku_differs_from_current_catalog");
  if ((parsed.comparable_key ?? null) !== (rawReparse?.comparableKey ?? null)) flags.push("db_key_differs_from_raw_reparse");
  if (shouldReplayCurrent && currentSku && parsed.comparable_key !== currentReparse?.comparableKey) flags.push("db_key_differs_from_current_reparse");
  if (currentReparse && parsed.parser_version !== currentReparse.parserVersion) flags.push("parser_version_stale_vs_current_reparse");
  if (shouldReplayCurrent && parsed.needs_review === false && (parsed.parse_confidence ?? 0) >= 0.65 && !currentSku) flags.push("db_clean_but_current_catalog_rejects");
  if (shouldReplayCurrent && parsed.needs_review === false && (parsed.parse_confidence ?? 0) >= 0.65 && currentSku && parsed.comparable_key !== currentReparse?.comparableKey) {
    flags.push("db_clean_but_current_catalog_changes_key");
  }
  if ((pool?.status === "ready" || pool?.status === "reserved") && !gate.canEnterPool) flags.push(`pool_exposed_gate_blocked:${gate.reason}`);
  if ((pool?.status === "ready" || pool?.status === "reserved") && pool.comparable_key !== parsed.comparable_key) flags.push("pool_key_differs_from_parsed_key");
  if ((pool?.status === "ready" || pool?.status === "reserved") && currentReparse && pool.comparable_key !== currentReparse.comparableKey) flags.push("pool_key_differs_from_current_key");

  if (FASHION_CATEGORIES.has(parsed.category ?? "")) {
    if (parsed.needs_review !== true && !parsed.condition_tier) flags.push("fashion_missing_condition_tier");
    if (parsed.needs_review !== true && dbTierFromJson && parsed.condition_tier !== dbTierFromJson) flags.push("condition_tier_column_differs_from_json_grade");
    if (parsed.needs_review !== true && tierMismatchIsActionable(parsed.condition_tier, dbKeyTier)) flags.push("fashion_key_tier_differs_from_condition_tier");
    if (shouldReplayCurrent && tierMismatchIsActionable(currentTier, currentKeyTier)) flags.push("current_fashion_key_tier_differs_from_current_condition_tier");
  }
  if ((parsed.category === "sport_golf" || parsed.category === "game_console") && !parsed.condition_tier) {
    flags.push("game_golf_missing_condition_tier");
  }
  if (shouldReplayCurrent && currentTier && parsed.condition_tier && comparableTier(currentTier) !== comparableTier(parsed.condition_tier)) flags.push("condition_tier_changes_on_current_reparse");
  if (currentReparse && parsed.condition_class && currentReparse.conditionClass !== parsed.condition_class) flags.push("condition_class_changes_on_current_reparse");
  if (parsed.needs_review !== true) flags.push(...categoryConflictFlags(parsed.category, raw?.name ?? ""));

  return {
    pid: Number(parsed.pid),
    title: raw?.name ?? null,
    price: raw?.price ?? null,
    parsedCategory: parsed.category,
    rawSkuId: raw?.sku_id ?? null,
    rawSkuCategory: rawSku?.category ?? null,
    currentSkuId: shouldReplayCurrent ? currentSku?.id ?? null : null,
    currentSkuCategory: shouldReplayCurrent ? currentSku?.category ?? null : null,
    dbKey: parsed.comparable_key,
    rawReparseKey: rawReparse?.comparableKey ?? null,
    currentKey: shouldReplayCurrent ? currentReparse?.comparableKey ?? null : null,
    dbParserVersion: parsed.parser_version,
    currentParserVersion: shouldReplayCurrent ? currentReparse?.parserVersion ?? null : null,
    dbNeedsReview: parsed.needs_review,
    dbConfidence: parsed.parse_confidence,
    currentNeedsReview: shouldReplayCurrent ? currentReparse?.needsReview ?? null : null,
    currentConfidence: shouldReplayCurrent ? currentReparse?.parseConfidence ?? null : null,
    dbConditionTier: parsed.condition_tier ?? null,
    currentConditionTier: shouldReplayCurrent ? currentTier : rawTier,
    dbKeyTier,
    currentKeyTier: shouldReplayCurrent ? currentKeyTier : null,
    conditionTierFromJson: dbTierFromJson,
    poolStatus: pool?.status ?? null,
    poolKey: pool?.comparable_key ?? null,
    gateReason: gate.reason,
    canEnterPool: gate.canEnterPool,
    flags: [...new Set(flags)],
  };
}

function actionableFlags(flags: string[]) {
  return flags.filter((flag) =>
    flag !== "parser_version_stale_vs_current_reparse" &&
    flag !== "db_key_differs_from_raw_reparse" &&
    flag !== "condition_class_changes_on_current_reparse" &&
    flag !== "condition_tier_changes_on_current_reparse"
  );
}

function groupFindings(rows: AuditRow[]) {
  const byKey = new Map<string, AuditRow[]>();
  for (const row of rows) {
    if (!row.dbKey || row.dbNeedsReview === true || (row.dbConfidence ?? 0) < 0.65) continue;
    const list = byKey.get(row.dbKey) ?? [];
    list.push(row);
    byKey.set(row.dbKey, list);
  }
  return [...byKey.entries()]
    .map(([key, items]) => {
      const prices = items.map((row) => Number(row.price ?? NaN)).filter((price) => Number.isFinite(price) && price > 0);
      const p10 = percentile(prices, 0.1);
      const p90 = percentile(prices, 0.9);
      const rawSkuIds = [...new Set(items.map((row) => row.rawSkuId ?? "null"))];
      const currentCheckedRows = items.filter((row) =>
        row.currentParserVersion ||
        row.flags.includes("raw_sku_rejected_by_current_catalog") ||
        row.flags.includes("db_clean_but_current_catalog_rejects")
      );
      const currentSkuIds = [...new Set(currentCheckedRows.map((row) => row.currentSkuId ?? "null"))];
      const actionableRows = items.filter((row) => actionableFlags(row.flags).length > 0);
      const priceSpread = p10 && p90 ? Number((p90 / Math.max(1, p10)).toFixed(2)) : null;
      const flags = [
        ...(rawSkuIds.length > 1 ? ["mixed_raw_sku"] : []),
        ...(currentSkuIds.length > 1 ? ["mixed_current_sku"] : []),
        ...(actionableRows.length > 0 ? ["has_actionable_rows"] : []),
        ...(priceSpread != null && priceSpread >= 3 ? ["price_spread_ge_3x"] : []),
      ];
      return {
        key,
        count: items.length,
        rawSkuIds,
        currentSkuIds,
        actionables: actionableRows.length,
        priceP10: p10,
        priceP90: p90,
        priceSpread,
        flags,
        samples: [...actionableRows, ...items].slice(0, 8).map(sampleRow),
      };
    })
    .filter((group) => group.flags.length > 0)
    .sort((a, b) => b.actionables - a.actionables || b.rawSkuIds.length - a.rawSkuIds.length || (b.priceSpread ?? 0) - (a.priceSpread ?? 0))
    .slice(0, 80);
}

function sampleRow(row: AuditRow) {
  return {
    pid: row.pid,
    title: row.title,
    price: row.price,
    category: row.parsedCategory,
    rawSkuId: row.rawSkuId,
    currentSkuId: row.currentSkuId,
    dbKey: row.dbKey,
    currentKey: row.currentKey,
    dbTier: row.dbConditionTier,
    currentTier: row.currentConditionTier,
    poolStatus: row.poolStatus,
    flags: row.flags,
  };
}

function buildMarkdown(report: {
  generatedAt: string;
  scope: Record<string, unknown>;
  totals: Record<string, unknown>;
  byCategory: Record<string, number>;
  flags: Record<string, number>;
  actionableByCategory: Record<string, number>;
  groupFindings: ReturnType<typeof groupFindings>;
  actionableSamples: ReturnType<typeof sampleRow>[];
}) {
  const lines = [
    "# Cross Category DB Deep Sweep",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Scope",
    ...Object.entries(report.scope).map(([key, value]) => `- ${key}: ${String(value)}`),
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${String(value)}`),
    "",
    "## By Category",
    ...Object.entries(report.byCategory).sort((a, b) => b[1] - a[1]).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Actionable By Category",
    ...Object.entries(report.actionableByCategory).sort((a, b) => b[1] - a[1]).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Flags",
    ...Object.entries(report.flags).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Flagged Groups",
    ...report.groupFindings.slice(0, 20).flatMap((group) => [
      `### ${group.key}`,
      `- count=${group.count}, actionables=${group.actionables}, rawSkuIds=${group.rawSkuIds.join(",")}, currentSkuIds=${group.currentSkuIds.join(",")}, spread=${group.priceSpread ?? "n/a"}, flags=${group.flags.join(",")}`,
      ...group.samples.slice(0, 5).map((sample) => `- pid ${sample.pid}: ${sample.title} / raw=${sample.rawSkuId} / current=${sample.currentSkuId} / tier=${sample.dbTier}->${sample.currentTier} / pool=${sample.poolStatus ?? "none"} / flags=${sample.flags.join(",")}`),
      "",
    ]),
    "## Actionable Samples",
    ...report.actionableSamples.slice(0, 60).map((sample) => `- pid ${sample.pid}: ${sample.title} / cat=${sample.category} / raw=${sample.rawSkuId} / current=${sample.currentSkuId} / dbKey=${sample.dbKey} / currentKey=${sample.currentKey} / tier=${sample.dbTier}->${sample.currentTier} / pool=${sample.poolStatus ?? "none"} / flags=${sample.flags.join(",")}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const categoryArg = arg("categories", DEFAULT_CATEGORIES.join(","));
  const categories = (categoryArg === "all" ? [...TARGET_CATEGORIES] : categoryArg.split(","))
    .map((item) => item.trim())
    .filter((item) => TARGET_CATEGORIES.has(item));
  const limit = Number(arg("limit", "120000"));
  const includeReview = arg("include-review", "true") !== "false";
  const currentReplayArg = arg("current-replay", "pool");
  const currentReplay = (["all", "pool", "none"].includes(currentReplayArg) ? currentReplayArg : "pool") as "all" | "pool" | "none";
  const progressEvery = Number(arg("progress-every", "5000"));
  const [categoryReadiness, laneReadiness] = await Promise.all([
    loadCategoryReadinessMap(),
    loadLaneReadinessMap(),
  ]);
  const parsedRows = await fetchParsedRows(categories, limit);
  const filteredParsedRows = includeReview ? parsedRows : parsedRows.filter((row) => row.needs_review === false);
  console.error(`[cross-sweep] parsed=${filteredParsedRows.length}/${parsedRows.length} categories=${categories.join(",")}`);
  const rawRows = await fetchRawRows(filteredParsedRows.map((row) => Number(row.pid)));
  const poolRows = await fetchPoolRows(filteredParsedRows.map((row) => Number(row.pid)));
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  console.error(`[cross-sweep] raw=${rawRows.length} pool=${poolRows.length}; replaying current parser`);

  const auditedRows: AuditRow[] = [];
  for (const [index, row] of filteredParsedRows.entries()) {
    auditedRows.push(auditRow(
      row,
      rawByPid.get(Number(row.pid)),
      poolByPid.get(Number(row.pid)),
      currentReplay,
      categoryReadiness,
      laneReadiness,
    ));
    if (progressEvery > 0 && (index + 1) % progressEvery === 0) {
      console.error(`[cross-sweep] replayed ${index + 1}/${filteredParsedRows.length}`);
    }
  }
  const flags: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const actionableByCategory: Record<string, number> = {};
  for (const row of auditedRows) {
    inc(byCategory, row.parsedCategory);
    for (const flag of row.flags) inc(flags, flag);
    if (actionableFlags(row.flags).length > 0) inc(actionableByCategory, row.parsedCategory);
  }
  const actionableRows = auditedRows.filter((row) => actionableFlags(row.flags).length > 0);
  const report = {
    generatedAt: new Date().toISOString(),
    scope: { categories, limit, includeReview, currentReplay, readinessSource: "runtime_db_plus_code", parsedRows: parsedRows.length, rawRows: rawRows.length, poolRows: poolRows.length },
    totals: {
      auditedRows: auditedRows.length,
      flaggedRows: auditedRows.filter((row) => row.flags.length > 0).length,
      actionableRows: actionableRows.length,
      poolRowsReadyOrReserved: auditedRows.filter((row) => row.poolStatus === "ready" || row.poolStatus === "reserved").length,
      poolActionableRows: actionableRows.filter((row) => row.poolStatus === "ready" || row.poolStatus === "reserved").length,
    },
    byCategory,
    flags: Object.fromEntries(Object.entries(flags).sort((a, b) => b[1] - a[1])),
    actionableByCategory,
    groupFindings: groupFindings(auditedRows),
    actionableSamples: actionableRows
      .sort((a, b) => {
        const aw = (a.poolStatus === "ready" || a.poolStatus === "reserved" ? 100 : 0) + actionableFlags(a.flags).length * 10;
        const bw = (b.poolStatus === "ready" || b.poolStatus === "reserved" ? 100 : 0) + actionableFlags(b.flags).length * 10;
        return bw - aw;
      })
      .slice(0, 200)
      .map(sampleRow),
  };
  const jsonPath = path.join(reportsDir, "cross-category-db-deep-sweep-latest.json");
  const mdPath = path.join(reportsDir, "cross-category-db-deep-sweep-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, buildMarkdown(report));
  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: report.totals,
    byCategory: report.byCategory,
    actionableByCategory: report.actionableByCategory,
    topFlags: Object.entries(report.flags).slice(0, 20),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
