import { CATALOG, normalize, ruleMatch } from "@/lib/catalog";
import type { Sku } from "@/lib/catalog";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenHit(normalizedText: string, token: string): boolean {
  const n = normalize(token).trim();
  if (!n) return false;
  return new RegExp(`(?:^|[^0-9a-z가-힣])${escapeRe(n)}(?:[^0-9a-z가-힣]|$)`).test(normalizedText);
}

function findBlock(sku: Sku, normalizedText: string): string | null {
  for (let i = 0; i < sku.mustContain.length; i += 1) {
    const row = sku.mustContain[i];
    const someHit = row.some((t) => tokenHit(normalizedText, t));
    if (!someHit) return `mustContain row ${i} (${row.join("|")}) miss`;
  }
  for (const t of sku.mustNotContain) {
    if (tokenHit(normalizedText, t)) return `mustNotContain hit: ${t}`;
  }
  return null;
}

const tests = [
  "닌텐도 스위치 마리오카트8 디럭스 칩",
  "닌텐도 스위치 마리오카트8 디럭스",
  "마리오카트 8 디럭스",
];

const targetIds = ["switch-game-mario-kart-8", "switch2-game-mario-kart-world"];

for (const title of tests) {
  const norm = normalize(title);
  console.log(`\n=== '${title}' (norm: '${norm}') ===`);
  for (const sku of CATALOG.filter((s) => targetIds.includes(s.id))) {
    const block = findBlock(sku, norm);
    if (block) console.log(`  ${sku.id}: BLOCKED — ${block}`);
    else console.log(`  ${sku.id}: MATCH (mustContain=${sku.mustContain.length} rows, mustNotContain=${sku.mustNotContain.length})`);
  }
  console.log(`  ruleMatch → ${ruleMatch(title, "")?.id ?? "NULL"}`);
}
