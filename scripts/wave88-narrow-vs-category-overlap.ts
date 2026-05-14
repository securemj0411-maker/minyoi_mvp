// Wave 88 follow-up: narrow query vs category sweep 카니발리즘 측정.
// 지난 N일 raw_listings에서 query별로:
//   - 해당 query만 잡은 pid (unique)
//   - 다른 query도 잡은 pid (overlap)
//   - SKU 매칭율
// → category sweep이 narrow query의 95%+ 흡수하면 그 narrow는 deprecate 후보.
//
// 사용: npx tsx scripts/wave88-narrow-vs-category-overlap.ts [--days=7]

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const days = (() => {
  const arg = process.argv.find((a) => a.startsWith("--days="));
  return arg ? Math.max(1, Math.min(30, Number(arg.slice("--days=".length)))) : 7;
})();

type RawRow = { pid: number; query: string; sku_id: string | null };

async function loadRaw(cutoffIso: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  const PAGE = 1000;
  const HARD_CAP = 500_000;
  for (let offset = 0; offset < HARD_CAP; offset += PAGE) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,query,sku_id&first_seen_at=gte.${encodeURIComponent(cutoffIso)}&order=first_seen_at.desc&offset=${offset}&limit=${PAGE}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const chunk = (await res.json()) as RawRow[];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const cutoffMs = Date.now() - days * 24 * 60 * 60_000;
  const cutoffIso = new Date(cutoffMs).toISOString();
  console.log(`Wave 88 카니발리즘 측정 (지난 ${days}일, first_seen_at >= ${cutoffIso})`);

  const rows = await loadRaw(cutoffIso);
  console.log(`raw_listings rows fetched: ${rows.length}`);

  // pid → Set<query>
  const pidQueries = new Map<number, Set<string>>();
  // query → { uniqueOnly: Set<pid>, withOthers: Set<pid>, skuMatched: Set<pid> }
  const queryStats = new Map<string, { all: Set<number>; sku: Set<number> }>();

  for (const row of rows) {
    if (!row.query) continue;
    const q = row.query;
    let set = pidQueries.get(row.pid);
    if (!set) {
      set = new Set();
      pidQueries.set(row.pid, set);
    }
    set.add(q);
    let stat = queryStats.get(q);
    if (!stat) {
      stat = { all: new Set(), sku: new Set() };
      queryStats.set(q, stat);
    }
    stat.all.add(row.pid);
    if (row.sku_id) stat.sku.add(row.pid);
  }

  // 각 query별로 categoryOverlap = 같은 pid가 category: prefix query에도 등장하는 비율
  const result: Array<{
    query: string;
    totalPids: number;
    skuMatchedPids: number;
    overlapWithCategory: number;
    overlapPct: number;
    uniqueToThisQuery: number;
    uniquePct: number;
    recommendation: string;
  }> = [];

  for (const [query, stat] of queryStats) {
    if (query.startsWith("category:")) continue; // narrow query만 분석 대상
    let overlap = 0;
    let unique = 0;
    for (const pid of stat.all) {
      const allQueries = pidQueries.get(pid);
      if (!allQueries) continue;
      const hasCategory = Array.from(allQueries).some((q) => q.startsWith("category:"));
      if (hasCategory) overlap += 1;
      if (allQueries.size === 1) unique += 1;
    }
    const overlapPct = stat.all.size > 0 ? Math.round((overlap / stat.all.size) * 1000) / 10 : 0;
    const uniquePct = stat.all.size > 0 ? Math.round((unique / stat.all.size) * 1000) / 10 : 0;
    let rec = "keep";
    if (overlapPct >= 95) rec = "deprecate_candidate";
    else if (overlapPct >= 80 && stat.sku.size < 5) rec = "downrank_candidate";
    else if (stat.all.size < 5) rec = "low_volume_check";
    result.push({
      query,
      totalPids: stat.all.size,
      skuMatchedPids: stat.sku.size,
      overlapWithCategory: overlap,
      overlapPct,
      uniqueToThisQuery: unique,
      uniquePct,
      recommendation: rec,
    });
  }

  result.sort((a, b) => b.overlapPct - a.overlapPct);

  console.log("\n=== 카테고리 sweep과 overlap 높은 narrow query (deprecate 후보) ===");
  const deprecates = result.filter((r) => r.recommendation === "deprecate_candidate");
  for (const r of deprecates.slice(0, 30)) {
    console.log(`  ${r.query.padEnd(30)} 총=${String(r.totalPids).padStart(4)} 매칭=${String(r.skuMatchedPids).padStart(3)} cat-overlap=${r.overlapPct}%`);
  }
  console.log(`\n→ ${deprecates.length}개 deprecate 후보 (overlap ≥95%)`);

  console.log("\n=== Unique-to-narrow (sweep에 안 들어오는 narrow) ===");
  const uniques = result.filter((r) => r.uniquePct >= 50 && r.totalPids >= 5).sort((a, b) => b.totalPids - a.totalPids);
  for (const r of uniques.slice(0, 20)) {
    console.log(`  ${r.query.padEnd(30)} 총=${String(r.totalPids).padStart(4)} unique=${r.uniquePct}% 매칭=${r.skuMatchedPids}`);
  }

  await writeFile(
    path.join(appDir, "reports/wave88-narrow-vs-category-overlap-latest.json"),
    JSON.stringify({ wave: 88, days, measured_at: new Date().toISOString(), total_rows: rows.length, results: result }, null, 2),
  );
  console.log("\n→ reports/wave88-narrow-vs-category-overlap-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
