import { readFile } from "node:fs/promises";
import path from "node:path";

import { CATALOG, skuById } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { restFetchAll } from "@/lib/rest-paginated";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();

type ParsedRow = {
  pid: number;
  category: string | null;
  parser_version: string | null;
};

type RawRow = {
  pid: number;
  detail_status: string | null;
  listing_state: string | null;
  listing_type: string | null;
  listing_type_override: string | null;
  pool_eligible: boolean | null;
  sku_id: string | null;
  score_dirty: boolean | null;
};

type PoolRow = {
  pid: number;
  category: string | null;
  invalidated_reason: string | null;
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
    // Optional env file.
  }
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function parserExpectedByCategory() {
  const byCategory = new Map<string, string>();
  for (const sku of CATALOG) {
    if (byCategory.has(sku.category)) continue;
    const parsed = parseListingOptions({
      title: sku.modelName,
      description: "",
      skuId: sku.id,
      skuName: sku.modelName,
      category: sku.category,
      defaultProductType: sku.defaultProductType ?? null,
    });
    byCategory.set(sku.category, parsed.parserVersion);
  }
  return Object.fromEntries([...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function isRawEligible(raw: RawRow | undefined) {
  if (!raw) return false;
  const normal = raw.listing_type === "normal" || raw.listing_type_override === "normal";
  return raw.detail_status === "done" &&
    raw.listing_state === "active" &&
    normal &&
    raw.pool_eligible !== false &&
    Boolean(raw.sku_id);
}

async function fetchRawByPids(pids: number[]) {
  const rows: RawRow[] = [];
  for (const part of chunk([...new Set(pids)].filter(Number.isFinite), 800)) {
    if (part.length === 0) continue;
    rows.push(...await restFetchAll<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,detail_status,listing_state,listing_type,listing_type_override,pool_eligible,sku_id,score_dirty&pid=in.(${part.join(",")})`,
      { maxRows: part.length, orderBy: "pid.asc" },
    ));
  }
  return new Map(rows.map((row) => [Number(row.pid), row]));
}

async function patchScoreDirty(pids: number[]) {
  let patched = 0;
  for (const part of chunk([...new Set(pids)].filter(Number.isFinite), 800)) {
    if (part.length === 0) continue;
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.(${part.join(",")})`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: JSON.stringify({ score_dirty: true }),
    });
    patched += part.length;
  }
  return patched;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const apply = hasFlag("apply");
  const expected = parserExpectedByCategory();
  const [parsedRows, stalePoolRows] = await Promise.all([
    restFetchAll<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,category,parser_version`,
      { orderBy: "pid.asc" },
    ),
    restFetchAll<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=pid,category,invalidated_reason&status=eq.invalidated&invalidated_reason=like.stale_parser_version_*`,
      { orderBy: "pid.asc" },
    ),
  ]);

  const parsedCategoryByPid = new Map(parsedRows.map((row) => [Number(row.pid), row.category]));
  const staleParsed = parsedRows.filter((row) => {
    const category = row.category ?? "";
    return Boolean(expected[category]) && row.parser_version !== expected[category];
  });
  const candidatePids = [
    ...staleParsed.map((row) => Number(row.pid)),
    ...stalePoolRows.map((row) => Number(row.pid)),
  ].filter(Number.isFinite);
  const rawByPid = await fetchRawByPids(candidatePids);
  const eligiblePids = [...new Set(candidatePids)].filter((pid) => isRawEligible(rawByPid.get(pid)));
  const alreadyDirty = eligiblePids.filter((pid) => rawByPid.get(pid)?.score_dirty === true);
  const newlyDirty = eligiblePids.filter((pid) => rawByPid.get(pid)?.score_dirty !== true);

  const byCategory: Record<string, { staleParsed: number; stalePoolReason: number; eligible: number; newlyDirty: number }> = {};
  for (const category of Object.keys(expected)) byCategory[category] = { staleParsed: 0, stalePoolReason: 0, eligible: 0, newlyDirty: 0 };
  for (const row of staleParsed) {
    const category = row.category ?? "unknown";
    if (!byCategory[category]) byCategory[category] = { staleParsed: 0, stalePoolReason: 0, eligible: 0, newlyDirty: 0 };
    byCategory[category].staleParsed += 1;
  }
  for (const row of stalePoolRows) {
    const category = row.category ?? parsedCategoryByPid.get(Number(row.pid)) ?? "unknown";
    if (!byCategory[category]) byCategory[category] = { staleParsed: 0, stalePoolReason: 0, eligible: 0, newlyDirty: 0 };
    byCategory[category].stalePoolReason += 1;
  }
  for (const pid of eligiblePids) {
    const rawCategory = rawByPid.get(pid)?.sku_id ? skuById(rawByPid.get(pid)!.sku_id!)?.category : null;
    const category = parsedCategoryByPid.get(pid) ?? rawCategory ?? "unknown";
    if (!byCategory[category]) byCategory[category] = { staleParsed: 0, stalePoolReason: 0, eligible: 0, newlyDirty: 0 };
    byCategory[category].eligible += 1;
  }
  for (const pid of newlyDirty) {
    const rawCategory = rawByPid.get(pid)?.sku_id ? skuById(rawByPid.get(pid)!.sku_id!)?.category : null;
    const category = parsedCategoryByPid.get(pid) ?? rawCategory ?? "unknown";
    if (!byCategory[category]) byCategory[category] = { staleParsed: 0, stalePoolReason: 0, eligible: 0, newlyDirty: 0 };
    byCategory[category].newlyDirty += 1;
  }

  const patched = apply ? await patchScoreDirty(newlyDirty) : 0;
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    expected,
    staleParsedRows: staleParsed.length,
    stalePoolReasonRows: stalePoolRows.length,
    eligiblePids: eligiblePids.length,
    alreadyDirty: alreadyDirty.length,
    newlyDirty: newlyDirty.length,
    patched,
    byCategory: Object.fromEntries(
      Object.entries(byCategory)
        .filter(([, value]) => value.staleParsed || value.stalePoolReason || value.eligible || value.newlyDirty)
        .sort((a, b) => b[1].newlyDirty - a[1].newlyDirty || b[1].eligible - a[1].eligible),
    ),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
