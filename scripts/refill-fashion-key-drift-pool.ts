import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { scoreStage } from "@/lib/tick-pipeline";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const CHUNK_SIZE = 80;

type PoolRow = {
  pid: number;
  category: string | null;
  invalidated_reason: string | null;
  updated_at: string | null;
};

type RawRow = {
  pid: number;
  name: string | null;
  description_preview: string | null;
  sku_id: string | null;
  sku_name: string | null;
  bunjang_condition_label: string | null;
};

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      process.env[key] ??= value;
    }
  } catch {
    // Optional local env file.
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
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

async function patchRawDirty(pids: number[]) {
  for (const part of chunk(pids, CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({ score_dirty: true }),
    });
  }
}

async function upsertParsed(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  for (const part of chunk(rows, CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_listing_parsed")}?on_conflict=pid`, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
      body: jsonBody(part),
    });
  }
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const apply = hasFlag("apply");
  const runScore = hasFlag("score");
  const reason = arg("reason", "wave410_pool_key_drift");
  const limit = Number(arg("limit", "5000"));
  const scoreBudgetMs = Number(arg("score-budget-ms", "120000"));

  const poolRows = await fetchJson<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=pid,category,invalidated_reason,updated_at&status=eq.invalidated&invalidated_reason=eq.${encodeURIComponent(reason)}&order=updated_at.desc&limit=${limit}`,
  );
  const pids = [...new Set(poolRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const rawRows: RawRow[] = [];
  for (const part of chunk(pids, 200)) {
    rawRows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview,sku_id,sku_name,bunjang_condition_label&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }

  const reparsedRows = rawRows.map((raw) => {
    const sku = ruleMatch(raw.name ?? "", raw.description_preview ?? "");
    if (!sku) return null;
    const parsed = parseListingOptions({
      title: raw.name ?? "",
      description: raw.description_preview ?? "",
      skuId: sku.id,
      skuName: sku.modelName,
      category: sku.category,
      bunjangConditionLabel: raw.bunjang_condition_label,
      defaultProductType: sku.defaultProductType ?? null,
    });
    return {
      pid: Number(raw.pid),
      title: raw.name,
      rawSkuId: raw.sku_id,
      currentSkuId: sku.id,
      currentKey: parsed.comparableKey,
      parsedRow: toParsedListingRow(raw.pid, parsed),
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));

  let scoreStats: unknown = null;
  if (apply) {
    await upsertParsed(reparsedRows.map((row) => row.parsedRow));
    await patchRawDirty(reparsedRows.map((row) => row.pid));
    if (runScore) {
      process.env.PIPELINE_TICK_SCORE_LIMIT = String(Math.max(100, reparsedRows.length + 50));
      scoreStats = await scoreStage(Date.now() + scoreBudgetMs);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    runScore,
    reason,
    invalidatedRows: poolRows.length,
    rawRows: rawRows.length,
    reparsedRows: reparsedRows.length,
    scoreStats,
    samples: reparsedRows.slice(0, 40).map(({ parsedRow: _parsedRow, ...row }) => row),
  };

  const suffix = apply ? "apply" : "dry-run";
  const jsonPath = path.join(reportsDir, `fashion-key-drift-refill-${suffix}-latest.json`);
  const mdPath = path.join(reportsDir, `fashion-key-drift-refill-${suffix}-latest.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Fashion Key Drift Refill",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    `- invalidatedRows: ${report.invalidatedRows}`,
    `- rawRows: ${report.rawRows}`,
    `- reparsedRows: ${report.reparsedRows}`,
    `- score: ${runScore ? "yes" : "no"}`,
    "",
    "## Samples",
    ...report.samples.slice(0, 20).map((row) => `- pid ${row.pid}: ${row.title} / ${row.rawSkuId} -> ${row.currentSkuId} / ${row.currentKey}`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: {
      mode: report.mode,
      invalidatedRows: report.invalidatedRows,
      rawRows: report.rawRows,
      reparsedRows: report.reparsedRows,
      scoreStats: report.scoreStats,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
