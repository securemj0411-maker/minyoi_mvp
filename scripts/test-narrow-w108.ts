import { ruleMatch } from "@/lib/catalog";

const samples = [
  { name: "아이폰 15 프로맥스 256기가 자급제 판매", desc: "" },
  { name: "아이폰 15 프로맥스 256GB 블랙", desc: "자급제 공기계 정상해지" },
  { name: "아이폰 16 프로맥스 256gb", desc: "자급제 모델 박스풀구성" },
  { name: "아이폰 16 프로맥스 256기가 SKT", desc: "" },
  { name: "아이폰 16 프로맥스", desc: "" },
  { name: "갤럭시 s23 울트라 256기가 자급제", desc: "" },
  { name: "갤럭시 s23 울트라 256gb", desc: "공기계 정상해지" },
  { name: "갤럭시 s24 울트라 256기가", desc: "자급제 풀박스 신품" },
  { name: "갤럭시 s25 울트라 256gb 블루", desc: "자급제 단말기" },
  { name: "아이폰 14 프로 128 자급제", desc: "" },
];
for (const s of samples) {
  const r = ruleMatch(s.name, s.desc);
  console.log(`${s.name} | ${s.desc.slice(0,30)} → ${r?.id ?? "null"} ${r?.laneKey ? `(${r.laneKey})` : ""}`);
}
