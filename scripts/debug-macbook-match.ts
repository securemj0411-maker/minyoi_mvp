import { ruleMatch, CATALOG, normalize } from "../src/lib/catalog";

const title = "맥북에어 M3 13인치 스그색상 16메모리 256GB S급 풀박스";
const desc = "거래 경기 금정역에서 진행하며 부피가 있다보니 오셔서 거래합니다 오시면 110만원 급처해요 색상:스페이스그레이 원래 8인데 16메모리 상위모델입니다 풀박스 구성품 모두 들어있어요 배터리100% 사이클 19회 거의 안써서 S급 입니다";

console.log("\n=== normalize ===");
console.log(normalize(title + " " + desc));

console.log("\n=== ruleMatch ===");
const result = ruleMatch(title, desc);
console.log("Result:", result?.id ?? "null");

// 직접 검증
const normText = normalize(title + " " + desc);
console.log("\n=== Candidate SKUs (all matches) ===");
const candidates: string[] = [];
for (const sku of CATALOG) {
  const allMust = sku.mustContain.every((group) =>
    group.some((token) => normText.includes(normalize(token)))
  );
  const noNotContain = !sku.mustNotContain?.some((token) => normText.includes(normalize(token)));
  if (allMust && noNotContain) {
    candidates.push(sku.id);
  }
}
console.log("Candidates:", candidates);

// macbook-air-m3-13-256 detail
const target = CATALOG.find((s) => s.id === "macbook-air-m3-13-256")!;
console.log("\n=== macbook-air-m3-13-256 check ===");
for (const group of target.mustContain) {
  const hit = group.some((token) => normText.includes(normalize(token)));
  console.log(`  mustContain ${JSON.stringify(group)}: ${hit ? "HIT" : "MISS"}`);
}
for (const token of target.mustNotContain ?? []) {
  const hit = normText.includes(normalize(token));
  if (hit) console.log(`  mustNotContain "${token}": HIT (REJECT)`);
}
