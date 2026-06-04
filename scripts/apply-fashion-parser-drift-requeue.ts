import { readFile } from "node:fs/promises";
import path from "node:path";

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { restFetchAll } from "@/lib/rest-paginated";

const appDir = process.cwd();
const EXPECTED: Record<string, string> = {
  shoe: "wave92-shoe-v41",
  clothing: "wave216-clothing-v53",
};

type ParsedRow = {
  pid: number;
  category: "shoe" | "clothing";
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
  category: "shoe" | "clothing" | null;
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

function arg(name: string) {
  return process.argv.includes(`--${name}`);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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
  const apply = arg("apply");

  const [parsedRows, stalePoolRows] = await Promise.all([
    restFetchAll<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,category,parser_version&category=in.(shoe,clothing)`,
      { orderBy: "pid.asc" },
    ),
    restFetchAll<PoolRow>(
      `${tableUrl("mvp_candidate_pool")}?select=pid,category,invalidated_reason&status=eq.invalidated&category=in.(shoe,clothing)&or=(invalidated_reason.eq.stale_parser_version_shoe,invalidated_reason.eq.stale_parser_version_shoe_residue,invalidated_reason.eq.stale_parser_version_clothing,invalidated_reason.eq.stale_parser_version_clothing_residue)`,
      { orderBy: "pid.asc" },
    ),
  ]);

  const staleParsed = parsedRows.filter((row) => row.parser_version !== EXPECTED[row.category]);
  const candidatePids = [
    ...staleParsed.map((row) => Number(row.pid)),
    ...stalePoolRows.map((row) => Number(row.pid)),
  ].filter(Number.isFinite);
  const rawByPid = await fetchRawByPids(candidatePids);
  const eligiblePids = [...new Set(candidatePids)].filter((pid) => isRawEligible(rawByPid.get(pid)));
  const alreadyDirty = eligiblePids.filter((pid) => rawByPid.get(pid)?.score_dirty === true);
  const newlyDirty = eligiblePids.filter((pid) => rawByPid.get(pid)?.score_dirty !== true);

  const byCategory: Record<string, { staleParsed: number; stalePoolReason: number; eligible: number; newlyDirty: number }> = {
    shoe: { staleParsed: 0, stalePoolReason: 0, eligible: 0, newlyDirty: 0 },
    clothing: { staleParsed: 0, stalePoolReason: 0, eligible: 0, newlyDirty: 0 },
  };
  for (const row of staleParsed) byCategory[row.category].staleParsed += 1;
  for (const row of stalePoolRows) {
    const category = row.category ?? "unknown";
    if (byCategory[category]) byCategory[category].stalePoolReason += 1;
  }
  const parsedCategoryByPid = new Map(parsedRows.map((row) => [Number(row.pid), row.category]));
  for (const pid of eligiblePids) {
    const category = parsedCategoryByPid.get(pid);
    if (category) byCategory[category].eligible += 1;
  }
  for (const pid of newlyDirty) {
    const category = parsedCategoryByPid.get(pid);
    if (category) byCategory[category].newlyDirty += 1;
  }

  const patched = apply ? await patchScoreDirty(newlyDirty) : 0;
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    expected: EXPECTED,
    staleParsedRows: staleParsed.length,
    stalePoolReasonRows: stalePoolRows.length,
    eligiblePids: eligiblePids.length,
    alreadyDirty: alreadyDirty.length,
    newlyDirty: newlyDirty.length,
    patched,
    byCategory,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
