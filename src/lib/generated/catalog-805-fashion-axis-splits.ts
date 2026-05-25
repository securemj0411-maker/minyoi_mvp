import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 805 (2026-05-24): fashion axis split repair.
//
// User audit showed that brand/model broad lanes still mix price axes:
// - Arc'teryx Atom LT non-hood vs LT hoody vs SL/AR/Heavyweight
// - Arc'teryx Beta SL vs LT vs AR
// - Arc'teryx Proton LT vs FL/SV/AR
// - Stussy pullover hoodie vs zip hoodie vs crewneck/sweatshirt
// - Stussy x Nike broad shoe lane mixing Air Penny with Spiridon/AF1/etc.
//
// Policy: only accept explicit sub-line/type tokens here. Ambiguous "Atom LT"
// without hood/jacket wording should be held for AI L2 or later manual review.
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
] as const;

const ARCTERYX_COMMON_NOISE = [
  ...COMMON_NOISE,
  "veilance", "베일런스", "베일런 스",
  "leaf", "리프", "gen2", "gen 2", "gen2.1", "멀티캠", "multicam",
  "beams", "빔즈", "vitality", "바이탈리티",
] as const;

const BETA_OTHER_LINE_NOISE = [
  "베타 sv", "betasv", "beta sv", " sv ",
  "인슐레이티드", "insulated",
  "하이브리드", "hybrid",
  "팬츠", "pants",
] as const;

const STUSSY_COMMON_NOISE = [
  ...COMMON_NOISE,
  "nike", "나이키", "dior", "디올", "birkenstock", "버켄스탁",
  "키즈", "kids",
  // Wave 845: directSpecificMatch treats these as special axes; keep catalog
  // candidate matching from resurrecting them into basic crewneck/zip lanes.
  "아워레가시", "아워 레가시", "our legacy", "ourlegacy", "워크샵", "workshop",
  "cpfm", "cactus plant", "월드투어", "월드 투어", "world tour",
  "도버스트릿", "도버 스트릿", "도버 스트리트", "dover street", "dsm",
  "마틴로즈", "마틴 로즈", "martine rose", "martin rose",
  "futura", "퓨추라", "다이스", "dice", "soul 1980", "soul1980",
  "피그먼트", "pigment",
] as const;

export const WAVE_805_FASHION_AXIS_SPLITS: Sku[] = [
  {
    id: "clothing-arcteryx-atom-lt-hoody",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_atom_lt_hoody",
    modelName: "Arc'teryx Atom LT Hoody",
    aliases: ["Atom LT Hoody", "아톰 LT 후디", "아톰 LT 후드"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["atom", "아톰"],
      ["아톰 lt", "아톰lt", "atom lt", "atomlt", "lt"],
      ["후디", "후드티", "후드", "hoodie", "hoody", "hooded"],
    ],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      "논후드", "논 후드", "노후드", "노 후드", "no hood", "non hood", "nonhood", "후드 없음", "후드없",
      "아톰 sl", "아톰sl", "atom sl", "atomsl",
      "아톰 ar", "아톰ar", "atom ar", "atomar", "heavyweight", "헤비웨이트",
      "베스트", "vest", "팬츠", "pants",
    ],
    msrpKrw: 320000, released: 2010,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-atom-lt-jacket",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_atom_lt_jacket",
    modelName: "Arc'teryx Atom LT Jacket (non-hood)",
    aliases: ["Atom LT Jacket", "아톰 LT 자켓", "아톰 LT 논후드"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["atom", "아톰"],
      ["아톰 lt", "아톰lt", "atom lt", "atomlt", "lt"],
      ["논후드", "논 후드", "노후드", "노 후드", "no hood", "non hood", "nonhood", "후드 없음", "후드없", "자켓", "재킷", "jacket"],
    ],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      "후디", "hoodie", "hoody", "hooded", " 후드 ", " hood ",
      "아톰 sl", "아톰sl", "atom sl", "atomsl",
      "아톰 ar", "아톰ar", "atom ar", "atomar", "heavyweight", "헤비웨이트",
      "베스트", "vest", "팬츠", "pants",
    ],
    msrpKrw: 290000, released: 2010,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-atom-sl",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_atom_sl",
    modelName: "Arc'teryx Atom SL",
    aliases: ["Atom SL", "아톰 SL"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["atom", "아톰"],
      ["아톰 sl", "아톰sl", "atom sl", "atomsl"],
    ],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      "아톰 lt", "아톰lt", "atom lt", "atomlt",
      "아톰 ar", "아톰ar", "atom ar", "atomar", "heavyweight", "헤비웨이트",
      "베스트", "vest", "팬츠", "pants",
    ],
    msrpKrw: 250000, released: 2013,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-atom-ar-heavyweight",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_atom_ar_heavyweight",
    modelName: "Arc'teryx Atom AR / Heavyweight",
    aliases: ["Atom AR", "Atom Heavyweight", "아톰 AR", "아톰 헤비웨이트"],
    mustContain: [
      ["arcteryx", "arc'teryx", "아크테릭스"],
      ["atom", "아톰"],
      ["아톰 ar", "아톰ar", "atom ar", "atomar", "heavyweight", "헤비웨이트"],
    ],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      "아톰 lt", "아톰lt", "atom lt", "atomlt",
      "아톰 sl", "아톰sl", "atom sl", "atomsl",
      "베스트", "vest", "팬츠", "pants",
    ],
    msrpKrw: 420000, released: 2014,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-beta-lt",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_beta_lt",
    modelName: "Arc'teryx Beta LT Gore-Tex Jacket",
    aliases: ["Beta LT", "베타 LT", "베타LT"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["beta", "베타"], ["베타 lt", "베타lt", "beta lt", "betalt"]],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      ...BETA_OTHER_LINE_NOISE,
      "베타 sl", "베타sl", "beta sl", "betasl",
      "베타 ar", "베타ar", "beta ar", "betaar",
    ],
    msrpKrw: 590000, released: 2019,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-beta-sl",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_beta_sl",
    modelName: "Arc'teryx Beta SL Gore-Tex Jacket",
    aliases: ["Beta SL", "베타 SL", "베타SL"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["beta", "베타"], ["베타 sl", "베타sl", "beta sl", "betasl"]],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      ...BETA_OTHER_LINE_NOISE,
      "베타 lt", "베타lt", "beta lt", "betalt",
      "베타 ar", "베타ar", "beta ar", "betaar",
    ],
    msrpKrw: 450000, released: 2015,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-beta-ar",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_beta_ar",
    modelName: "Arc'teryx Beta AR Gore-Tex Jacket",
    aliases: ["Beta AR", "베타 AR", "베타AR"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["beta", "베타"], ["베타 ar", "베타ar", "beta ar", "betaar"]],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      ...BETA_OTHER_LINE_NOISE,
      "베타 lt", "베타lt", "beta lt", "betalt",
      "베타 sl", "베타sl", "beta sl", "betasl",
    ],
    msrpKrw: 790000, released: 2000,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-proton-lt",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_proton_lt",
    modelName: "Arc'teryx Proton LT",
    aliases: ["Proton LT", "프로톤 LT", "프로톤LT"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["proton", "프로톤"], ["프로톤 lt", "프로톤lt", "proton lt", "protonlt"]],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      "프로톤 fl", "프로톤fl", "proton fl", "protonfl",
      "프로톤 sv", "프로톤sv", "proton sv", "protonsv",
      "프로톤 ar", "프로톤ar", "proton ar", "protonar",
      "팬츠", "pants",
    ],
    msrpKrw: 470000, released: 2014,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-proton-fl",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_proton_fl",
    modelName: "Arc'teryx Proton FL",
    aliases: ["Proton FL", "프로톤 FL", "프로톤FL"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["proton", "프로톤"], ["프로톤 fl", "프로톤fl", "proton fl", "protonfl"]],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      "프로톤 lt", "프로톤lt", "proton lt", "protonlt",
      "프로톤 sv", "프로톤sv", "proton sv", "protonsv",
      "프로톤 ar", "프로톤ar", "proton ar", "protonar",
      "팬츠", "pants",
    ],
    msrpKrw: 360000, released: 2018,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-proton-sv",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_proton_sv",
    modelName: "Arc'teryx Proton SV",
    aliases: ["Proton SV", "프로톤 SV", "프로톤SV"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["proton", "프로톤"], ["프로톤 sv", "프로톤sv", "proton sv", "protonsv"]],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      "프로톤 lt", "프로톤lt", "proton lt", "protonlt",
      "프로톤 fl", "프로톤fl", "proton fl", "protonfl",
      "프로톤 ar", "프로톤ar", "proton ar", "protonar",
      "팬츠", "pants",
    ],
    msrpKrw: 520000, released: 2016,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-proton-ar",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_proton_ar",
    modelName: "Arc'teryx Proton AR",
    aliases: ["Proton AR", "프로톤 AR", "프로톤AR"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["proton", "프로톤"], ["프로톤 ar", "프로톤ar", "proton ar", "protonar"]],
    mustNotContain: [
      ...ARCTERYX_COMMON_NOISE,
      "프로톤 lt", "프로톤lt", "proton lt", "protonlt",
      "프로톤 fl", "프로톤fl", "proton fl", "protonfl",
      "프로톤 sv", "프로톤sv", "proton sv", "protonsv",
      "팬츠", "pants",
    ],
    msrpKrw: 480000, released: 2015,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-stussy-crewneck-sweat",
    brand: "Stussy", category: "clothing", laneKey: "stussy_crewneck_sweat",
    modelName: "Stussy Crewneck / Sweatshirt",
    aliases: ["Stussy Crewneck", "스투시 크루넥", "스투시 맨투맨"],
    mustContain: [
      ["stussy", "스투시", "stüssy"],
      ["맨투맨", "크루넥", "crewneck", "sweatshirt", "sweat shirt", "스웻셔츠", "스웨트셔츠", "스웻 셔츠", "스웨트 셔츠"],
    ],
    mustNotContain: [
      ...STUSSY_COMMON_NOISE,
      "후드집업", "후드 집업", "집업후드", "집업 후드", "후드", "후디", "후드티",
      "hoodie", "hoody", "hooded", "zip up", "zipup", "full zip", "hoodie zip", "zip hoodie",
      "반집업", "반 집업", "하프집업", "하프 집업", "half zip", "half-zip", "quarter zip", "1/2 zip",
      "니트", "knit", "스웨터", "sweater",
      "8볼", "8 ball", "8ball", "에잇볼",
      "반팔", "티셔츠", "tee ", "t-shirt",
    ],
    msrpKrw: 139000, released: 2020,
    defaultProductType: "crewneck",
  },
  {
    id: "clothing-stussy-zip-hoodie",
    brand: "Stussy", category: "clothing", laneKey: "stussy_zip_hoodie",
    modelName: "Stussy Zip Hoodie",
    aliases: ["Stussy Zip Hoodie", "스투시 후드집업", "스투시 집업후드"],
    mustContain: [
      ["stussy", "스투시", "stüssy"],
      ["후드집업", "후드 집업", "집업후드", "집업 후드", "zip up hoodie", "zipup hoodie", "hoodie zip", "zip hoodie", "full zip hoodie", "풀집업 후드", "풀 집업 후드"],
    ],
    mustNotContain: [
      ...STUSSY_COMMON_NOISE,
      "맨투맨", "크루넥", "crewneck", "sweatshirt", "sweat shirt", "스웻셔츠", "스웨트셔츠",
      "반팔", "티셔츠", "tee ", "t-shirt",
      "니트", "knit", "스웨터", "sweater", "유니온", "union",
      // Wave 812: sample groups show these are separate special/limited axes, not basic zip hoodie comps.
      "8볼", "8 ball", "8ball", "에잇볼",
      "피그먼트", "pigment",
      "futura", "퓨추라",
      "stars hoodie", "스타즈 후드", "스타 후드",
      "더블 페이스", "double face",
      "스탁 서울", "stock seoul", "스투시서울", "스투시 서울",
    ],
    msrpKrw: 169000, released: 2020,
    defaultProductType: "hoodie_zip",
  },
  {
    id: "shoe-stussy-nike-air-penny",
    brand: "Stussy x Nike", category: "shoe", laneKey: "stussy_nike_air_penny",
    modelName: "Nike x Stussy Air Penny 2",
    aliases: ["Stussy Air Penny", "스투시 에어페니", "나투시 에어페니"],
    mustContain: [
      ["nike", "나이키", "나투시"],
      ["stussy", "스투시", "stüssy", "나투시"],
      ["에어 페니", "에어페니", "air penny", "페니 2", "페니2", "penny 2", "penny ii"],
    ],
    mustNotContain: [
      ...COMMON_NOISE,
      "spiridon", "스피리돈", "af1", "에어포스", "air force", "force 1", "미드", "mid",
      "베나시", "benassi", "허라취", "허라치", "huarache", "ld-1000", "ld1000", "vandal", "반달", "kukini", "쿠키니",
      "후드", "후디", "hoodie", "맨투맨", "티셔츠", "자켓", "재킷", "팬츠", "바람막이",
    ],
    msrpKrw: 249000, released: 2022,
    defaultProductType: "sneaker",
  },
];
