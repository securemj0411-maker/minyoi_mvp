import { classifyListing } from "@/lib/pipeline";

const tests: [string, string, number][] = [
  ["닌텐도 스위치 마리오카트8 디럭스 칩", "", 50000],
  ["닌텐도 스위치 마리오카트8 디럭스", "", 50000],
  ["닌텐도 스위치 마리오 오디세이", "", 50000],
  ["스위치2 마리오카트월드 칩", "", 70000],
  ["모여봐요 동물의 숲", "", 46000],
  ["링피트 어드벤처", "", 40000],
];

for (const [t, d, p] of tests) {
  console.log(`'${t}' → ${classifyListing(t, d, p).listingType} / ${classifyListing(t, d, p).sku?.id || "NULL"}`);
}
