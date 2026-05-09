// catalog_v1.py를 TypeScript로 포팅.
// 카탈로그 SKU 19개 + generated mining catalog + normalize + ruleMatch.

import { GENERATED_CATALOG } from "@/lib/generated/catalog";

export type Sku = {
  id: string;
  brand: string;
  category: "earphone" | "smartwatch" | "smartphone" | "tablet" | "laptop" | "small_appliance";
  modelName: string;
  aliases: string[];
  mustContain: string[][];
  mustNotContain: string[];
  msrpKrw: number;
  released: number;
};

export const CATALOG: Sku[] = [
  // ─── AirPods ─────────────────────────────────────────
  {
    id: "airpods-2",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 2nd gen",
    aliases: ["에어팟 2세대", "AirPods 2", "에어팟2"],
    mustContain: [["에어팟", "airpods"], ["2세대", "2 세대", "2nd"]],
    mustNotContain: ["프로", "pro", "max", "맥스", "3세대", "4세대"],
    msrpKrw: 199000,
    released: 2019,
  },
  {
    id: "airpods-3",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 3rd gen",
    aliases: ["에어팟 3세대", "AirPods 3", "에어팟3"],
    mustContain: [["에어팟", "airpods"], ["3세대", "3 세대", "3rd"]],
    mustNotContain: ["프로", "pro", "max", "맥스", "2세대", "4세대"],
    msrpKrw: 269000,
    released: 2021,
  },
  {
    id: "airpods-4",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 4th gen",
    aliases: ["에어팟 4세대", "AirPods 4", "에어팟4"],
    mustContain: [["에어팟", "airpods"], ["4세대", "4 세대", "4th"]],
    mustNotContain: ["프로", "pro", "max", "맥스", "2세대", "3세대"],
    msrpKrw: 199000,
    released: 2024,
  },
  {
    id: "airpods-pro-1",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods Pro 1st gen",
    aliases: ["에어팟 프로 1세대", "AirPods Pro 1"],
    mustContain: [["에어팟", "airpods"], ["프로", "pro"], ["1세대", "1 세대", "1st"]],
    mustNotContain: ["2세대", "2nd", "max", "맥스", "usb-c", "usbc", "c타입", "타입c"],
    msrpKrw: 329000,
    released: 2019,
  },
  {
    id: "airpods-pro-2-lightning",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods Pro 2nd gen (Lightning)",
    aliases: ["에어팟 프로 2세대 라이트닝", "AirPods Pro 2 Lightning"],
    mustContain: [
      ["에어팟", "airpods"],
      ["프로", "pro"],
      ["2세대", "2 세대", "2nd", " 2 ", "프로 2", "프로2"],
    ],
    mustNotContain: ["max", "맥스", "usb-c", "usbc", "c타입", "타입c", "씨타입", "타입씨"],
    msrpKrw: 359000,
    released: 2022,
  },
  {
    id: "airpods-pro-2-usbc",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods Pro 2nd gen (USB-C)",
    aliases: ["에어팟 프로 2세대 USB-C", "AirPods Pro 2 USB-C"],
    mustContain: [
      ["에어팟", "airpods"],
      ["프로", "pro"],
      ["2세대", "2 세대", "2nd", "프로 2", "프로2"],
      ["usb-c", "usbc", "c타입", "타입c", "씨타입", "타입씨"],
    ],
    mustNotContain: ["라이트닝", "lightning", "max", "맥스"],
    msrpKrw: 359000,
    released: 2023,
  },
  {
    id: "airpods-max",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods Max",
    aliases: ["에어팟 맥스", "AirPods Max", "에어팟맥스"],
    mustContain: [["에어팟", "airpods"], ["맥스", "max"]],
    mustNotContain: [],
    msrpKrw: 769000,
    released: 2020,
  },

  // ─── Apple Watch ─────────────────────────────────────
  {
    id: "applewatch-se1",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch SE 1st gen",
    aliases: ["애플워치 SE 1세대", "Apple Watch SE 1st gen"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["se"], ["1세대", "1 세대", "1st"]],
    mustNotContain: ["se2", "se 2", "se3", "se 3", "ultra", "series", "시리즈"],
    msrpKrw: 359000,
    released: 2020,
  },
  {
    id: "applewatch-se2",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch SE 2nd gen",
    aliases: ["애플워치 SE 2세대", "애플워치 SE2", "Apple Watch SE 2"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["se2", "se 2", "se 2세대", "se 2nd"]],
    mustNotContain: ["se3", "se 3", "ultra"],
    msrpKrw: 359000,
    released: 2022,
  },
  {
    id: "applewatch-se3",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch SE 3rd gen",
    aliases: ["애플워치 SE3", "애플워치 SE 3세대", "Apple Watch SE 3"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["se3", "se 3", "se 3세대", "se 3rd"]],
    mustNotContain: ["se2", "se 2", "ultra"],
    msrpKrw: 359000,
    released: 2025,
  },
  {
    id: "applewatch-series7",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 7",
    aliases: ["애플워치 7", "애플워치 시리즈 7", "Apple Watch Series 7"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 7", "series 7", " 7 ", "s7", "워치7", "워치 7"],
    ],
    mustNotContain: ["se", "ultra", "시리즈 8", "시리즈 9", "시리즈 10", "series 8", "series 9", "series 10"],
    msrpKrw: 539000,
    released: 2021,
  },
  {
    id: "applewatch-series8",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 8",
    aliases: ["애플워치 8", "애플워치 시리즈 8", "Apple Watch Series 8"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 8", "series 8", " 8 ", "s8", "워치8", "워치 8"],
    ],
    mustNotContain: ["se", "ultra", "시리즈 7", "시리즈 9", "시리즈 10", "series 7", "series 9", "series 10"],
    msrpKrw: 599000,
    released: 2022,
  },
  {
    id: "applewatch-series9",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 9",
    aliases: ["애플워치 9", "애플워치 시리즈 9", "Apple Watch Series 9"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 9", "series 9", " 9 ", "s9", "워치9", "워치 9"],
    ],
    mustNotContain: ["se", "ultra", "시리즈 7", "시리즈 8", "시리즈 10", "series 7", "series 8", "series 10"],
    msrpKrw: 599000,
    released: 2023,
  },
  {
    id: "applewatch-series10",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 10",
    aliases: ["애플워치 10", "애플워치 시리즈 10", "Apple Watch Series 10"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 10", "series 10", " 10 ", "s10", "워치10", "워치 10"],
    ],
    mustNotContain: ["se", "ultra", "시리즈 7", "시리즈 8", "시리즈 9", "series 7", "series 8", "series 9"],
    msrpKrw: 599000,
    released: 2024,
  },
  {
    id: "applewatch-ultra",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Ultra",
    aliases: ["애플워치 울트라", "Apple Watch Ultra"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["울트라", "ultra"]],
    mustNotContain: ["울트라 2", "ultra 2"],
    msrpKrw: 1149000,
    released: 2022,
  },
  {
    id: "applewatch-ultra2",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Ultra 2",
    aliases: ["애플워치 울트라 2", "Apple Watch Ultra 2"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["울트라 2", "ultra 2"]],
    mustNotContain: [],
    msrpKrw: 1149000,
    released: 2023,
  },

  // ─── Galaxy Watch ─────────────────────────────────────
  {
    id: "galaxywatch-6",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch 6",
    aliases: ["갤럭시 워치 6", "갤워치 6", "Galaxy Watch 6"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      [" 6 ", "워치6", "워치 6"],
    ],
    mustNotContain: [" 7 ", "워치7", "ultra"],
    msrpKrw: 369000,
    released: 2023,
  },
  {
    id: "galaxywatch-7",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch 7",
    aliases: ["갤럭시 워치 7", "갤워치 7", "Galaxy Watch 7"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      [" 7 ", "워치7", "워치 7"],
    ],
    mustNotContain: [" 6 ", "워치6", "ultra"],
    msrpKrw: 339000,
    released: 2024,
  },
  {
    id: "galaxywatch-ultra",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch Ultra",
    aliases: ["갤럭시 워치 울트라", "Galaxy Watch Ultra"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      ["울트라", "ultra"],
    ],
    mustNotContain: [],
    msrpKrw: 829000,
    released: 2024,
  },
  ...GENERATED_CATALOG,
];

const SKU_MAP = new Map(CATALOG.map((s) => [s.id, s]));
export function skuById(id: string): Sku | undefined {
  return SKU_MAP.get(id);
}

const NORMALIZATIONS: [RegExp, string][] = [
  [/usb[\s\-_]*c/gi, " usbc "],
  [/c[\s\-_]*type/gi, " usbc "],
  [/c\s*타입|타입\s*c|씨\s*타입|타입\s*씨/gi, " usbc "],
  [/1\s*세대|일\s*세대|first|1st/gi, " 1세대 "],
  [/2\s*세대|이\s*세대|second|2nd/gi, " 2세대 "],
  [/3\s*세대|삼\s*세대|third|3rd/gi, " 3세대 "],
  [/4\s*세대|사\s*세대|fourth|4th/gi, " 4세대 "],
  [/프로\s*2/gi, " 프로 프로2 2세대 "],
  [/프로\s*1/gi, " 프로 프로1 1세대 "],
  [/\bpro\s*2\b/gi, " pro pro2 2세대 "],
  [/\bpro\s*1\b/gi, " pro pro1 1세대 "],
  [/에어팟\s*([234])/g, " 에어팟 $1세대 "],
  [/에어팟프로\s*([123])/g, " 에어팟 프로$1 "],
  [/애어팟/g, " 에어팟 "],
  [/울트라\s*2/gi, " 울트라 2 "],
  [/ultra\s*2/gi, " ultra 2 "],
  [/se\s*([123])/gi, " se$1 "],
  [/시리즈\s*([0-9]+)/g, " 시리즈 $1 "],
  [/series\s*([0-9]+)/gi, " series $1 "],
  [/애플\s*워치/g, " 애플워치 "],
  [/갤럭시\s*워치/g, " 갤럭시워치 "],
  [/air\s*pods/gi, " airpods "],
];

export function normalize(text: string): string {
  let t = (text ?? "").toLowerCase();
  for (const [pat, repl] of NORMALIZATIONS) {
    t = t.replace(pat, repl);
  }
  t = t.replace(/[^0-9a-z가-힣]+/g, " ").replace(/\s+/g, " ").trim();
  return ` ${t} `;
}

function tokenHit(normalizedText: string, token: string): boolean {
  const n = normalize(token).trim();
  if (!n) return false;
  if (/^\d+$/.test(n)) return normalizedText.includes(` ${n} `);
  return normalizedText.includes(n);
}

function skuMatches(sku: Sku, normalizedText: string): boolean {
  for (const group of sku.mustContain) {
    if (!group.some((token) => tokenHit(normalizedText, token))) return false;
  }
  for (const token of sku.mustNotContain) {
    if (tokenHit(normalizedText, token)) return false;
  }
  return true;
}

export function ruleMatch(title: string, description = ""): Sku | null {
  const titleNorm = normalize(title);
  const titleCandidates = CATALOG.filter((s) => skuMatches(s, titleNorm));
  if (titleCandidates.length === 1) return titleCandidates[0];
  if (titleCandidates.length > 1) return null;

  const combined = normalize(`${title} ${description.slice(0, 200)}`);
  const descCandidates = CATALOG.filter((s) => skuMatches(s, combined));
  if (descCandidates.length === 1) return descCandidates[0];
  return null;
}
