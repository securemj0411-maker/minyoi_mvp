import { parseListingOptions } from "@/lib/option-parser";

const samples: Array<{ name: string; title: string; desc: string }> = [
  { name: "no-storage", title: "아이폰15프로맥스 화이트", desc: "자급제" },
  { name: "1T-with-space", title: "아이폰15프로맥스 1T 화이트티타늄 SS급! 풀박스", desc: "" },
  { name: "1테라-glued-title", title: "아이폰15프로맥스1테라 정품 자급제 판매합니다", desc: "" },
  { name: "1테라-glued-and-suffix", title: "아이폰15프로맥스1테라유튜버하실분풀구성드립니다내츄럴티", desc: "" },
  { name: "1테라-with-space", title: "[미사용급/애플케어/자급제] 아이폰16프로맥스 1테라", desc: "화이트 1테라" },
  { name: "1테라-desc-only", title: "아이폰15프로맥스 블루 티타늄 1테라 S급입니다", desc: "" },
  { name: "256-bare", title: "아이폰16 프로 256", desc: "256기가입니다" },
  { name: "1tb-suffix", title: "아이폰15프로맥스1tb", desc: "" },
  { name: "256g-suffix", title: "아이폰16프로 256g", desc: "" },
  { name: "256기가-bare-iphone14", title: "아이폰 14 256기가", desc: "" },
  { name: "126gb-typo", title: "아이폰 16e 126gb 풀박스", desc: "" },
  { name: "1테라-no-space-glued-and-suffix-suffix", title: "아이폰15프로맥스1테라티타늄컬러", desc: "" },
  // Exact production reproduction — pid 407837718 saw unknown_storage despite seeming-explicit title.
  {
    name: "prod-407837718-iphone14-256기가",
    title: "아이폰 14 256기가",
    desc: "아이폰 14 앞면은 깨끗해요\n뒷면깨졌지만 사용 하는데는 문제 없어용!",
  },
];

for (const s of samples) {
  const skuId = /14/.test(s.name) ? "iphone-14" : "iphone-15-pro-max";
  const skuName = /14/.test(s.name) ? "iPhone 14" : "iPhone 15 Pro Max";
  const r = parseListingOptions({
    title: s.title,
    description: s.desc,
    category: "smartphone",
    skuId,
    skuName,
  });
  console.log(`[${s.name}] storageGb=${r.storageGb}  key=${r.comparableKey}`);
}
