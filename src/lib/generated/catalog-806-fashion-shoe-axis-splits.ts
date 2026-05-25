import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 806 (2026-05-24): fashion/shoe active spread repair.
//
// The active ready pool no longer had row-level mixed-brand exposure, but sample
// groups still showed broad lanes collapsing real resale axes:
// - Asics x Kiko model families (Gel-Kiril/Sokat/Korika/Lokros/Novalis)
// - Asics Gel-Quantum 360/90/Kinetic SP/collab
// - Puma Nitro running sub-lines (Deviate/Velocity/Elite)
// - Mizuno Wave Prophecy MOC/Beta/LS/collabs
// - Converse x Carhartt WIP silhouettes
//
// Policy: explicit model token only. Ambiguous broad collab/family lanes are
// held by readiness and exact sub-lanes remain ready.
// ============================================================================

const COMMON_NOISE = [
  "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
  "짝퉁", "짭", "가품",
  "삽니다", "구합니다", "매입",
] as const;

const ASICS_KIKO_NOISE = [
  ...COMMON_NOISE,
  "세실리에", "cecilie", "bahnsen", "반센", "비비안", "vivienne", "아트모스", "atmos",
] as const;

const ASICS_QUANTUM_NOISE = [
  ...COMMON_NOISE,
  "키코", "kiko", "코스타디노프", "cecilie", "세실리에",
] as const;

const MIZUNO_PROPHECY_NOISE = [
  ...COMMON_NOISE,
  "모렐리아", "morelia", "알파", "alpha", "골프", "골프화", "jpx", "mp-", "mx-",
] as const;

export const WAVE_806_FASHION_SHOE_AXIS_SPLITS: Sku[] = [
  {
    id: "shoe-asics-kiko-gel-kiril",
    brand: "Kiko Kostadinov x Asics", category: "shoe", laneKey: "asics_kiko_gel_kiril",
    modelName: "Asics x Kiko Gel-Kiril / Gel-Kiril 2",
    aliases: ["Asics Kiko Gel-Kiril", "아식스 키코 젤키릴", "키코 젤키릴2"],
    mustContain: [["asics", "아식스"], ["키코", "kiko", "kostadinov", "코스타디노프"], ["젤키릴", "젤 키릴", "gel-kiril", "gel kiril", "gelkiril"]],
    mustNotContain: [...ASICS_KIKO_NOISE, "젤소켓", "sokat", "젤코리카", "korika", "로크로스", "lokros", "teremoa", "테레모아", "heaven"],
    msrpKrw: 320000, released: 2018,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-kiko-gel-sokat",
    brand: "Kiko Kostadinov x Asics", category: "shoe", laneKey: "asics_kiko_gel_sokat",
    modelName: "Asics x Kiko Gel-Sokat",
    aliases: ["Asics Kiko Gel-Sokat", "아식스 키코 젤소켓"],
    mustContain: [["asics", "아식스"], ["키코", "kiko", "kostadinov", "코스타디노프"], ["젤소켓", "젤 소켓", "gel-sokat", "gel sokat", "sokat"]],
    mustNotContain: [...ASICS_KIKO_NOISE, "젤키릴", "kiril", "젤코리카", "korika", "로크로스", "lokros", "teremoa", "테레모아"],
    msrpKrw: 320000, released: 2019,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-kiko-gel-korika",
    brand: "Kiko Kostadinov x Asics", category: "shoe", laneKey: "asics_kiko_gel_korika",
    modelName: "Asics x Kiko Gel-Korika",
    aliases: ["Asics Kiko Gel-Korika", "아식스 키코 젤코리카"],
    mustContain: [["asics", "아식스"], ["키코", "kiko", "kostadinov", "코스타디노프"], ["젤코리카", "젤 코리카", "gel-korika", "gel korika", "korika"]],
    mustNotContain: [...ASICS_KIKO_NOISE, "젤키릴", "kiril", "젤소켓", "sokat", "로크로스", "lokros", "teremoa", "테레모아"],
    msrpKrw: 300000, released: 2019,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-kiko-gel-lokros",
    brand: "Kiko Kostadinov x Asics", category: "shoe", laneKey: "asics_kiko_gel_lokros",
    modelName: "Asics x Kiko Gel-Lokros",
    aliases: ["Asics Kiko Gel-Lokros", "아식스 키코 젤 로크로스"],
    mustContain: [["asics", "아식스"], ["키코", "kiko", "kostadinov", "코스타디노프"], ["로크로스", "lokros", "gel-lokros", "gel lokros"]],
    mustNotContain: [...ASICS_KIKO_NOISE, "젤키릴", "kiril", "젤소켓", "sokat", "젤코리카", "korika", "teremoa", "테레모아"],
    msrpKrw: 320000, released: 2019,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-kiko-novalis-gel-teremoa",
    brand: "Kiko Kostadinov x Asics Novalis", category: "shoe", laneKey: "asics_kiko_novalis_gel_teremoa",
    modelName: "Asics Novalis Gel-Teremoa",
    aliases: ["Asics Novalis Gel-Teremoa", "아식스 노발리스 젤 테레모아"],
    mustContain: [["asics", "아식스"], ["노발리스", "novalis", "키코", "kiko"], ["테레모아", "teremoa", "gel-teremoa", "gel teremoa"]],
    mustNotContain: [...ASICS_KIKO_NOISE, "젤키릴", "kiril", "젤소켓", "sokat", "젤코리카", "korika"],
    msrpKrw: 300000, released: 2024,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-kiko-heaven",
    brand: "Kiko Kostadinov x Asics", category: "shoe", laneKey: "asics_kiko_heaven",
    modelName: "Asics x Kiko Heaven",
    aliases: ["Asics Kiko Heaven", "아식스 키코 헤븐"],
    mustContain: [["asics", "아식스"], ["키코", "kiko", "kostadinov", "코스타디노프"], ["heaven", "헤븐"]],
    mustNotContain: [...ASICS_KIKO_NOISE, "젤키릴", "kiril", "젤소켓", "sokat", "젤코리카", "korika"],
    msrpKrw: 320000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-nimbus-9",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_nimbus_9",
    modelName: "Asics Gel-Nimbus 9 / UB3-S Gel-Nimbus 9",
    aliases: ["Asics Gel-Nimbus 9", "아식스 젤 님버스9", "UB3-S 젤 님버스9"],
    mustContain: [["asics", "아식스"], ["nimbus", "님버스", "젤님버스", "젤 님버스"], ["9", "9 ", "ub3-s", "ub3s"]],
    mustNotContain: [...COMMON_NOISE, "10.1", "10 1", "20", "21", "22", "23", "24", "25", "26", "미라이", "mirai"],
    msrpKrw: 180000, released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-nimbus-10-1",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_nimbus_10_1",
    modelName: "Asics Gel-Nimbus 10.1",
    aliases: ["Asics Gel-Nimbus 10.1", "아식스 젤 님버스 10.1"],
    mustContain: [["asics", "아식스"], ["nimbus", "님버스", "젤님버스", "젤 님버스"], ["10.1", "10 1", "10-1"]],
    mustNotContain: [...COMMON_NOISE, "9 ", "ub3-s", "ub3s", "20", "21", "22", "23", "24", "25", "26"],
    msrpKrw: 200000, released: 2024,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-quantum-360",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_quantum_360",
    modelName: "Asics Gel-Quantum 360",
    aliases: ["Asics Gel-Quantum 360", "아식스 젤 퀀텀 360"],
    mustContain: [["asics", "아식스"], ["quantum", "퀀텀"], ["360"]],
    mustNotContain: [...ASICS_QUANTUM_NOISE, "cp company", "c.p.", "cp컴퍼니", "c.p. company", "코카콜라", "coca", "키네틱", "kinetic", "sp "],
    msrpKrw: 230000, released: 2016,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-quantum-90",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_quantum_90",
    modelName: "Asics Gel-Quantum 90",
    aliases: ["Asics Gel-Quantum 90", "아식스 젤 퀀텀 90"],
    mustContain: [["asics", "아식스"], ["quantum", "퀀텀"], ["90"]],
    mustNotContain: [...ASICS_QUANTUM_NOISE, "360", "키네틱", "kinetic"],
    msrpKrw: 150000, released: 2019,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-kinetic-sp",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_kinetic_sp",
    modelName: "Asics Gel-Kinetic SP",
    aliases: ["Asics Gel-Kinetic SP", "아식스 젤 키네틱 SP"],
    mustContain: [["asics", "아식스"], ["kinetic", "키네틱"], ["sp", "sp "]],
    mustNotContain: [...ASICS_QUANTUM_NOISE],
    msrpKrw: 280000, released: 2024,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-asics-gel-quantum-cp-company",
    brand: "Asics x C.P. Company", category: "shoe", laneKey: "asics_gel_quantum_cp_company",
    modelName: "Asics x C.P. Company Gel-Quantum 360",
    aliases: ["Asics C.P. Company Gel-Quantum", "아식스 CP 컴퍼니 젤 퀀텀"],
    mustContain: [["asics", "아식스"], ["quantum", "퀀텀"], ["cp company", "c.p.", "cp컴퍼니", "c.p. company"]],
    mustNotContain: [...COMMON_NOISE, "키네틱", "kinetic"],
    msrpKrw: 260000, released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-puma-deviate-nitro",
    brand: "Puma", category: "shoe", laneKey: "puma_deviate_nitro",
    modelName: "Puma Deviate Nitro",
    aliases: ["Puma Deviate Nitro", "푸마 디비에이트 나이트로"],
    mustContain: [["puma", "푸마", "퓨마"], ["디비에이트", "deviate"], ["나이트로", "nitro"]],
    mustNotContain: [...COMMON_NOISE, "elite", "엘리트", "velocity", "벨로시티", "골프", "축구화", "풋살화"],
    msrpKrw: 190000, released: 2021,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-puma-deviate-nitro-elite",
    brand: "Puma", category: "shoe", laneKey: "puma_deviate_nitro_elite",
    modelName: "Puma Deviate Nitro Elite",
    aliases: ["Puma Deviate Nitro Elite", "푸마 디비에이트 나이트로 엘리트"],
    mustContain: [["puma", "푸마", "퓨마"], ["디비에이트", "deviate"], ["나이트로", "nitro"], ["elite", "엘리트"]],
    mustNotContain: [...COMMON_NOISE, "velocity", "벨로시티", "골프", "축구화", "풋살화"],
    msrpKrw: 290000, released: 2021,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-puma-velocity-nitro",
    brand: "Puma", category: "shoe", laneKey: "puma_velocity_nitro",
    modelName: "Puma Velocity Nitro",
    aliases: ["Puma Velocity Nitro", "푸마 벨로시티 나이트로"],
    mustContain: [["puma", "푸마", "퓨마"], ["벨로시티", "velocity"], ["나이트로", "nitro"]],
    mustNotContain: [...COMMON_NOISE, "deviate", "디비에이트", "elite", "엘리트", "골프", "축구화", "풋살화"],
    msrpKrw: 160000, released: 2021,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-mizuno-wave-prophecy-moc",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_wave_prophecy_moc",
    modelName: "Mizuno Wave Prophecy MOC",
    aliases: ["Mizuno Wave Prophecy MOC", "미즈노 웨이브 프로페시 MOC", "프로페시 목"],
    mustContain: [["mizuno", "미즈노"], ["프로페시", "prophecy"], ["moc", "목"]],
    mustNotContain: [...MIZUNO_PROPHECY_NOISE, "베타", "beta", "graphpaper", "그라프페이퍼", "blankof", "블랭코브", "ls "],
    msrpKrw: 280000, released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-mizuno-wave-prophecy-beta",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_wave_prophecy_beta",
    modelName: "Mizuno Wave Prophecy Beta",
    aliases: ["Mizuno Wave Prophecy Beta", "미즈노 웨이브 프로페시 베타"],
    mustContain: [["mizuno", "미즈노"], ["프로페시", "prophecy"], ["베타", "beta"]],
    mustNotContain: [...MIZUNO_PROPHECY_NOISE, "moc", "목", "graphpaper", "그라프페이퍼"],
    msrpKrw: 230000, released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-mizuno-wave-prophecy-ls",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_wave_prophecy_ls",
    modelName: "Mizuno Wave Prophecy LS",
    aliases: ["Mizuno Wave Prophecy LS", "미즈노 웨이브 프로페시 LS"],
    mustContain: [["mizuno", "미즈노"], ["프로페시", "prophecy"], ["ls", "ls "]],
    mustNotContain: [...MIZUNO_PROPHECY_NOISE, "moc", "목", "베타", "beta", "graphpaper", "그라프페이퍼", "blankof", "블랭코브"],
    msrpKrw: 250000, released: 2022,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-mizuno-wave-prophecy-graphpaper",
    brand: "Mizuno x Graphpaper", category: "shoe", laneKey: "mizuno_wave_prophecy_graphpaper",
    modelName: "Mizuno x Graphpaper Wave Prophecy",
    aliases: ["Mizuno Graphpaper Wave Prophecy", "그라프페이퍼 미즈노 웨이브 프로페시"],
    mustContain: [["mizuno", "미즈노"], ["프로페시", "prophecy"], ["graphpaper", "그라프페이퍼"]],
    mustNotContain: [...MIZUNO_PROPHECY_NOISE, "moc", "목", "베타", "beta", "blankof", "블랭코브"],
    msrpKrw: 300000, released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-mizuno-wave-prophecy-blankof",
    brand: "Mizuno x Blankof", category: "shoe", laneKey: "mizuno_wave_prophecy_blankof",
    modelName: "Mizuno x Blankof Wave Prophecy",
    aliases: ["Mizuno Blankof Wave Prophecy", "블랭코브 미즈노 웨이브 프로페시"],
    mustContain: [["mizuno", "미즈노"], ["프로페시", "prophecy"], ["blankof", "블랭코브"]],
    mustNotContain: [...MIZUNO_PROPHECY_NOISE, "moc", "목", "graphpaper", "그라프페이퍼"],
    msrpKrw: 260000, released: 2023,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-carhartt-converse-one-star",
    brand: "Converse x Carhartt WIP", category: "shoe", laneKey: "carhartt_converse_one_star",
    modelName: "Converse x Carhartt WIP One Star",
    aliases: ["Carhartt Converse One Star", "컨버스 칼하트 원스타"],
    mustContain: [["converse", "컨버스"], ["carhartt", "칼하트"], ["원스타", "one star", "onestar"]],
    mustNotContain: [...COMMON_NOISE, "척", "chuck", "jack purcell", "잭퍼셀"],
    msrpKrw: 130000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-carhartt-converse-chuck70",
    brand: "Converse x Carhartt WIP", category: "shoe", laneKey: "carhartt_converse_chuck70",
    modelName: "Converse x Carhartt WIP Chuck 70",
    aliases: ["Carhartt Converse Chuck 70", "컨버스 칼하트 척70"],
    mustContain: [["converse", "컨버스"], ["carhartt", "칼하트"], ["척70", "척 70", "chuck 70", "chuck70", "척테일러", "chuck taylor"]],
    mustNotContain: [...COMMON_NOISE, "원스타", "one star", "잭퍼셀", "jack purcell"],
    msrpKrw: 130000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-carhartt-converse-jack-purcell",
    brand: "Converse x Carhartt WIP", category: "shoe", laneKey: "carhartt_converse_jack_purcell",
    modelName: "Converse x Carhartt WIP Jack Purcell",
    aliases: ["Carhartt Converse Jack Purcell", "컨버스 칼하트 잭퍼셀"],
    mustContain: [["converse", "컨버스"], ["carhartt", "칼하트"], ["잭퍼셀", "jack purcell", "jackpurcell"]],
    mustNotContain: [...COMMON_NOISE, "원스타", "one star", "척70", "chuck 70"],
    msrpKrw: 130000, released: 2020,
    defaultProductType: "sneaker",
  },
];
