import { readFile } from "node:fs/promises";
import { ruleMatch } from "@/lib/catalog";

async function main() {
  const samples = JSON.parse(await readFile("category-intelligence/ipad_pro_13_m4_256_wifi/parse_ready_sample.json", "utf-8"));
  const rows = Array.isArray(samples) ? samples : (samples as { samples?: unknown[] }).samples ?? [];
  let total = 0, narrow = 0, broad = 0, nullCount = 0, wrongNarrow = 0;
  const broadIds: Record<string, number> = {};
  const wrongIds: Record<string, number> = {};
  for (const row of rows as Array<{ name?: string; description?: string }>) {
    total += 1;
    const name = row.name ?? "";
    const desc = row.description ?? "";
    const r = ruleMatch(name, desc);
    if (r?.laneKey === "ipad_pro_13_m4_256_wifi") narrow += 1;
    else if (r?.laneKey) { wrongNarrow += 1; wrongIds[r.id] = (wrongIds[r.id] ?? 0) + 1; }
    else if (r) { broad += 1; broadIds[r.id] = (broadIds[r.id] ?? 0) + 1; }
    else nullCount += 1;
  }
  console.log(`Total: ${total}, target narrow: ${narrow} (${(narrow/total*100).toFixed(1)}%), wrong narrow: ${wrongNarrow}, broad: ${broad}, null: ${nullCount}`);
  console.log(`Wrong narrow IDs:`); for (const [id, c] of Object.entries(wrongIds).sort((a,b)=>b[1]-a[1])) console.log(`  ${c}: ${id}`);
  console.log(`Broad IDs:`); for (const [id, c] of Object.entries(broadIds).sort((a,b)=>b[1]-a[1])) console.log(`  ${c}: ${id}`);
}
main().catch(e => { console.error(e); process.exit(1); });
