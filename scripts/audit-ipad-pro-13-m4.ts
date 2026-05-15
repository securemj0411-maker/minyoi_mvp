import { readFile } from "node:fs/promises";
import { ruleMatch } from "@/lib/catalog";

async function main() {
  const samples = JSON.parse(await readFile("category-intelligence/ipad_pro_13_m4_256_wifi/parse_ready_sample.json", "utf-8"));
  const rows = Array.isArray(samples) ? samples : (samples as { samples?: unknown[] }).samples ?? [];
  let total = 0, narrow = 0, broad = 0, nullCount = 0;
  const broadIds: Record<string, number> = {};
  const failSamples: { name: string; desc: string; result: string }[] = [];
  for (const row of rows as Array<{ name?: string; description?: string }>) {
    total += 1;
    const name = row.name ?? "";
    const desc = row.description ?? "";
    const r = ruleMatch(name, desc);
    if (r?.laneKey === "ipad_pro_13_m4_256_wifi") narrow += 1;
    else if (r) { broad += 1; broadIds[r.id] = (broadIds[r.id] ?? 0) + 1; if (failSamples.length < 10) failSamples.push({ name, desc: desc.slice(0,100), result: r.id }); }
    else { nullCount += 1; if (failSamples.length < 15) failSamples.push({ name, desc: desc.slice(0,100), result: "null" }); }
  }
  console.log(`Total: ${total}, narrow: ${narrow} (${(narrow/total*100).toFixed(1)}%), broad: ${broad}, null: ${nullCount}`);
  console.log(`Broad IDs:`); for (const [id, c] of Object.entries(broadIds).sort((a,b)=>b[1]-a[1])) console.log(`  ${c}: ${id}`);
  console.log(`Fail samples:`);
  for (const s of failSamples) console.log(`  → ${s.result}: ${s.name} | ${s.desc.slice(0,80)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
