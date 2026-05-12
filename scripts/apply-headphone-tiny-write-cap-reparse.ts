import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const applyMode = process.argv.includes("--apply=1");

type PlanRow = {
  pid: number;
  title: string;
  rawPatch: {
    listing_type: string | null;
    sku_id: string | null;
    sku_name: string | null;
  };
  parsedPatchIntent: {
    comparable_key: string | null;
  };
};

type Plan = {
  decision: string;
  patchPlan: PlanRow[];
};

type RawSnapshot = {
  pid: number;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
  listing_state: string | null;
  detail_status: string | null;
  updated_at: string | null;
};

type ParsedSnapshot = {
  pid: number;
  parser_version: string | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
};

type PoolSnapshot = {
  pid: number;
  status: string | null;
  comparable_key: string | null;
};

async function loadEnvFile(filePath: string) {
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
    // optional env file
  }
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders(prefer?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function patchRow(table: string, pid: number, body: Record<string, unknown>) {
  const res = await fetch(`${supabaseRestUrl()}/${table}?pid=eq.${pid}`, {
    method: "PATCH",
    headers: authHeaders("return=minimal"),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${table} pid=${pid} ${res.status}: ${await res.text()}`);
}

async function upsertParsedRows(rows: Record<string, unknown>[]) {
  const res = await fetch(`${supabaseRestUrl()}/mvp_listing_parsed?on_conflict=pid`, {
    method: "POST",
    headers: authHeaders("resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`mvp_listing_parsed upsert ${res.status}: ${await res.text()}`);
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const plan = await readJson<Plan>("reports/headphone-tiny-write-cap-reparse-plan-latest.json");
  if (plan.decision !== "tiny_write_cap_reparse_plan_ready_for_owner_apply_decision") {
    throw new Error(`Plan is not ready: ${plan.decision}`);
  }
  const rows = plan.patchPlan;
  if (rows.length !== 3) throw new Error(`Expected exactly 3 rows, got ${rows.length}`);
  const pids = rows.map((row) => row.pid);
  const pidFilter = pids.join(",");
  const [rawRows, parsedRows, poolRows] = await Promise.all([
    restJson<RawSnapshot[]>(
      `/mvp_raw_listings?select=pid,name,price,description_preview,listing_type,sku_id,sku_name,listing_state,detail_status,updated_at&pid=in.(${pidFilter})&limit=3`,
    ),
    restJson<ParsedSnapshot[]>(
      `/mvp_listing_parsed?select=pid,parser_version,comparable_key,parse_confidence,needs_review&pid=in.(${pidFilter})&limit=3`,
    ),
    restJson<PoolSnapshot[]>(`/mvp_candidate_pool?select=pid,status,comparable_key&pid=in.(${pidFilter})&limit=3`),
  ]);
  const rawByPid = new Map(rawRows.map((row) => [row.pid, row]));
  const parsedByPid = new Map(parsedRows.map((row) => [row.pid, row]));
  const poolByPid = new Map(poolRows.map((row) => [row.pid, row]));
  const generatedAt = new Date().toISOString();

  const planned = rows.map((row) => {
    const raw = rawByPid.get(row.pid);
    if (!raw) throw new Error(`Missing raw row pid=${row.pid}`);
    const classified = classifyListing(raw.name ?? "", raw.description_preview ?? "", raw.price ?? 0);
    const matchedSku = ruleMatch(raw.name ?? "", raw.description_preview ?? "");
    const sku = classified.sku ?? matchedSku;
    const parsed = parseListingOptions({
      title: raw.name ?? "",
      description: raw.description_preview ?? "",
      category: "earphone",
      skuId: sku?.id ?? null,
      skuName: sku?.modelName ?? null,
    });
    const parsedRow = toParsedListingRow(row.pid, parsed);
    const validationErrors = [
      raw.listing_type !== "accessory" ? `current_listing_type_not_accessory:${raw.listing_type}` : null,
      raw.sku_id !== null ? `current_sku_id_not_null:${raw.sku_id}` : null,
      poolByPid.has(row.pid) ? `candidate_pool_row_exists:${poolByPid.get(row.pid)?.status}` : null,
      classified.listingType !== row.rawPatch.listing_type ? `next_listing_type_mismatch:${classified.listingType}` : null,
      (sku?.id ?? null) !== row.rawPatch.sku_id ? `next_sku_mismatch:${sku?.id ?? null}` : null,
      parsed.comparableKey !== row.parsedPatchIntent.comparable_key ? `next_key_mismatch:${parsed.comparableKey}` : null,
      parsed.needsReview ? "next_needs_review_true" : null,
    ].filter((value): value is string => Boolean(value));
    return {
      pid: row.pid,
      title: raw.name ?? "",
      validationErrors,
      rawPatch: {
        listing_type: classified.listingType,
        sku_id: sku?.id ?? null,
        sku_name: sku?.modelName ?? null,
        updated_at: generatedAt,
      },
      parsedRow,
      before: {
        raw,
        parsed: parsedByPid.get(row.pid) ?? null,
        pool: poolByPid.get(row.pid) ?? null,
      },
    };
  });
  const failed = planned.filter((row) => row.validationErrors.length > 0);
  if (failed.length > 0) {
    console.error(JSON.stringify(failed.map((row) => ({ pid: row.pid, validationErrors: row.validationErrors })), null, 2));
    throw new Error("Validation failed; refusing apply");
  }

  if (applyMode) {
    for (const row of planned) await patchRow("mvp_raw_listings", row.pid, row.rawPatch);
    await upsertParsedRows(planned.map((row) => row.parsedRow));
  }

  const afterRawRows = applyMode
    ? await restJson<RawSnapshot[]>(
        `/mvp_raw_listings?select=pid,name,listing_type,sku_id,sku_name,listing_state,detail_status,updated_at&pid=in.(${pidFilter})&limit=3`,
      )
    : [];
  const afterParsedRows = applyMode
    ? await restJson<ParsedSnapshot[]>(
        `/mvp_listing_parsed?select=pid,parser_version,comparable_key,parse_confidence,needs_review&pid=in.(${pidFilter})&limit=3`,
      )
    : [];

  const report = {
    generatedAt,
    mode: applyMode ? "apply" : "dry_run",
    reportOnly: !applyMode,
    sourcePlan: "reports/headphone-tiny-write-cap-reparse-plan-latest.json",
    productionDbMutation: applyMode,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    metrics: {
      plannedRows: planned.length,
      validationPassedRows: planned.length - failed.length,
      validationFailedRows: failed.length,
      rawPatchRows: applyMode ? planned.length : 0,
      parsedUpsertRows: applyMode ? planned.length : 0,
      candidatePoolWrites: 0,
    },
    rows: planned.map((row) => ({
      pid: row.pid,
      title: row.title,
      validationErrors: row.validationErrors,
      rawPatch: row.rawPatch,
      parsedComparableKey: row.parsedRow.comparable_key,
      parsedNeedsReview: row.parsedRow.needs_review,
      before: row.before,
    })),
    after: {
      rawRows: afterRawRows,
      parsedRows: afterParsedRows,
    },
  };
  const stem = applyMode ? "headphone-tiny-write-cap-reparse-apply-latest" : "headphone-tiny-write-cap-reparse-dry-run-latest";
  await writeFile(path.join(reportsDir, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Tiny Write-Cap Reparse Execution",
    "",
    `- generatedAt: ${generatedAt}`,
    `- mode: ${report.mode}`,
    `- productionDbMutation: ${report.productionDbMutation}`,
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    "",
    "## Summary",
    "",
    mdTable(["metric", "value"], Object.entries(report.metrics)),
    "",
    "## Rows",
    "",
    mdTable(
      ["pid", "title", "rawPatch", "parsedKey", "validation"],
      planned.map((row) => [
        row.pid,
        row.title,
        JSON.stringify(row.rawPatch),
        row.parsedRow.comparable_key,
        row.validationErrors.length ? row.validationErrors.join(", ") : "ok",
      ]),
    ),
    "",
    "## Rollback Basis",
    "",
    "- Previous raw/parsed/pool values are stored in the JSON report under `rows[].before`.",
    "- Candidate pool was intentionally not touched.",
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, `${stem}.md`), `${md}\n`);
  console.log(JSON.stringify(report.metrics, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
