// Wave 111: iphone_15_pro_128gb_self lane match 49% 분석.

import { readFile } from "node:fs/promises";
import { ruleMatch } from "@/lib/catalog";

async function main() {
  const samples = JSON.parse(
    await readFile("category-intelligence/iphone_15_pro_128gb_self/parse_ready_sample.json", "utf-8"),
  );
  const rows = Array.isArray(samples) ? samples : (samples as { samples?: unknown[] }).samples ?? [];

  let total = 0;
  let narrow = 0;
  let broad = 0;
  let nullCount = 0;
  const broadIds: Record<string, number> = {};
  const failSamples: { name: string; desc: string; result: string }[] = [];

  for (const row of rows as Array<{ name?: string; description?: string }>) {
    const name = row.name ?? "";
    const desc = row.description ?? "";
    const r = ruleMatch(name, desc);
    total += 1;
    if (r?.laneKey === "iphone_15_pro_128gb_self") {
      narrow += 1;
    } else if (r) {
      broad += 1;
      broadIds[r.id] = (broadIds[r.id] ?? 0) + 1;
      if (failSamples.length < 10) failSamples.push({ name, desc: desc.slice(0, 120), result: r.id });
    } else {
      nullCount += 1;
      if (failSamples.length < 15) failSamples.push({ name, desc: desc.slice(0, 120), result: "null" });
    }
  }

  console.log(`Total: ${total}`);
  console.log(`Narrow match: ${narrow} (${(narrow/total*100).toFixed(1)}%)`);
  console.log(`Broad/wrong: ${broad}`);
  console.log(`Null: ${nullCount}`);
  console.log(`\nBroad/wrong IDs:`);
  for (const [id, c] of Object.entries(broadIds).sort((a, b) => b[1] - a[1])) console.log(`  ${c}: ${id}`);
  console.log(`\nFail samples (15):`);
  for (const s of failSamples) console.log(`  → ${s.result}\n     name: ${s.name}\n     desc: ${s.desc}`);
}
main().catch(e => { console.error(e); process.exit(1); });
