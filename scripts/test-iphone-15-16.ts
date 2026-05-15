import { ruleMatch } from "@/lib/catalog";
const cases = [
  { name: "아이폰 15 256기가 자급제", desc: "" },
  { name: "아이폰 15 256gb 블랙", desc: "자급제 공기계 정상해지" },
  { name: "아이폰 16 256gb", desc: "자급제 풀박스" },
  { name: "아이폰 16 256gb 프로", desc: "" },  // Pro 차단
  { name: "아이폰 16e 256 자급제", desc: "" },  // 16e 차단
  { name: "아이폰 15 256기가 SKT", desc: "" },  // 통신사 차단
];
for (const c of cases) {
  const r = ruleMatch(c.name, c.desc);
  console.log(`${c.name} | ${c.desc.slice(0,25)} → ${r?.id ?? "null"} ${r?.laneKey ? `(${r.laneKey})` : ""}`);
}
