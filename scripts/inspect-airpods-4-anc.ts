import { CATALOG, normalize } from "@/lib/catalog";
import { readFileSync } from "node:fs";

function tokenHit(n: string, t: string): boolean {
  const x = normalize(t).trim();
  if (!x) return false;
  if (/^\d+$/.test(x)) return n.includes(` ${x} `);
  return n.includes(x);
}
function skuMatches(sku: any, n: string): boolean {
  for (const g of sku.mustContain) if (!g.some((t: string) => tokenHit(n, t))) return false;
  for (const t of sku.mustNotContain) if (tokenHit(n, t)) return false;
  return true;
}

const samples = JSON.parse(readFileSync("category-intelligence/airpods_4_anc/samples.json", "utf-8"));
const ready = samples.filter((s: any) => s.parse_ready === true);

const counts: Record<string, number> = {};
let multi = 0;

for (const s of ready) {
  const n = normalize(s.name);
  const cands = CATALOG.filter((sku) => skuMatches(sku, n));
  if (cands.length === 0) counts["NONE"] = (counts["NONE"] ?? 0) + 1;
  else if (cands.length === 1) counts[cands[0].id] = (counts[cands[0].id] ?? 0) + 1;
  else {
    multi++;
    const key = `MULTI:[${cands.map(c => c.id).join(",")}]`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
}
console.log(`Total parse_ready=${ready.length}, multi-match=${multi}`);
for (const [k, v] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${v.toString().padStart(3)}  ${k}`);
}
