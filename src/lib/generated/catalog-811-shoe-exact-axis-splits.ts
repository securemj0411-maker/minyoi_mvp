import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 811 (2026-05-25): shoe exact-axis promotion after safety cleanup.
//
// Wave 810 deliberately held broad Kayano and Adidas/Puma football rows
// internal-only. This wave promotes only explicit, high-volume model axes while
// keeping broad/unknown/limited rows as learning data.
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "주니어", "유소년", "아동", "어린이", "junior", "youth", "gs ",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입", "구해요", "구함",
] as const;

const KAYANO_14_VARIANT_NOISE = [
  ...COMMON_NOISE,
  "톰브라운", "thom browne", "thom-browne", "thombrowne",
  "jjjjound", "자운드", "키코", "kiko", "kostadinov", "코스타디노프",
  "세실리에", "cecilie", "bahnsen", "비비안", "vivienne",
  "언어펙티드", "unaffected", "8on8", "아페쎄", "a.p.c", "apc",
  "아트모스", "atmos", "언더마이카", "under my car", "undermycar",
  "안젤로", "angelo", "baque", "사보타지", "sabotage",
  "스니커울프", "sneakerwolf", "더뮤지엄비지터", "더 뮤지엄 비지터",
  "뮤지엄비지터", "뮤지엄 비지터", "museum visitor",
  "gmbh", "비에이프", "bape", "야코타케", "yakoutake", "아리찌아", "aritzia",
  "언리미티드", "unlimited",
  "무신사 한정", "한정", "limited", "스페셜", "special", "콜라보", "collab",
  "ub1-s", "ub1s",
] as const;

const KAYANO_GENERATION_NOISE = [
  ...COMMON_NOISE,
  "젤카야노14", "젤 카야노 14", "gel-kayano 14", "gel kayano 14", "kayano 14",
  "젤카야노 14",
] as const;

const KAYANO_14_OTHER_GENERATION_NOISE = [
  "젤카야노28", "젤 카야노 28", "gel-kayano 28", "gel kayano 28", "kayano 28",
  "젤카야노30", "젤 카야노 30", "gel-kayano 30", "gel kayano 30", "kayano 30",
  "젤카야노31", "젤 카야노 31", "gel-kayano 31", "gel kayano 31", "kayano 31",
  "젤카야노32", "젤 카야노 32", "gel-kayano 32", "gel kayano 32", "kayano 32",
  "젤카야노5", "젤 카야노 5", "gel-kayano 5", "gel kayano 5", "kayano 5",
  "5 360", "5 og",
] as const;

const KAYANO_28_OTHER_GENERATION_NOISE = [
  ...KAYANO_GENERATION_NOISE,
  "젤카야노30", "젤 카야노 30", "gel-kayano 30", "gel kayano 30", "kayano 30",
  "젤카야노31", "젤 카야노 31", "gel-kayano 31", "gel kayano 31", "kayano 31",
  "젤카야노32", "젤 카야노 32", "gel-kayano 32", "gel kayano 32", "kayano 32",
  "젤카야노5", "젤 카야노 5", "gel-kayano 5", "gel kayano 5", "kayano 5",
  "5 360", "5 og",
] as const;

const KAYANO_31_OTHER_GENERATION_NOISE = [
  ...KAYANO_GENERATION_NOISE,
  "젤카야노28", "젤 카야노 28", "gel-kayano 28", "gel kayano 28", "kayano 28",
  "젤카야노30", "젤 카야노 30", "gel-kayano 30", "gel kayano 30", "kayano 30",
  "젤카야노32", "젤 카야노 32", "gel-kayano 32", "gel kayano 32", "kayano 32",
  "젤카야노5", "젤 카야노 5", "gel-kayano 5", "gel kayano 5", "kayano 5",
  "5 360", "5 og",
] as const;

const KAYANO_32_OTHER_GENERATION_NOISE = [
  ...KAYANO_GENERATION_NOISE,
  "젤카야노28", "젤 카야노 28", "gel-kayano 28", "gel kayano 28", "kayano 28",
  "젤카야노30", "젤 카야노 30", "gel-kayano 30", "gel kayano 30", "kayano 30",
  "젤카야노31", "젤 카야노 31", "gel-kayano 31", "gel kayano 31", "kayano 31",
  "젤카야노5", "젤 카야노 5", "gel-kayano 5", "gel kayano 5", "kayano 5",
  "5 360", "5 og",
] as const;

const FOOTBALL_NOISE = [
  ...COMMON_NOISE,
  "축구공", "미니볼", "공인구", "매치볼", "골키퍼 장갑", "골키퍼장갑",
  "키퍼 장갑", "키퍼장갑", "goalkeeper", "gk 장갑",
  "유니폼", "져지", "저지", "jersey", "마킹", "풀마킹",
  "스니커즈", "스니커", "sneaker",
  "양말", "삭스", "socks", "트래킹화", "트레킹화", "라퓨마",
  "가격 제안받아", "가격제안받아", "가격제시받",
] as const;

const ADIDAS_FOOTBALL_LIMITED_NOISE = [
  ...FOOTBALL_NOISE,
  "한정", "한정판", "limited", "아카이브", "archive", "엑셀레이터", "accelerator",
  "지단", "zidane", "벨링엄", "bellingham", "토니크로스", "kroos",
  "메시", "messi", "손흥민", "son", "베컴", "beckham",
  "고샤", "gosha", "루브친스키", "rubchinskiy", "시그니처", "signature",
  "런칭", "런칭팩", "launch", "어드밴스먼트팩", "advancement",
  "베이프", "bape", "비에이프", "supreme", "슈프림",
] as const;

const PUMA_FOOTBALL_NOISE = [
  ...COMMON_NOISE,
  "축구공", "미니볼", "공인구", "매치볼", "골키퍼 장갑", "골키퍼장갑",
  "키퍼 장갑", "키퍼장갑", "goalkeeper", "gk 장갑",
  "유니폼", "져지", "저지", "jersey", "풀마킹",
  "스니커즈", "스니커", "sneaker", "운동화", "런닝화", "워킹화",
  "양말", "삭스", "socks", "트래킹화", "트레킹화", "라퓨마",
  "가격 제안받아", "가격제안받아", "가격제시받",
  "한정", "한정판", "limited", "70주년", "75 years", "anniversary",
  "런칭", "런칭팩", "launch", "creativity팩", "creativity pack", "크리에이티비티",
  "네이마르", "neymar", "월드컵", "world cup", "풀리시치", "pulisic", "크리스티안",
  "court ultra", "court", "코트",
  "퓨처캣", "퓨처 캣", "퓨쳐캣", "퓨쳐 캣", "futurecat", "future cat",
  "퓨처 라이더", "future rider", "라이더", "rider",
  "스피드캣", "speedcat", "팔레르모", "palermo", "스웨이드", "suede",
  "트래킹", "트레킹", "트레일",
] as const;

const PUMA_KING_TOKENS = [
  "푸마 킹", "퓨마 킹", "푸마킹", "퓨마킹", "puma king",
  "킹 얼티메이트", "킹얼티메이트", "king ultimate",
  "킹 20", "킹20", "king 20", "킹탑", "king top",
] as const;

export const WAVE_811_SHOE_EXACT_AXIS_SPLITS: Sku[] = [
  {
    id: "shoe-asics-gel-kayano-14",
    brand: "Asics",
    category: "shoe",
    laneKey: "asics_gel_kayano_14",
    modelName: "Asics Gel-Kayano 14 (plain/general release)",
    aliases: ["Asics Gel-Kayano 14", "아식스 젤카야노14", "젤 카야노 14"],
    mustContain: [
      ["asics", "아식스"],
      ["젤카야노14", "젤 카야노14", "젤카야노 14", "젤 카야노 14", "gel-kayano 14", "gel kayano 14", "gelkayano14", "kayano 14"],
    ],
    mustNotContain: [...KAYANO_14_VARIANT_NOISE, ...KAYANO_14_OTHER_GENERATION_NOISE],
    msrpKrw: 180000,
    released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-kayano-28",
    brand: "Asics",
    category: "shoe",
    laneKey: "asics_gel_kayano_28",
    modelName: "Asics Gel-Kayano 28",
    aliases: ["Asics Gel-Kayano 28", "아식스 젤카야노28"],
    mustContain: [["asics", "아식스"], ["젤카야노28", "젤 카야노 28", "gel-kayano 28", "gel kayano 28", "kayano 28", "fn3"]],
    mustNotContain: [...KAYANO_28_OTHER_GENERATION_NOISE],
    msrpKrw: 180000,
    released: 2021,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-kayano-31",
    brand: "Asics",
    category: "shoe",
    laneKey: "asics_gel_kayano_31",
    modelName: "Asics Gel-Kayano 31",
    aliases: ["Asics Gel-Kayano 31", "아식스 젤카야노31"],
    mustContain: [["asics", "아식스"], ["젤카야노31", "젤 카야노 31", "gel-kayano 31", "gel kayano 31", "kayano 31"]],
    mustNotContain: [...KAYANO_31_OTHER_GENERATION_NOISE],
    msrpKrw: 190000,
    released: 2024,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-kayano-32",
    brand: "Asics",
    category: "shoe",
    laneKey: "asics_gel_kayano_32",
    modelName: "Asics Gel-Kayano 32",
    aliases: ["Asics Gel-Kayano 32", "아식스 젤카야노32"],
    mustContain: [["asics", "아식스"], ["젤카야노32", "젤 카야노 32", "gel-kayano 32", "gel kayano 32", "kayano 32"]],
    mustNotContain: [...KAYANO_32_OTHER_GENERATION_NOISE],
    msrpKrw: 190000,
    released: 2025,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-adidas-football-f50",
    brand: "Adidas",
    category: "shoe",
    laneKey: "adidas_football_f50",
    modelName: "Adidas F50 Football/Futsal",
    aliases: ["Adidas F50", "아디다스 F50", "F50 Elite", "F50 Pro"],
    mustContain: [["adidas", "아디다스"], ["f50", "f 50", "f50tf", "f50ag", "f50fg", "f50엘리트", "f50 elite", "f50 프로", "f50 pro"]],
    mustNotContain: [...ADIDAS_FOOTBALL_LIMITED_NOISE, "프레데터", "predator", "코파", "copa", "crazyfast", "크레이지패스트", "네메시스", "nemeziz"],
    msrpKrw: 199000,
    released: 2014,
    defaultProductType: "football_shoe",
  },
  {
    id: "shoe-adidas-football-predator",
    brand: "Adidas",
    category: "shoe",
    laneKey: "adidas_football_predator",
    modelName: "Adidas Predator Football/Futsal",
    aliases: ["Adidas Predator", "아디다스 프레데터"],
    mustContain: [["adidas", "아디다스"], ["프레데터", "predator"]],
    mustNotContain: [...ADIDAS_FOOTBALL_LIMITED_NOISE, "f50", "코파", "copa", "crazyfast", "크레이지패스트", "네메시스", "nemeziz"],
    msrpKrw: 199000,
    released: 2010,
    defaultProductType: "football_shoe",
  },
  {
    id: "shoe-adidas-football-copa",
    brand: "Adidas",
    category: "shoe",
    laneKey: "adidas_football_copa",
    modelName: "Adidas Copa Football/Futsal",
    aliases: ["Adidas Copa", "아디다스 코파", "코파 퓨어", "코파 센스"],
    mustContain: [["adidas", "아디다스"], ["코파", "copa"]],
    mustNotContain: [...ADIDAS_FOOTBALL_LIMITED_NOISE, "f50", "프레데터", "predator", "crazyfast", "크레이지패스트", "네메시스", "nemeziz"],
    msrpKrw: 179000,
    released: 2017,
    defaultProductType: "football_shoe",
  },
  {
    id: "shoe-puma-football-ultra",
    brand: "Puma",
    category: "shoe",
    laneKey: "puma_football_ultra",
    modelName: "Puma Ultra Football/Futsal",
    aliases: ["Puma Ultra", "푸마 울트라", "퓨마 울트라"],
    mustContain: [["puma", "푸마", "퓨마"], ["울트라", "ultra"]],
    mustNotContain: [...PUMA_FOOTBALL_NOISE, "퓨처", "퓨쳐", "future", ...PUMA_KING_TOKENS],
    msrpKrw: 150000,
    released: 2020,
    defaultProductType: "football_shoe",
  },
  {
    id: "shoe-puma-football-future",
    brand: "Puma",
    category: "shoe",
    laneKey: "puma_football_future",
    modelName: "Puma Future Football/Futsal",
    aliases: ["Puma Future", "푸마 퓨처", "퓨마 퓨처"],
    mustContain: [["puma", "푸마", "퓨마"], ["퓨처", "퓨쳐", "future"]],
    mustNotContain: [...PUMA_FOOTBALL_NOISE, "울트라", "ultra", ...PUMA_KING_TOKENS],
    msrpKrw: 150000,
    released: 2020,
    defaultProductType: "football_shoe",
  },
  {
    id: "shoe-puma-football-king",
    brand: "Puma",
    category: "shoe",
    laneKey: "puma_football_king",
    modelName: "Puma King Football/Futsal",
    aliases: ["Puma King", "푸마 킹", "퓨마 킹"],
    mustContain: [
      ["puma", "푸마", "퓨마"],
      [...PUMA_KING_TOKENS],
    ],
    mustNotContain: [...PUMA_FOOTBALL_NOISE, "울트라", "ultra", "퓨처", "future"],
    msrpKrw: 150000,
    released: 2020,
    defaultProductType: "football_shoe",
  },
];
