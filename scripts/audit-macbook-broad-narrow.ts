// Wave 113 audit: macbook-air broad 매물 중 narrow lane 가능 매물 검증
import { ruleMatch, CATALOG, normalize } from "../src/lib/catalog";

const samples = [
  { pid: 407231664, name: "[단순개봉] 맥북에어13 M4 램16GB SSD 256GB" },
  { pid: 407576574, name: "맥북 에어13 M3 실버 256GB sss급" },
  { pid: 407894963, name: "맥북에어13 m3 16 256" },
  { pid: 398227561, name: "맥북 에어13 m3" },
  { pid: 404595140, name: "맥북에어13 M3 미개봉" },
];

for (const s of samples) {
  const r = ruleMatch(s.name, "");
  console.log(`\npid=${s.pid} → ${r?.id ?? "null"}`);
  console.log(`  name: ${s.name}`);
  
  const normText = normalize(s.name);
  console.log(`  norm: "${normText.trim()}"`);
  
  // narrow lane SKU 직접 검증
  for (const skuId of ["macbook-air-m3-13-256", "macbook-air-m2-13-256"]) {
    const sku = CATALOG.find((s) => s.id === skuId)!;
    const allMust = sku.mustContain.every((group) =>
      group.some((token) => {
        const n = normalize(token).trim();
        if (/^\d+$/.test(n)) return normText.includes(` ${n} `);
        return normText.includes(n);
      })
    );
    const hitMustNot = (sku.mustNotContain ?? []).filter((token) => {
      const n = normalize(token).trim();
      if (/^\d+$/.test(n)) return normText.includes(` ${n} `);
      return normText.includes(n);
    });
    console.log(`  ${skuId}: mustContain=${allMust ? "PASS" : "FAIL"}, mustNotHits=${JSON.stringify(hitMustNot.slice(0,5))}`);
  }
}
