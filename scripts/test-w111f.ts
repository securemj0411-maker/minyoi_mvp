import { ruleMatch } from "@/lib/catalog";
const cases = [
  "아이폰 에어 자급제 256 아이폰17 에어",
  "급처s급) 아이폰에어 512기가 아이폰17 에어",
  "거진새거)아이폰에어 256골드 아이폰17에어",
  "박스만개봉)미사용 아이폰17 에어 256",
  "SS급)갤럭시 Z플립7 쉐도우블랙 256G",
  // FP 검증
  "아이폰 16 256 자급제",  // → iphone-16-256-self
  "갤럭시 Z플립7 256GB SKT",  // → 통신사로 broad
];
for (const c of cases) {
  const r = ruleMatch(c);
  console.log(`"${c}" → ${r?.id ?? "null"} ${r?.laneKey ? `(${r.laneKey})` : ""}`);
}
