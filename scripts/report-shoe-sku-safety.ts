import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CATALOG, ruleMatch } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { restFetchAll } from "@/lib/rest-paginated";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type RawRow = {
  pid: number;
  name: string | null;
  price: number | null;
  sku_id: string | null;
  sku_name: string | null;
  detail_status: string | null;
  listing_state: string | null;
  listing_type: string | null;
  listing_type_override: string | null;
  pool_eligible: boolean | null;
  score_dirty: boolean | null;
  sale_status: string | null;
  num_comment: number | null;
  query: string | null;
  last_seen_at: string | null;
  updated_at: string | null;
};

type ParsedRow = {
  pid: number;
  category: string | null;
  parser_version: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  condition_class: string | null;
  condition_tier: string | null;
  parsed_json: Record<string, unknown> | null;
};

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  invalidated_reason: string | null;
  updated_at: string | null;
};

type FeedbackRow = {
  id: number;
  pid: number | null;
  feedback_type: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MarketRow = {
  comparable_key: string;
  condition_class: string | null;
  condition_tier: string | null;
  active_sample_count: number | null;
  sold_sample_count: number | null;
  disappeared_sample_count: number | null;
  blended_median_price: number | null;
  active_median_price: number | null;
  confidence: string | null;
  date: string | null;
};

type JoinedRow = {
  pid: number;
  raw: RawRow | null;
  parsed: ParsedRow | null;
  pool: PoolRow | null;
  currentMatchId: string | null;
  currentMatchCategory: string | null;
  currentMatchChecked: boolean;
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
    // Optional local env.
  }
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function fetchByPids<T extends Record<string, unknown>>(table: string, select: string, pids: number[]) {
  const rows: T[] = [];
  for (const part of chunk([...new Set(pids)].filter(Number.isFinite), 800)) {
    if (part.length === 0) continue;
    rows.push(...await restFetchAll<T>(
      `${tableUrl(table)}?select=${select}&pid=in.(${part.join(",")})`,
      { maxRows: part.length, orderBy: "pid.asc" },
    ));
  }
  return rows;
}

function isRawEligible(raw: RawRow | null) {
  if (!raw) return false;
  const normalListing = raw.listing_type === "normal" || raw.listing_type_override === "normal";
  return raw.detail_status === "done" &&
    raw.listing_state === "active" &&
    normalListing &&
    raw.pool_eligible !== false &&
    Boolean(raw.sku_id);
}

function titleLooksOtherCategory(title: string, category: string) {
  const clothing = /카라티|피케|티셔츠|반팔|롱슬리브|맨투맨|후드|후디|셔츠|자켓|재킷|패딩|코트|바지|팬츠|쇼츠|반바지|니트|가디건|데님|트랙탑|져지|저지|스웨트|스웻|캡|모자|양말|hoodie|shirt|jacket|pants|shorts|knit|cardigan/i.test(title);
  const shoe = /운동화|스니커|스니커즈|부츠(?!컷)|샌들|슬리퍼|로퍼|슈즈|러닝화|등산화|트레킹화|축구화|풋살화|sneaker|shoe|shoes|\bboot\b|sandal|loafer|slipper/i.test(title);
  const bag = /가방|백팩|토트|숄더|크로스백|메신저|더플|클러치|파우치|지갑|월렛|\bbag\b|\bbackpack\b|\btote\b|\bwallet\b|\bpouch\b/i.test(title);
  const nonFashion = /컵|텀블러|인형|굿즈|키링|참|포카(?!리)|아크릴|스티커/i.test(title);
  if (category === "shoe") {
    const clothingItem = /카라티|피케|티셔츠|반팔|롱슬리브|맨투맨|후드|후디|셔츠|자켓|재킷|패딩|코트|바지|팬츠|쇼츠|반바지|니트|가디건|트랙탑|져지|저지|스웨트|스웻|캡|모자|양말|hoodie|shirt|jacket|pants|shorts|knit|cardigan/i.test(title);
    return nonFashion || bag || (clothingItem && !shoe);
  }
  if (category === "clothing") return nonFashion || (shoe && !clothing) || (bag && !clothing);
  if (category === "bag") return nonFashion || shoe || clothing;
  return nonFashion;
}

function titleLooksTrade(title: string) {
  return /(?:판\s*\/\s*교|판매\s*\/\s*교환|교신가능|교신\s*가능|교환가능|교환\s*가능)/i.test(title);
}

const EXACT_FOOTBALL_SKU_IDS = new Set([
  "shoe-adidas-football-f50",
  "shoe-adidas-football-predator",
  "shoe-adidas-football-copa",
  "shoe-puma-football-ultra",
  "shoe-puma-football-future",
  "shoe-puma-football-king",
]);

function isBroadSkuId(id: string, category: string) {
  if (category === "shoe" && EXACT_FOOTBALL_SKU_IDS.has(id)) return false;
  return /broad|football|futsal|designer|luxury|generic|main/.test(id);
}

function sampleCount(row: MarketRow | undefined) {
  if (!row) return 0;
  return Number(row.active_sample_count ?? 0) + Number(row.sold_sample_count ?? 0) + Number(row.disappeared_sample_count ?? 0);
}

function compactReason(reason: string | null | undefined) {
  return reason || "-";
}

function activePoolKey(pool: PoolRow | null | undefined) {
  if (pool?.status !== "ready" && pool?.status !== "reserved") return null;
  return pool.comparable_key ?? null;
}

async function fetchLatestMarketRows(keys: string[]) {
  const latest = new Map<string, MarketRow>();
  const unique = [...new Set(keys.filter(Boolean))];
  for (const part of chunk(unique, 40)) {
    const encoded = part.map((key) => encodeURIComponent(key)).join(",");
    const cols = [
      "comparable_key",
      "condition_class",
      "condition_tier",
      "active_sample_count",
      "sold_sample_count",
      "disappeared_sample_count",
      "blended_median_price",
      "active_median_price",
      "confidence",
      "date",
    ].join(",");
    const rows = await restFetchAll<MarketRow>(
      `${tableUrl("mvp_market_price_daily")}?select=${cols}&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc`,
      { maxRows: Math.max(500, part.length * 40), orderBy: "date.desc" },
    );
    for (const row of rows) {
      const existing = latest.get(row.comparable_key);
      const existingCount = sampleCount(existing);
      const rowCount = sampleCount(row);
      if (!existing || String(row.date ?? "") > String(existing.date ?? "") || rowCount > existingCount) {
        latest.set(row.comparable_key, row);
      }
    }
  }
  return latest;
}

function classifySku(input: {
  category: string;
  skuId: string;
  rows: JoinedRow[];
  readyRows: JoinedRow[];
  samplePollution: JoinedRow[];
  marketSampleMax: number;
  feedbackCount: number;
}) {
  const rawMatched = input.rows.length;
  const eligible = input.rows.filter((row) => isRawEligible(row.raw)).length;
  const ready = input.readyRows.length;
  const staleWouldNull = input.readyRows.filter((row) => row.currentMatchChecked && row.currentMatchId == null && isRawEligible(row.raw)).length;
  const currentOther = input.readyRows.filter((row) => row.currentMatchChecked && row.currentMatchId && row.currentMatchId !== input.skuId).length;
  const otherCategoryReady = input.readyRows.filter((row) => titleLooksOtherCategory(row.raw?.name ?? "", input.category)).length;
  const tradeReady = input.readyRows.filter((row) => titleLooksTrade(row.raw?.name ?? "")).length;
  const isBroad = isBroadSkuId(input.skuId, input.category);

  if (rawMatched === 0) return { grade: "empty", reason: "no_raw_rows" };
  if (otherCategoryReady > 0 || tradeReady > 0 || currentOther > 0 || input.samplePollution.length > 0) {
    return { grade: "fix_now", reason: `deterministic_pollution:ready_other_category=${otherCategoryReady},trade=${tradeReady},current_other=${currentOther},sample_pollution=${input.samplePollution.length}` };
  }
  if (ready > 0 && !isBroad && input.marketSampleMax >= 5 && staleWouldNull === 0 && input.feedbackCount === 0) {
    return { grade: "safe_public", reason: "ready_with_clean_current_match_and_sample>=5" };
  }
  if (ready > 0 && !isBroad && input.marketSampleMax >= 3 && currentOther === 0) {
    return { grade: "probably_safe", reason: `ready_clean_but_thin_or_feedback:sample=${input.marketSampleMax},stale_null=${staleWouldNull},feedback=${input.feedbackCount}` };
  }
  if (ready > 0 && isBroad) {
    return { grade: "watch_internal_only", reason: `broad_or_family_lane_public_risk:sample=${input.marketSampleMax},stale_null=${staleWouldNull}` };
  }
  if (eligible > 0 && (isBroad || input.marketSampleMax < 5 || staleWouldNull > 0)) {
    return { grade: "watch_internal_only", reason: `eligible_not_proven:ready=${ready},sample=${input.marketSampleMax},stale_null=${staleWouldNull},broad=${isBroad}` };
  }
  return { grade: "inactive_or_no_pool", reason: `raw=${rawMatched},eligible=${eligible},ready=${ready}` };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const category = arg("category", "shoe");
  const skuPrefix = `${category}-`;
  const keyPrefix = `${category}|`;
  const categoryCatalog = CATALOG.filter((sku) => sku.category === category);
  const catalogIds = new Set(categoryCatalog.map((sku) => sku.id));

  const [parsed, pool, feedback] = await Promise.all([
    restFetchAll<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,category,parser_version,comparable_key,parse_confidence,needs_review,condition_class,condition_tier,parsed_json&category=eq.${encodeURIComponent(category)}`,
      { orderBy: "pid.asc" },
    ),
    restFetchAll<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min,expected_profit_max,invalidated_reason,updated_at&category=eq.${encodeURIComponent(category)}`,
      { orderBy: "pid.asc" },
    ),
    restFetchAll<FeedbackRow>(
      `${tableUrl("mvp_reveal_feedback")}?select=id,pid,feedback_type,note,created_at,updated_at&note=not.is.null&order=created_at.desc`,
      { maxRows: 500, orderBy: "created_at.desc" },
    ),
  ]);

  const pids = [
    ...parsed.map((row) => Number(row.pid)),
    ...pool.map((row) => Number(row.pid)),
    ...feedback.map((row) => Number(row.pid)).filter(Number.isFinite),
  ];
  const rawRows = await fetchByPids<RawRow>(
    "mvp_raw_listings",
    "pid,name,price,sku_id,sku_name,detail_status,listing_state,listing_type,listing_type_override,pool_eligible,score_dirty,sale_status,num_comment,query,last_seen_at,updated_at",
    pids,
  );

  const parsedByPid = new Map(parsed.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(pool.map((row) => [Number(row.pid), row]));
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const feedbackByPid = new Map<number, FeedbackRow[]>();
  for (const row of feedback) {
    const pid = Number(row.pid);
    if (!Number.isFinite(pid)) continue;
    const list = feedbackByPid.get(pid) ?? [];
    list.push(row);
    feedbackByPid.set(pid, list);
  }

  const readyKeySeed = new Set(
    pool
      .filter((row) => row.status === "ready")
      .map((row) => row.comparable_key)
      .filter((key): key is string => Boolean(key)),
  );
  const feedbackPidSeed = new Set([...feedbackByPid.keys()]);
  const joined: JoinedRow[] = [...new Set(pids.filter(Number.isFinite))]
    .map((pid) => {
      const raw = rawByPid.get(pid) ?? null;
      const parsedRow = parsedByPid.get(pid) ?? null;
      const poolRow = poolByPid.get(pid) ?? null;
      const title = raw?.name ?? "";
      const key = parsedRow?.comparable_key ?? poolRow?.comparable_key ?? null;
      const shouldCheckCurrent = Boolean(
        title &&
        (
          poolRow?.status === "ready" ||
          feedbackPidSeed.has(pid)
        ),
      );
      const current = shouldCheckCurrent ? ruleMatch(title, "") : null;
      return {
        pid,
        raw,
        parsed: parsedRow,
        pool: poolRow,
        currentMatchId: shouldCheckCurrent ? current?.id ?? null : raw?.sku_id ?? null,
        currentMatchCategory: shouldCheckCurrent ? current?.category ?? null : raw?.sku_id?.startsWith(skuPrefix) ? category : null,
        currentMatchChecked: shouldCheckCurrent,
      };
    })
    .filter((row) => row.parsed?.category === category || row.pool?.category === category || row.raw?.sku_id?.startsWith(skuPrefix));

  const rowsBySku = new Map<string, JoinedRow[]>();
  const keyRows = new Map<string, JoinedRow[]>();
  for (const row of joined) {
    const skuId = row.raw?.sku_id ?? row.currentMatchId ?? null;
    if (skuId?.startsWith(skuPrefix)) {
      const list = rowsBySku.get(skuId) ?? [];
      list.push(row);
      rowsBySku.set(skuId, list);
    }
    const key = row.parsed?.comparable_key ?? activePoolKey(row.pool);
    if (key?.startsWith(keyPrefix)) {
      const list = keyRows.get(key) ?? [];
      list.push(row);
      keyRows.set(key, list);
    }
  }
  const readyKeys = joined
    .filter((row) => row.pool?.status === "ready")
    .map((row) => row.parsed?.comparable_key ?? activePoolKey(row.pool) ?? "")
    .filter(Boolean);
  const marketByKey = await fetchLatestMarketRows(readyKeys);

  const summaries = [...catalogIds]
    .map((skuId) => {
      const rows = rowsBySku.get(skuId) ?? [];
      const readyRows = rows.filter((row) => row.pool?.status === "ready");
      const invalidatedRows = rows.filter((row) => row.pool?.status === "invalidated");
      const keysForSku = [...new Set(rows.map((row) => row.parsed?.comparable_key ?? activePoolKey(row.pool)).filter((key): key is string => Boolean(key)))];
      const marketSampleMax = Math.max(
        0,
        ...keysForSku.map((key) => {
          const marketCount = sampleCount(marketByKey.get(key));
          const parsedCount = keyRows.get(key)?.length ?? 0;
          return Math.max(marketCount, parsedCount);
        }),
      );
      const polluted: JoinedRow[] = [];
      for (const ready of readyRows) {
        const key = ready.parsed?.comparable_key ?? activePoolKey(ready.pool);
        if (!key) continue;
        for (const sample of keyRows.get(key) ?? []) {
          if (sample.pid === ready.pid) continue;
          const title = sample.raw?.name ?? "";
          const obviousOtherCategory = titleLooksOtherCategory(title, category);
          const otherCurrent = sample.currentMatchChecked && sample.currentMatchId && sample.currentMatchId !== skuId;
          if (otherCurrent || obviousOtherCategory) polluted.push(sample);
        }
      }
      const feedbackRows = rows.flatMap((row) => feedbackByPid.get(row.pid) ?? []);
      const classification = classifySku({
        category,
        skuId,
        rows,
        readyRows,
        samplePollution: polluted,
        marketSampleMax,
        feedbackCount: feedbackRows.length,
      });
      const reasonCounts = new Map<string, number>();
      for (const row of invalidatedRows) {
        const key = compactReason(row.pool?.invalidated_reason);
        reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
      }
      return {
        skuId,
        modelName: categoryCatalog.find((sku) => sku.id === skuId)?.modelName ?? skuId,
        grade: classification.grade,
        reason: classification.reason,
        rawMatched: rows.length,
        eligible: rows.filter((row) => isRawEligible(row.raw)).length,
        ready: readyRows.length,
        invalidated: invalidatedRows.length,
        noPool: rows.filter((row) => !row.pool).length,
        marketSampleMax,
        currentStillMatches: rows.filter((row) => row.currentMatchId === skuId).length,
        currentChecked: rows.filter((row) => row.currentMatchChecked).length,
        currentWouldNull: readyRows.filter((row) => row.currentMatchChecked && row.currentMatchId == null).length,
        currentWouldOther: readyRows.filter((row) => row.currentMatchChecked && row.currentMatchId && row.currentMatchId !== skuId).length,
        feedbackCount: feedbackRows.length,
        keys: keysForSku.slice(0, 8),
        topInvalidatedReasons: [...reasonCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key, count]) => ({ key, count })),
        readyExamples: readyRows.slice(0, 5).map((row) => ({
          pid: row.pid,
          title: row.raw?.name ?? "",
          price: row.raw?.price ?? null,
          comparableKey: row.parsed?.comparable_key ?? activePoolKey(row.pool),
          currentMatchId: row.currentMatchId,
        })),
        pollutionExamples: polluted.slice(0, 8).map((row) => ({
          pid: row.pid,
          title: row.raw?.name ?? "",
          price: row.raw?.price ?? null,
          rawSkuId: row.raw?.sku_id ?? null,
          currentMatchId: row.currentMatchId,
          comparableKey: row.parsed?.comparable_key ?? activePoolKey(row.pool),
        })),
        feedbackExamples: feedbackRows.slice(0, 5).map((row) => ({
          pid: row.pid,
          type: row.feedback_type,
          note: row.note?.slice(0, 240) ?? "",
          updatedAt: row.updated_at ?? row.created_at,
        })),
      };
    })
    .filter((row) => row.rawMatched > 0 || row.ready > 0 || row.invalidated > 0);

  const gradeCounts = summaries.reduce<Record<string, number>>((acc, row) => {
    acc[row.grade] = (acc[row.grade] ?? 0) + 1;
    return acc;
  }, {});
  const readyGradeCounts = summaries.filter((row) => row.ready > 0).reduce<Record<string, number>>((acc, row) => {
    acc[row.grade] = (acc[row.grade] ?? 0) + 1;
    return acc;
  }, {});

  const output = {
    generatedAt: new Date().toISOString(),
    totals: {
      category,
      catalogSku: categoryCatalog.length,
      nonEmptySku: summaries.length,
      readySku: summaries.filter((row) => row.ready > 0).length,
      gradeCounts,
      readyGradeCounts,
    },
    summary: summaries.sort((a, b) => {
      const gradeOrder: Record<string, number> = {
        fix_now: 0,
        watch_internal_only: 1,
        probably_safe: 2,
        safe_public: 3,
        inactive_or_no_pool: 4,
        empty: 5,
      };
      return (gradeOrder[a.grade] ?? 9) - (gradeOrder[b.grade] ?? 9) ||
        b.ready - a.ready ||
        b.eligible - a.eligible ||
        a.skuId.localeCompare(b.skuId);
    }),
  };

  const jsonPath = path.join(reportsDir, `${category}-sku-safety-latest.json`);
  const mdPath = path.join(reportsDir, `${category}-sku-safety-latest.md`);
  await writeFile(jsonPath, `${JSON.stringify(output, null, 2)}\n`);

  const lines: string[] = [];
  lines.push(`# ${category[0]?.toUpperCase() ?? ""}${category.slice(1)} SKU Safety`);
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push("");
  lines.push("## Totals");
  lines.push(`- category: ${output.totals.category}`);
  lines.push(`- catalog SKUs: ${output.totals.catalogSku}`);
  lines.push(`- non-empty SKUs: ${output.totals.nonEmptySku}`);
  lines.push(`- ready SKUs: ${output.totals.readySku}`);
  lines.push(`- grade counts: ${JSON.stringify(output.totals.gradeCounts)}`);
  lines.push(`- ready grade counts: ${JSON.stringify(output.totals.readyGradeCounts)}`);
  lines.push("");
  for (const grade of ["fix_now", "watch_internal_only", "probably_safe", "safe_public"]) {
    lines.push(`## ${grade}`);
    for (const row of output.summary.filter((item) => item.grade === grade).slice(0, 60)) {
      lines.push(`- ${row.skuId}: ready=${row.ready}, eligible=${row.eligible}, sampleMax=${row.marketSampleMax}, currentOther=${row.currentWouldOther}, currentNull=${row.currentWouldNull}, feedback=${row.feedbackCount} — ${row.reason}`);
      for (const ex of row.pollutionExamples.slice(0, 3)) {
        lines.push(`  - pollution pid=${ex.pid} match=${ex.currentMatchId ?? "-"} rawSku=${ex.rawSkuId ?? "-"} title=${JSON.stringify(ex.title)}`);
      }
      for (const ex of row.feedbackExamples.slice(0, 2)) {
        lines.push(`  - feedback pid=${ex.pid} type=${ex.type ?? "-"} note=${JSON.stringify(ex.note)}`);
      }
    }
    lines.push("");
  }
  await writeFile(mdPath, lines.join("\n"));

  console.log(JSON.stringify({
    report: mdPath,
    json: jsonPath,
    totals: output.totals,
    fixNow: output.summary.filter((row) => row.grade === "fix_now").slice(0, 20).map((row) => ({
      skuId: row.skuId,
      ready: row.ready,
      eligible: row.eligible,
      reason: row.reason,
      pollution: row.pollutionExamples.slice(0, 3),
      feedback: row.feedbackExamples.slice(0, 2),
    })),
    watchInternalOnly: output.summary.filter((row) => row.grade === "watch_internal_only").slice(0, 20).map((row) => ({
      skuId: row.skuId,
      ready: row.ready,
      eligible: row.eligible,
      reason: row.reason,
    })),
    safePublicCount: output.summary.filter((row) => row.grade === "safe_public").length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
