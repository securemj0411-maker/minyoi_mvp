import { classifyListing } from "../src/lib/pipeline";

const samples = [
  { name: "에어팟 프로2 본체 8핀", desc: "", price: 38000, expect: "parts" },
  { name: "택포) 에어팟 프로 1세대 본체 A급", desc: "", price: 45000, expect: "parts" },
  { name: "에어팟4세대 본체 노캔가능 작동잘됨", desc: "", price: 60000, expect: "parts" },
  { name: "풀박스 에어팟 프로 2 본체 라이트닝 충전", desc: "에어팟 프로 2 본체입니다 풀박스로 보유중입니다", price: 200000, expect: "normal" },
  { name: "에어팟 프로 2세대 본체 + 박스 + 구성품", desc: "구성품 모두 있음", price: 220000, expect: "normal" },
  { name: "에어팟 프로 2세대", desc: "", price: 200000, expect: "normal" },  // 본체 없음 → 정상
];
for (const s of samples) {
  const r = classifyListing(s.name, s.desc, s.price);
  const ok = r.listingType === s.expect;
  console.log(`${ok ? "✓" : "✗"} "${s.name}" → ${r.listingType} (expect ${s.expect})`);
}
