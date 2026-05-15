import { readFile } from "node:fs/promises";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";

async function main() {
  const samples = JSON.parse(
    await readFile("category-intelligence/macbook_air_m3_13_256/parse_ready_sample.json", "utf-8"),
  );
  const rows = Array.isArray(samples) ? samples : (samples as { samples?: unknown[] }).samples ?? [];

  let total = 0;
  let narrow = 0;
  let unknownCount = 0;
  const unknownTypes: Record<string, number> = {};
  const failSamples: { name: string; desc: string; key: string; unknowns: string[] }[] = [];

  for (const row of rows as Array<{ name?: string; description?: string }>) {
    total += 1;
    const name = row.name ?? "";
    const desc = row.description ?? "";
    const sku = ruleMatch(name, desc);
    if (sku?.laneKey !== "macbook_air_m3_13_256") continue;
    narrow += 1;
    const parsed = parseListingOptions({ title: name, description: desc, skuId: sku.id, skuName: sku.modelName, category: sku.category });
    const key = parsed.comparableKey ?? "";
    const unknowns = key.split("|").filter(p => p.startsWith("unknown_"));
    if (unknowns.length > 0) {
      unknownCount += 1;
      for (const u of unknowns) unknownTypes[u] = (unknownTypes[u] ?? 0) + 1;
      if (failSamples.length < 10) failSamples.push({ name, desc: desc.slice(0, 100), key, unknowns });
    }
  }

  console.log(`Total: ${total}, narrow matched: ${narrow}, with unknown: ${unknownCount}`);
  console.log(`Unknown types:`);
  for (const [u, c] of Object.entries(unknownTypes).sort((a, b) => b[1] - a[1])) console.log(`  ${c}: ${u}`);
  console.log(`\nFail samples:`);
  for (const s of failSamples) console.log(`  [${s.unknowns.join(",")}] ${s.name} | ${s.desc}\n    key: ${s.key}`);
}
main().catch(e => { console.error(e); process.exit(1); });
