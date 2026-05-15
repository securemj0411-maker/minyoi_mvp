import { readFile } from "node:fs/promises";
import { ruleMatch } from "@/lib/catalog";
async function main() {
  const samples = JSON.parse(await readFile("category-intelligence/ipad_pro_11_m4_256_wifi/parse_ready_sample.json", "utf-8"));
  const rows = Array.isArray(samples) ? samples : (samples as { samples?: unknown[] }).samples ?? [];
  const wrongs: {n:string, d:string}[] = [];
  for (const row of rows as Array<{name?:string;description?:string}>) {
    const r = ruleMatch(row.name??"", row.description??"");
    if (r?.laneKey === "ipad_pro_13_m4_256_wifi") {
      wrongs.push({n: row.name??"", d: (row.description??"").slice(0,80)});
    }
  }
  console.log(`Wrong (11 sample → 13 lane): ${wrongs.length}`);
  for (const w of wrongs.slice(0, 20)) console.log(`  → ${w.n} | ${w.d}`);
}
main().catch(e=>{console.error(e);process.exit(1);});
