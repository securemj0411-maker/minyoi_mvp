import { CATALOG, ruleMatch } from "@/lib/catalog";

const title = "아이패드 프로 12.9인치 M1 128GB Wi-Fi";
const desc = "2021. 5세대. 정상.";

console.log("FINAL ruleMatch:", ruleMatch(title, desc)?.id);

const text = (title + " " + desc).toLowerCase();
const matched: Array<{id: string, laneKey?: string, category: string}> = [];
for (const sku of CATALOG) {
  const mustOk = sku.mustContain.every((group) => group.some((token) => text.includes(token.toLowerCase())));
  const blocked = (sku.mustNotContain ?? []).some((token) => text.includes(token.toLowerCase()));
  if (mustOk && !blocked) matched.push({id: sku.id, laneKey: sku.laneKey, category: sku.category});
}
console.log("\nAll matching SKUs:");
for (const m of matched) console.log(`  ${m.id}  category=${m.category}  laneKey=${m.laneKey ?? "—"}`);

// Title-only matching
const titleLower = title.toLowerCase();
const titleMatched: string[] = [];
for (const sku of CATALOG) {
  const mustOk = sku.mustContain.every((group) => group.some((token) => titleLower.includes(token.toLowerCase())));
  const blocked = (sku.mustNotContain ?? []).some((token) => titleLower.includes(token.toLowerCase()));
  if (mustOk && !blocked) titleMatched.push(sku.id);
}
console.log("\nTitle-only matching SKUs:", titleMatched);
