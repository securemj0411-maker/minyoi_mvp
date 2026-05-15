import { ruleMatch } from "@/lib/catalog";

const samples = [
  // 기존 Wave 108 검증
  { name: "아이폰 15 프로맥스 256기가 자급제", desc: "" },
  { name: "갤럭시 s23 울트라 256기가 자급제", desc: "" },
  { name: "갤럭시 s24 울트라 256기가", desc: "자급제 풀박스" },
  
  // 신규 Galaxy S 일반 256 self
  { name: "갤럭시 s23 256기가 자급제", desc: "" },
  { name: "갤럭시 s23 256gb 블랙", desc: "공기계 자급제" },
  { name: "갤럭시 s24 256기가 자급제", desc: "" },
  { name: "갤럭시 s25 256gb 자급제 신품", desc: "" },
  
  // FP 검증: Ultra/Plus는 일반 narrow에 안 빠져야
  { name: "갤럭시 s23 울트라 256gb", desc: "자급제" },  // Ultra narrow 가야
  { name: "갤럭시 s24 플러스 256gb", desc: "자급제" },  // Plus는 broad
  { name: "갤럭시 s25 256기가 SKT", desc: "" },  // 통신사 → broad
];
for (const s of samples) {
  const r = ruleMatch(s.name, s.desc);
  console.log(`${s.name} | ${s.desc.slice(0,25)} → ${r?.id ?? "null"} ${r?.laneKey ? `(${r.laneKey})` : ""}`);
}
