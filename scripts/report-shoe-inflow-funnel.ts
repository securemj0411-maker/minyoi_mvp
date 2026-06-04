import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { restFetchAll } from "@/lib/rest-paginated";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const CATEGORY_EXPECTED_BY_RUNTIME: Record<string, string> = {
  shoe: "wave92-shoe-v41",
  clothing: "wave216-clothing-v53",
};

const CATEGORY_EXPECTED_BEFORE_WAVE807_FIX: Record<string, string> = {
  shoe: "wave92-shoe-v39",
  clothing: "wave216-clothing-v47",
};

const CATEGORY_EXPECTED_BY_PARSER: Record<string, string> = {
  shoe: "wave92-shoe-v41",
  clothing: "wave216-clothing-v53",
};

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
  parsed_at: string | null;
  updated_at: string | null;
};

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  invalidated_reason: string | null;
  updated_at: string | null;
};

type FeedbackRow = {
  id: number;
  pid: number | null;
  feedback_type: string | null;
  note: string | null;
  admin_status: string | null;
  created_at: string | null;
  updated_at: string | null;
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

function inc(map: Record<string, number>, key: string | null | undefined) {
  const k = key || "(null)";
  map[k] = (map[k] ?? 0) + 1;
}

function top(map: Record<string, number>, limit = 20) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function categoryFromRawSku(raw: RawRow) {
  const id = raw.sku_id ?? "";
  if (id.startsWith("shoe-")) return "shoe";
  if (id.startsWith("clothing-")) return "clothing";
  return null;
}

function isRawEligible(raw: RawRow) {
  const normalListing = raw.listing_type === "normal" || raw.listing_type_override === "normal";
  return raw.detail_status === "done" &&
    raw.listing_state === "active" &&
    normalListing &&
    raw.pool_eligible !== false &&
    Boolean(raw.sku_id);
}

function recentSince(days: number) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function isRecent(iso: string | null, days: number) {
  if (!iso) return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms >= recentSince(days);
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

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const [parsed, pool, feedback] = await Promise.all([
    restFetchAll<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,category,parser_version,comparable_key,parse_confidence,needs_review,parsed_at,updated_at&category=in.(shoe,clothing)`,
      { orderBy: "pid.asc" },
    ),
    restFetchAll<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=pid,status,category,comparable_key,expected_profit_min,invalidated_reason,updated_at&category=in.(shoe,clothing)`,
      { orderBy: "pid.asc" },
    ),
    restFetchAll<FeedbackRow>(
      `${tableUrl("mvp_reveal_feedback")}?select=id,pid,feedback_type,note,admin_status,created_at,updated_at&note=not.is.null&order=created_at.desc`,
      { maxRows: 400, orderBy: "created_at.desc" },
    ),
  ]);

  const parsedByPid = new Map(parsed.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(pool.map((row) => [Number(row.pid), row]));
  const rawPids = [
    ...parsed.map((row) => Number(row.pid)),
    ...pool.map((row) => Number(row.pid)),
  ].filter(Number.isFinite);
  const rawAll = await fetchByPids<RawRow>(
    "mvp_raw_listings",
    "pid,name,price,sku_id,sku_name,detail_status,listing_state,listing_type,listing_type_override,pool_eligible,score_dirty,sale_status,num_comment,query,last_seen_at,updated_at",
    rawPids,
  );
  const rawByPid = new Map(rawAll.map((row) => [Number(row.pid), row]));
  const rawShoes = rawAll.filter((row) => parsedByPid.get(Number(row.pid))?.category === "shoe" || categoryFromRawSku(row) === "shoe");
  const rawClothing = rawAll.filter((row) => parsedByPid.get(Number(row.pid))?.category === "clothing" || categoryFromRawSku(row) === "clothing");

  const rawSummary: Record<string, unknown> = {};
  for (const category of ["shoe", "clothing"]) {
    const rows = category === "shoe" ? rawShoes : rawClothing;
    const statusCounts: Record<string, number> = {};
    const queryCounts: Record<string, number> = {};
    const eligibleRows = rows.filter(isRawEligible);
    for (const row of rows) {
      inc(statusCounts, [
        `detail=${row.detail_status ?? "null"}`,
        `state=${row.listing_state ?? "null"}`,
        `type=${row.listing_type_override ?? row.listing_type ?? "null"}`,
        `pool=${String(row.pool_eligible)}`,
        `dirty=${String(row.score_dirty)}`,
      ].join("|"));
      if (row.query) inc(queryCounts, row.query);
    }
    rawSummary[category] = {
      totalSkuMatched: rows.length,
      eligible: eligibleRows.length,
      scoreDirty: rows.filter((row) => row.score_dirty === true).length,
      activeDoneNormal: rows.filter((row) => row.detail_status === "done" && row.listing_state === "active" && (row.listing_type === "normal" || row.listing_type_override === "normal")).length,
      seen24h: rows.filter((row) => isRecent(row.last_seen_at, 1)).length,
      seen7d: rows.filter((row) => isRecent(row.last_seen_at, 7)).length,
      eligibleSeen24h: eligibleRows.filter((row) => isRecent(row.last_seen_at, 1)).length,
      eligibleSeen7d: eligibleRows.filter((row) => isRecent(row.last_seen_at, 7)).length,
      statusTop: top(statusCounts, 12),
      queryTop: top(queryCounts, 20),
    };
  }

  const parsedSummary: Record<string, unknown> = {};
  for (const category of ["shoe", "clothing"]) {
    const rows = parsed.filter((row) => row.category === category);
    const versionCounts: Record<string, number> = {};
    const eligibleRuntimeMismatch = rows.filter((row) => {
      const raw = rawByPid.get(Number(row.pid));
      return raw && isRawEligible(raw) && row.parser_version !== CATEGORY_EXPECTED_BY_RUNTIME[category];
    });
    const eligibleParserMismatch = rows.filter((row) => {
      const raw = rawByPid.get(Number(row.pid));
      return raw && isRawEligible(raw) && row.parser_version !== CATEGORY_EXPECTED_BY_PARSER[category];
    });
    for (const row of rows) inc(versionCounts, row.parser_version);
    parsedSummary[category] = {
      totalParsed: rows.length,
      cleanParsed: rows.filter((row) => row.needs_review === false && Number(row.parse_confidence ?? 0) >= 0.65).length,
      expectedByRuntime: CATEGORY_EXPECTED_BY_RUNTIME[category],
      expectedByParser: CATEGORY_EXPECTED_BY_PARSER[category],
      runtimeMismatch: rows.filter((row) => row.parser_version !== CATEGORY_EXPECTED_BY_RUNTIME[category]).length,
      parserMismatch: rows.filter((row) => row.parser_version !== CATEGORY_EXPECTED_BY_PARSER[category]).length,
      eligibleRuntimeMismatch: eligibleRuntimeMismatch.length,
      eligibleParserMismatch: eligibleParserMismatch.length,
      versionTop: top(versionCounts, 12),
    };
  }

  const poolSummary: Record<string, unknown> = {};
  for (const category of ["shoe", "clothing"]) {
    const rows = pool.filter((row) => row.category === category);
    const statusCounts: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};
    for (const row of rows) {
      inc(statusCounts, row.status);
      if (row.status === "invalidated") inc(reasonCounts, row.invalidated_reason);
    }
    const rawRows = category === "shoe" ? rawShoes : rawClothing;
    const eligibleRows = rawRows.filter(isRawEligible);
    const eligibleNoPool = eligibleRows.filter((row) => !poolByPid.has(Number(row.pid)));
    const eligibleReady = eligibleRows.filter((row) => poolByPid.get(Number(row.pid))?.status === "ready");
    const eligibleInvalidated = eligibleRows.filter((row) => poolByPid.get(Number(row.pid))?.status === "invalidated");
    poolSummary[category] = {
      totalPoolRows: rows.length,
      statusCounts,
      ready: rows.filter((row) => row.status === "ready").length,
      invalidated: rows.filter((row) => row.status === "invalidated").length,
      eligibleReady: eligibleReady.length,
      eligibleInvalidated: eligibleInvalidated.length,
      eligibleNoPool: eligibleNoPool.length,
      invalidatedReasonTop: top(reasonCounts, 25),
    };
  }

  const feedbackPids = feedback.map((row) => Number(row.pid)).filter(Number.isFinite);
  const [feedbackRawRows, feedbackParsedRows, feedbackPoolRows] = await Promise.all([
    fetchByPids<RawRow>("mvp_raw_listings", "pid,name,price,sku_id,sku_name,detail_status,listing_state,listing_type,listing_type_override,pool_eligible,score_dirty,sale_status,num_comment,query,last_seen_at,updated_at", feedbackPids),
    fetchByPids<ParsedRow>("mvp_listing_parsed", "pid,category,parser_version,comparable_key,parse_confidence,needs_review,parsed_at,updated_at", feedbackPids),
    fetchByPids<PoolRow>("mvp_candidate_pool", "pid,status,category,comparable_key,expected_profit_min,invalidated_reason,updated_at", feedbackPids),
  ]);
  const feedbackRawByPid = new Map(feedbackRawRows.map((row) => [Number(row.pid), row]));
  const feedbackParsedByPid = new Map(feedbackParsedRows.map((row) => [Number(row.pid), row]));
  const feedbackPoolByPid = new Map(feedbackPoolRows.map((row) => [Number(row.pid), row]));
  const shoeTerms = /신발|운동화|스니커|슈즈|사이즈|새상품|민트|착용|급|아식스|나이키|뉴발|살로몬|호카|아디다스|푸마|미즈노|컨버스|반스|닥터마틴|크록스|어그|on running|asics|nike|new balance|salomon|hoka|adidas|puma|mizuno|converse|vans|dr\.?\s?martens|crocs|ugg/i;
  const feedbackFashion = feedback
    .map((fb) => {
      const pid = Number(fb.pid);
      const raw = feedbackRawByPid.get(pid) ?? null;
      const parsedRow = feedbackParsedByPid.get(pid) ?? null;
      const poolRow = feedbackPoolByPid.get(pid) ?? null;
      const rawCategory = raw ? categoryFromRawSku(raw) : null;
      const category = parsedRow?.category ?? poolRow?.category ?? rawCategory;
      const text = `${fb.note ?? ""} ${raw?.name ?? ""} ${raw?.sku_id ?? ""}`;
      return { fb, raw, parsed: parsedRow, pool: poolRow, category, text };
    })
    .filter((row) => row.category === "shoe" || row.category === "clothing" || shoeTerms.test(row.text))
    .slice(0, 80);

  const feedbackSummary = {
    fetchedWithNotes: feedback.length,
    fashionOrShoeTerm: feedbackFashion.length,
    rows: feedbackFashion.map((row) => ({
      pid: row.fb.pid,
      type: row.fb.feedback_type,
      category: row.category,
      note: row.fb.note?.slice(0, 180) ?? null,
      title: row.raw?.name ?? null,
      rawSkuId: row.raw?.sku_id ?? null,
      rawEligible: row.raw ? isRawEligible(row.raw) : null,
      parserVersion: row.parsed?.parser_version ?? null,
      parseConfidence: row.parsed?.parse_confidence ?? null,
      needsReview: row.parsed?.needs_review ?? null,
      poolStatus: row.pool?.status ?? null,
      invalidatedReason: row.pool?.invalidated_reason ?? null,
      numComment: row.raw?.num_comment ?? null,
      scoreDirty: row.raw?.score_dirty ?? null,
      updatedAt: row.fb.updated_at ?? row.fb.created_at,
    })),
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    finding: {
      parserRuntimeMismatchBeforeFix: {
        shoe: {
          runtimeExpected: CATEGORY_EXPECTED_BEFORE_WAVE807_FIX.shoe,
          parserActuallyEmits: CATEGORY_EXPECTED_BY_PARSER.shoe,
        },
        clothing: {
          runtimeExpected: CATEGORY_EXPECTED_BEFORE_WAVE807_FIX.clothing,
          parserActuallyEmits: CATEGORY_EXPECTED_BY_PARSER.clothing,
        },
      },
      regularFreshnessCategorySweep: {
        shoeCategory405Pages: 3,
        note: "pipeline-config keeps category:405 at pageCount=3 after Wave 288; deep mode rotates a bounded 40-query window.",
      },
    },
    rawSummary,
    parsedSummary,
    poolSummary,
    feedbackSummary,
  };

  const jsonPath = path.join(reportsDir, "shoe-inflow-funnel-latest.json");
  const mdPath = path.join(reportsDir, "shoe-inflow-funnel-latest.md");
  await writeFile(jsonPath, JSON.stringify(summary, null, 2) + "\n");

  const lines: string[] = [];
  lines.push("# Shoe Inflow Funnel");
  lines.push("");
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push("");
  lines.push("## Parser drift target");
  for (const category of ["shoe", "clothing"]) {
    const parsedCat = parsedSummary[category] as Record<string, unknown>;
    lines.push(`- ${category}: fixed runtime expects \`${CATEGORY_EXPECTED_BY_RUNTIME[category]}\`, parser emits \`${CATEGORY_EXPECTED_BY_PARSER[category]}\`; eligible stale-backlog=${parsedCat.eligibleRuntimeMismatch}`);
  }
  lines.push("");
  lines.push("## Raw / pool funnel");
  for (const category of ["shoe", "clothing"]) {
    const rawCat = rawSummary[category] as Record<string, unknown>;
    const poolCat = poolSummary[category] as Record<string, unknown>;
    lines.push(`- ${category}: raw matched=${rawCat.totalSkuMatched}, raw eligible=${rawCat.eligible}, seen7d=${rawCat.seen7d}, pool ready=${poolCat.ready}, eligibleReady=${poolCat.eligibleReady}, eligibleInvalidated=${poolCat.eligibleInvalidated}, eligibleNoPool=${poolCat.eligibleNoPool}`);
  }
  lines.push("");
  lines.push("## Top invalidation reasons");
  for (const category of ["shoe", "clothing"]) {
    const poolCat = poolSummary[category] as { invalidatedReasonTop: Array<{ key: string; count: number }> };
    lines.push(`### ${category}`);
    for (const item of poolCat.invalidatedReasonTop.slice(0, 12)) {
      lines.push(`- ${item.key}: ${item.count}`);
    }
  }
  lines.push("");
  lines.push("## Feedback sample");
  for (const row of feedbackSummary.rows.slice(0, 25)) {
    lines.push(`- pid=${row.pid} category=${row.category ?? "?"} pool=${row.poolStatus ?? "none"} reason=${row.invalidatedReason ?? "-"} sku=${row.rawSkuId ?? "-"} v=${row.parserVersion ?? "-"} note=${JSON.stringify(row.note ?? "")}`);
  }
  lines.push("");
  await writeFile(mdPath, lines.join("\n"));

  console.log(JSON.stringify({
    report: mdPath,
    json: jsonPath,
    preFixParserMismatch: summary.finding.parserRuntimeMismatchBeforeFix,
    rawSummary: Object.fromEntries(Object.entries(rawSummary).map(([key, value]) => [key, {
      totalSkuMatched: (value as Record<string, unknown>).totalSkuMatched,
      eligible: (value as Record<string, unknown>).eligible,
      seen7d: (value as Record<string, unknown>).seen7d,
    }])),
    poolSummary: Object.fromEntries(Object.entries(poolSummary).map(([key, value]) => [key, {
      ready: (value as Record<string, unknown>).ready,
      eligibleReady: (value as Record<string, unknown>).eligibleReady,
      eligibleInvalidated: (value as Record<string, unknown>).eligibleInvalidated,
      eligibleNoPool: (value as Record<string, unknown>).eligibleNoPool,
      topReasons: (value as { invalidatedReasonTop: Array<{ key: string; count: number }> }).invalidatedReasonTop.slice(0, 8),
    }])),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
