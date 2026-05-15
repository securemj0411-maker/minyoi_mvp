import { ruleMatch, CATALOG, normalize } from "../src/lib/catalog";
import { classifyListing } from "../src/lib/pipeline";

const samples = [
  { name: "갤럭시S23fe S급 256g 서울s23fe 부산s23fe 강원s23fe", desc: "", price: 308000 },
  { name: "갤럭시S23FE민트(8482)", desc: "", price: 299000 },
  { name: "삼성 갤럭시 S26 울트라 256GB", desc: "", price: 1150000 },
  { name: "갤럭시노트20 256기가 블랙 *게임네비배달대행용~/#937963", desc: "", price: 125000 },
  { name: "갤럭시 S21 5G 256기가", desc: "", price: 250000 },
];

for (const s of samples) {
  const cl = classifyListing(s.name, s.desc, s.price);
  const rm = ruleMatch(s.name, s.desc);
  console.log(`\n"${s.name}"`);
  console.log(`  classifyListing → ${cl.listingType} sku=${cl.sku?.id ?? "null"}`);
  console.log(`  ruleMatch direct → ${rm?.id ?? "null"}`);
  console.log(`  norm: "${normalize(s.name).trim()}"`);
}
