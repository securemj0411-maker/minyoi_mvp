import { ruleMatch, normalize } from "@/lib/catalog";
const cases = [
  "S23울트라 256G 크림",
  "S23울트라 256G 특SSS급",
  "갤럭시S24울트라 티타늄옐로우 256기가 판매합니다-S928N",
  "S24 512GB 그레이",
  "플립5 특S급 라벤더",
  "플립5 512GB 그라파이트",
  "S25 ultra 256",
];
for (const c of cases) {
  const n = normalize(c);
  const r = ruleMatch(c, "");
  console.log(`"${c}" → normalize="${n.trim()}" → ${r?.id ?? "null"}`);
}
