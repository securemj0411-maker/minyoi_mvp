/**
 * mine-narrow-lane.ts
 *
 * Narrow lane miner. Self-contained: collects Bunjang listings for a single
 * lane, applies positive accept rules and negative reject rules, persists
 * samples + parse_ready stats under `category-intelligence/<lane_key>/`.
 *
 * Run:
 *   node --experimental-strip-types scripts/lib/mine-narrow-lane.ts --lane=ipad_pro_11_m4_256_wifi
 *   node --experimental-strip-types scripts/lib/mine-narrow-lane.ts --lane=sony_wh1000xm4 --pages=6
 *   node --experimental-strip-types scripts/lib/mine-narrow-lane.ts --lane=iphone_15_pro_64gb_self
 *
 * Does NOT mine broad categories. One lane per invocation.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..", "..");
const outBase = path.join(appDir, "category-intelligence");

type LaneKey =
  | "ipad_pro_11_m4_256_wifi"
  | "ipad_air_m2_11_256_wifi"
  | "ipad_pro_13_m4_256_wifi"
  | "ipad_air_m3_11_256_wifi"
  | "sony_wh1000xm4"
  | "sony_wh_ch520"
  | "iphone_15_pro_128gb_self"
  | "macbook_air_m3_13_256"
  | "bose_qc_ultra"
  | "airpods_max_usbc"
  | "iphone_16_pro_128gb_self"
  | "galaxy_s25_ultra_256_self"
  | "airpods_pro_3"
  | "macbook_pro_14_m3_18_512"
  | "iphone_14_pro_128gb_self"
  | "galaxy_s24_ultra_256_self";

type RejectRule = { label: string; pattern: RegExp };

type LaneConfig = {
  laneKey: LaneKey;
  category: string;
  queries: string[];
  pages: number;
  targetParseReady: number;
  priceMin: number;
  priceMax: number;
  acceptAll: RegExp[];
  acceptAnyOf: RegExp[][];
  reject: RegExp[];
  rejectLabelled: RejectRule[];
};

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};

// ─── Lane configs ─────────────────────────────────────────────────────────────

const LANES: Record<LaneKey, LaneConfig> = {
  ipad_pro_11_m4_256_wifi: {
    laneKey: "ipad_pro_11_m4_256_wifi",
    category: "tablet",
    queries: [
      "아이패드 프로 11 m4 256",
      "아이패드 프로 m4 256 와이파이",
      "ipad pro 11 m4 256",
      "아이패드 m4 11인치 256",
      "ipad pro m4 256 wifi",
      "아이패드 프로 m4 256",
      "ipad pro m4 256gb",
    ],
    pages: 6,
    targetParseReady: 200,
    priceMin: 700_000,
    priceMax: 2_500_000,
    acceptAll: [/m4/i, /256/, /아이패드|ipad/i],
    acceptAnyOf: [],
    reject: [],
    rejectLabelled: [
      { label: "wrong_chip_m1_m2_m3", pattern: /\bm[123]\b|m1\s*칩|m2\s*칩|m3\s*칩/i },
      { label: "wrong_storage_512_1tb_2tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|2\s*tb|1\s*테라|2\s*테라/i },
      { label: "wrong_storage_128", pattern: /(?:^|[^0-9])128\s*(?:gb|기가)?\b/i },
      { label: "wrong_size_13_inch", pattern: /13\s*인치|12\.9\s*인치|13"|13″/ },
      { label: "cellular_variant", pattern: /셀룰러|cellular|\blte\b|\b5g\b|유심|sim\s*트레이|esim/i },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품|개별)|필름\s*(?:만|단품)|키보드\s*만|펜슬\s*만|어댑터\s*만|충전기\s*만/i },
      { label: "case_or_smart_folio_listing", pattern: /(?:스마트\s*폴리오|스마트\s*커버|폴리오\s*케이스).{0,8}판매|매직\s*키보드\s*판매/i },
      { label: "broken_or_parts_only", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품/i },
      { label: "buying_post", pattern: /매입|삽니다|구매\s*합니다|구매합니다|사요|구해요/ },
      { label: "ipad_air_or_mini", pattern: /아이패드\s*에어|ipad\s*air|아이패드\s*미니|ipad\s*mini/i },
      { label: "wrong_model_year_m2_2022", pattern: /2022\s*년|아이패드\s*프로\s*6세대|6세대\s*프로/i },
    ],
  },

  ipad_air_m2_11_256_wifi: {
    laneKey: "ipad_air_m2_11_256_wifi",
    category: "tablet",
    queries: [
      "아이패드 에어 11 m2 256",
      "아이패드 에어 m2 256",
      "ipad air m2 256",
      "아이패드 에어 m2 11인치",
      "ipad air 11 m2 256gb",
      "아이패드 에어 6세대 256",
      "아이패드 에어6 256",
      "ipad air 6 256",
      "ipad air 6th 256",
      "아이패드 에어 256gb 11",
      "아이패드 에어 m2 wifi 256",
      "ipad air m2 wifi 256",
      "아이패드 에어 m2 256gb",
      "아이패드 에어 m2 스타라이트 256",
      "아이패드 에어 m2 퍼플 256",
      "아이패드 에어 m2 블루 256",
      "아이패드 에어 m2 스페이스그레이 256",
      "아이패드 에어 m2 11",
      "ipad air m2 11",
      "아이패드 에어 6세대 11",
      "아이패드 에어6 11",
      "ipad air 6 11",
      "아이패드 에어 11인치 m2",
      "아이패드 에어 11 m2",
      "아이패드 에어 11형 m2",
    ],
    pages: 10,
    targetParseReady: 200,
    priceMin: 600_000,
    priceMax: 1_500_000,
    acceptAll: [/256/, /아이패드|ipad/i, /에어|air/i],
    acceptAnyOf: [
      [/\bm2\b|m2\s*칩/i, /6\s*세대|에어\s*6\b|에어\s*6세대|\bair\s*6\b/i],
      [/\b11\b|11\s*인치|11\s*형|11"|11″|에어\s*11|에어11|\bair\s*11|아이패드\s*11/i],
    ],
    reject: [],
    rejectLabelled: [
      { label: "wrong_chip_m1_m3", pattern: /\bm[13]\b|m1\s*칩|m3\s*칩/i },
      { label: "wrong_gen_non_m2", pattern: /[3457]\s*세대|에어\s*[3457]\b|\bair\s*[3457]\b/i },
      { label: "wrong_storage_512_1tb_2tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|2\s*tb|1\s*테라|2\s*테라/i },
      { label: "wrong_storage_128", pattern: /(?:^|[^0-9])128\s*(?:gb|기가)?\b/i },
      { label: "wrong_size_13_inch", pattern: /13\s*인치|13\s*형|12\.9\s*인치|13"|13″|에어\s*13\b|에어13\b|\bair\s*13\b|아이패드\s*13\b/i },
      { label: "cellular_variant", pattern: /셀룰러|cellular|\blte\b|\b5g\b|유심|sim\s*트레이|esim/i },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품|개별)|필름\s*(?:만|단품)|키보드\s*만|펜슬\s*만|어댑터\s*만|충전기\s*만/i },
      { label: "case_or_smart_folio_listing", pattern: /(?:스마트\s*폴리오|스마트\s*커버|폴리오\s*케이스).{0,8}판매|매직\s*키보드\s*판매/i },
      { label: "broken_or_parts_only", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품/i },
      { label: "buying_post", pattern: /매입|삽니다|구매\s*합니다|구매합니다|사요|구해요/ },
      { label: "ipad_pro_or_mini", pattern: /아이패드\s*프로|ipad\s*pro|아이패드\s*미니|ipad\s*mini/i },
    ],
  },

  ipad_pro_13_m4_256_wifi: {
    laneKey: "ipad_pro_13_m4_256_wifi",
    category: "tablet",
    queries: [
      "아이패드 프로 13 m4 256",
      "아이패드 프로 m4 13인치 256",
      "ipad pro 13 m4 256",
      "ipad pro m4 13 256gb",
      "아이패드 프로 13 m4 256 와이파이",
      "아이패드 프로 m4 256 와이파이",
      "아이패드 m4 13인치 256",
      "ipad pro m4 13",
      "아이패드 프로 13 m4",
    ],
    pages: 6,
    targetParseReady: 200,
    priceMin: 900_000,
    priceMax: 2_800_000,
    acceptAll: [/m4/i, /256/, /아이패드|ipad/i],
    acceptAnyOf: [[/13\s*인치|13\s*형|\b13"\b|13″|아이패드\s*프로\s*13\b|ipad\s*pro\s*13\b|\bpro\s*13\b|프로\s*13\s*m4|\b13\s*m4\b/i]],
    reject: [],
    rejectLabelled: [
      { label: "wrong_chip_m1_m2_m3", pattern: /\bm[123]\b|m1\s*칩|m2\s*칩|m3\s*칩/i },
      { label: "wrong_storage_512_1tb_2tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|2\s*tb|1\s*테라|2\s*테라/i },
      { label: "wrong_storage_128", pattern: /(?:^|[^0-9])128\s*(?:gb|기가)?\b/i },
      { label: "wrong_size_11_inch", pattern: /11\s*인치|11\s*형|\b11"\b|11″|아이패드\s*프로\s*11\b|ipad\s*pro\s*11\b|\bpro\s*11\b|프로\s*11\s*m4|\b11\s*m4\b/i },
      { label: "cellular_variant", pattern: /셀룰러|cellular|\blte\b|\b5g\b|유심|sim\s*트레이|esim/i },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품|개별)|필름\s*(?:만|단품)|키보드\s*만|펜슬\s*만|어댑터\s*만|충전기\s*만/i },
      { label: "case_or_smart_folio_listing", pattern: /(?:스마트\s*폴리오|스마트\s*커버|폴리오\s*케이스).{0,8}판매|매직\s*키보드\s*판매/i },
      { label: "broken_or_parts_only", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품/i },
      { label: "buying_post", pattern: /매입|삽니다|구매\s*합니다|구매합니다|사요|구해요/ },
      { label: "ipad_air_or_mini", pattern: /아이패드\s*에어|ipad\s*air|아이패드\s*미니|ipad\s*mini/i },
      { label: "wrong_model_year_m2_2022", pattern: /2022\s*년|아이패드\s*프로\s*6세대|6세대\s*프로/i },
    ],
  },

  ipad_air_m3_11_256_wifi: {
    laneKey: "ipad_air_m3_11_256_wifi",
    category: "tablet",
    queries: [
      "아이패드 에어 m3 11 256",
      "아이패드 에어 m3 256",
      "ipad air m3 256",
      "아이패드 에어 m3 11인치",
      "아이패드 에어 7세대 256",
      "ipad air 7 256",
      "아이패드 에어 m3 wifi 256",
      "ipad air m3 11",
      "아이패드 에어 m3",
    ],
    pages: 10,
    targetParseReady: 200,
    priceMin: 700_000,
    priceMax: 1_600_000,
    acceptAll: [/256/, /아이패드|ipad/i, /에어|air/i],
    acceptAnyOf: [
      [/\bm3\b|m3\s*칩/i, /7\s*세대|에어\s*7\b|에어\s*7세대|\bair\s*7\b/i],
      [/\b11\b|11\s*인치|11\s*형|11"|11″|에어\s*11|에어11|\bair\s*11|아이패드\s*11/i],
    ],
    reject: [],
    rejectLabelled: [
      { label: "wrong_chip_m1_m2_m4", pattern: /\bm[124]\b|m1\s*칩|m2\s*칩|m4\s*칩/i },
      { label: "wrong_gen_non_m3", pattern: /[3456]\s*세대|에어\s*[3456]\b|\bair\s*[3456]\b/i },
      { label: "wrong_storage_512_1tb_2tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|2\s*tb|1\s*테라|2\s*테라/i },
      { label: "wrong_storage_128", pattern: /(?:^|[^0-9])128\s*(?:gb|기가)?\b/i },
      { label: "wrong_size_13_inch", pattern: /13\s*인치|13\s*형|12\.9\s*인치|13"|13″|에어\s*13\b|에어13\b|\bair\s*13\b|아이패드\s*13\b/i },
      { label: "cellular_variant", pattern: /셀룰러|cellular|\blte\b|\b5g\b|유심|sim\s*트레이|esim/i },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품|개별)|필름\s*(?:만|단품)|키보드\s*만|펜슬\s*만|어댑터\s*만|충전기\s*만/i },
      { label: "case_or_smart_folio_listing", pattern: /(?:스마트\s*폴리오|스마트\s*커버|폴리오\s*케이스).{0,8}판매|매직\s*키보드\s*판매/i },
      { label: "broken_or_parts_only", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품/i },
      { label: "buying_post", pattern: /매입|삽니다|구매\s*합니다|구매합니다|사요|구해요/ },
      { label: "ipad_pro_or_mini", pattern: /아이패드\s*프로|ipad\s*pro|아이패드\s*미니|ipad\s*mini/i },
    ],
  },

  sony_wh1000xm4: {
    laneKey: "sony_wh1000xm4",
    category: "headphone",
    queries: [
      "wh-1000xm4",
      "wh1000xm4",
      "소니 1000xm4",
      "sony xm4",
      "소니 xm4",
      "1000xm4",
    ],
    pages: 5,
    targetParseReady: 200,
    priceMin: 90_000,
    priceMax: 450_000,
    acceptAll: [],
    acceptAnyOf: [[/1000\s*xm4|wh\s*-?\s*1000\s*xm4|\bxm4\b/i]],
    reject: [],
    rejectLabelled: [
      { label: "wrong_gen_xm3", pattern: /1000\s*xm3|wh\s*-?\s*1000\s*xm3|\bxm3\b/i },
      { label: "wrong_gen_xm5", pattern: /1000\s*xm5|wh\s*-?\s*1000\s*xm5|\bxm5\b/i },
      { label: "wrong_gen_xm6", pattern: /1000\s*xm6|\bxm6\b/i },
      { label: "case_only", pattern: /케이스\s*(?:만|단품|개별)|하드\s*케이스\s*만|파우치\s*만|보관\s*케이스\s*만/ },
      { label: "earpad_only", pattern: /이어\s*패드(?:\s*만|\s*교체|\s*단품)?|패드\s*교체용|쿠션\s*교체|패드만\s*판매/ },
      { label: "charger_or_cable_only", pattern: /충전기\s*만|케이블\s*만|usb\s*케이블\s*만|어댑터\s*만/i },
      { label: "parts_only", pattern: /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "wrong_product_neckband", pattern: /넥밴드|wi\s*-?\s*c\d{3}|sp\s*510/i },
      { label: "wrong_product_earbuds", pattern: /무선\s*이어폰|이어버드|wf\s*-?\s*1000|linkbuds/i },
      { label: "non_sony_clone", pattern: /짝퉁|가품|복제품|레플리카/ },
      { label: "broken", pattern: /고장|불량\s*품|파손\s*품|작동\s*안\s*됨|소리\s*안\s*나/ },
    ],
  },

  sony_wh_ch520: {
    laneKey: "sony_wh_ch520",
    category: "headphone",
    queries: [
      "소니 wh-ch520",
      "wh-ch520",
      "wh ch520",
      "whch520",
      "소니 ch520",
      "sony ch520",
      "sony wh-ch520",
      "sony wh ch520",
      "ch520",
      "소니 헤드폰 ch520",
      "소니 블루투스 헤드폰 ch520",
      "소니 무선헤드폰 ch520",
      "wh ch 520",
    ],
    pages: 10,
    targetParseReady: 200,
    priceMin: 20_000,
    priceMax: 120_000,
    acceptAll: [/소니|sony/i],
    acceptAnyOf: [[/wh\s*-?\s*ch\s*520|whch520|\bch\s*520\b/i]],
    reject: [],
    rejectLabelled: [
      { label: "wrong_model_ch700n", pattern: /wh\s*-?\s*ch\s*700n|whch700n|\bch\s*700n\b/i },
      { label: "wrong_model_ch710n", pattern: /wh\s*-?\s*ch\s*710n|whch710n|\bch\s*710n\b/i },
      { label: "wrong_model_ch500", pattern: /wh\s*-?\s*ch\s*500\b|whch500|\bch\s*500\b/i },
      { label: "wrong_model_ch720n", pattern: /wh\s*-?\s*ch\s*720n|whch720n|\bch\s*720n\b/i },
      { label: "wrong_model_xm_series", pattern: /1000\s*xm[3-6]|wh\s*-?\s*1000\s*xm[3-6]|\bxm[3-6]\b/i },
      { label: "wrong_model_ult", pattern: /ult\s*900n|ult\s*wear|ultwear/i },
      { label: "wrong_model_linkbuds", pattern: /linkbuds|링크\s*버즈/i },
      { label: "wrong_model_wf_earbuds", pattern: /\bwf\s*-?\s*\d{3,4}|무선\s*이어폰|이어버드/i },
      { label: "case_only", pattern: /케이스\s*(?:만|단품|개별)|하드\s*케이스\s*만|파우치\s*만|보관\s*케이스\s*만/ },
      { label: "earpad_only", pattern: /이어\s*패드(?:\s*만|\s*교체|\s*단품)?|패드\s*교체용|쿠션\s*교체|패드만\s*판매/ },
      { label: "charger_or_cable_only", pattern: /충전기\s*만|케이블\s*만|usb\s*케이블\s*만|어댑터\s*만/i },
      { label: "parts_only", pattern: /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "non_sony_clone", pattern: /짝퉁|가품|복제품|레플리카/ },
      { label: "broken", pattern: /고장|불량\s*품|파손\s*품|작동\s*안\s*됨|소리\s*안\s*나/ },
    ],
  },

  macbook_air_m3_13_256: {
    laneKey: "macbook_air_m3_13_256",
    category: "laptop",
    queries: [
      "맥북 에어 m3 13",
      "맥북에어 m3 13",
      "macbook air m3 13",
      "macbook air m3 13인치 256",
      "맥북 에어 m3 256",
      "맥북에어 m3 256",
      "macbook air m3 256",
      "맥북 에어 m3",
      "맥북에어 m3",
      "macbook air m3",
      "맥북 m3 13",
      "맥북에어m3",
      "맥북 에어 m3 8gb",
      "macbook air m3 8gb",
    ],
    pages: 10,
    targetParseReady: 200,
    priceMin: 800_000,
    priceMax: 1_900_000,
    acceptAll: [/맥북|macbook/i],
    acceptAnyOf: [
      [/에어|air/i],
      [/\bm3\b/i],
      [/13\s*인치|13\s*형|13"|13″|\b13\b/i],
    ],
    reject: [],
    rejectLabelled: [
      { label: "wrong_chip_m1", pattern: /\bm1\b|m1\s*칩/i },
      { label: "wrong_chip_m2", pattern: /\bm2\b|m2\s*칩/i },
      { label: "wrong_chip_m4", pattern: /\bm4\b|m4\s*칩/i },
      { label: "wrong_size_15", pattern: /15\s*인치|15\s*형|15"/ },
      { label: "wrong_model_macbook_pro", pattern: /맥북\s*프로|macbook\s*pro/i },
      { label: "wrong_ram_16gb", pattern: /(?:^|[^0-9])16\s*(?:gb|기가)\b/i },
      { label: "wrong_ram_24gb", pattern: /(?:^|[^0-9])24\s*(?:gb|기가)\b/i },
      { label: "wrong_storage_512", pattern: /(?:^|[^0-9])512\s*(?:gb|기가)?\b/i },
      { label: "wrong_storage_1tb", pattern: /\b1\s*tb\b|1\s*테라/i },
      { label: "wrong_storage_2tb", pattern: /\b2\s*tb\b|2\s*테라/i },
      { label: "broken_or_parts_only", pattern: /액정\s*만|메인\s*보드|로직\s*보드|상판\s*만|하판\s*만|부품\s*용|부품용|키보드\s*만|배터리\s*만|침수/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
    ],
  },

  bose_qc_ultra: {
    laneKey: "bose_qc_ultra",
    category: "headphone",
    queries: [
      "보스 quietcomfort ultra",
      "bose qc ultra",
      "보스 qc 울트라",
      "bose quietcomfort ultra 헤드폰",
      "보스 울트라 헤드폰",
      "bose quietcomfort ultra headphone",
      "보스 qc ultra 헤드폰",
      "bose qcultra",
    ],
    pages: 8,
    targetParseReady: 200,
    priceMin: 200_000,
    priceMax: 700_000,
    acceptAll: [/보스|bose/i],
    acceptAnyOf: [
      [/quietcomfort\s*ultra|qc\s*ultra|qc\s*울트라|quietcomfort\s*울트라|qcultra/i],
      [/헤드폰|headphone|헤드셋/i],
    ],
    reject: [],
    rejectLabelled: [
      { label: "wrong_model_qc35", pattern: /\bqc\s*35\b|quietcomfort\s*35/i },
      { label: "wrong_model_qc45", pattern: /\bqc\s*45\b|quietcomfort\s*45/i },
      { label: "wrong_model_qc15", pattern: /\bqc\s*15\b|quietcomfort\s*15/i },
      { label: "wrong_model_qc20", pattern: /\bqc\s*20\b|quietcomfort\s*20/i },
      { label: "wrong_product_earbuds", pattern: /quietcomfort\s*earbuds|qc\s*이어버드|qc\s*earbuds|이어버드|earbuds|무선\s*이어폰/i },
      { label: "wrong_product_soundlink", pattern: /soundlink|사운드링크|사운드\s*링크/i },
      { label: "case_or_pouch_only", pattern: /케이스\s*(?:만|단품|개별)|파우치\s*만|하드\s*케이스\s*만|보관\s*케이스\s*만/ },
      { label: "earcushion_only", pattern: /이어\s*쿠션(?:\s*만|\s*교체|\s*단품)?|쿠션\s*교체|쿠션만\s*판매|이어\s*패드(?:\s*만|\s*교체|\s*단품)?/ },
      { label: "charger_or_cable_only", pattern: /충전기\s*만|케이블\s*만|usb\s*케이블\s*만|어댑터\s*만/i },
      { label: "parts_only", pattern: /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "non_bose_clone", pattern: /짝퉁|가품|복제품|레플리카/ },
      { label: "broken", pattern: /고장|불량\s*품|파손\s*품|작동\s*안\s*됨|소리\s*안\s*나/ },
    ],
  },

  airpods_max_usbc: {
    laneKey: "airpods_max_usbc",
    category: "earphone",
    queries: [
      "에어팟 맥스 usb",
      "에어팟맥스 usb-c",
      "airpods max usb-c",
      "airpods max usbc",
      "에어팟맥스 2024",
      "에어팟 맥스 신형",
      "에어팟맥스 c타입",
    ],
    pages: 8,
    targetParseReady: 200,
    priceMin: 250_000,
    priceMax: 850_000,
    acceptAll: [/에어\s*팟|airpods/i, /맥스|max/i],
    acceptAnyOf: [[/usb\s*-?\s*c|usbc|c\s*타입|타입\s*c|씨\s*타입/i]],
    reject: [],
    rejectLabelled: [
      { label: "wrong_connector_lightning", pattern: /라이트닝|lightning/i },
      { label: "case_only", pattern: /케이스\s*(?:만|단품|개별)|하드\s*케이스\s*만|보관\s*케이스\s*만|스마트\s*케이스\s*만/ },
      { label: "earcushion_only", pattern: /이어\s*쿠션(?:\s*만|\s*교체|\s*단품)?|이어\s*패드(?:\s*만|\s*교체|\s*단품)?|쿠션\s*교체|쿠션만\s*판매|패드만\s*판매/ },
      { label: "pouch_only", pattern: /파우치\s*(?:만|단품|개별)|파우치만\s*판매/ },
      { label: "headband_or_canopy_only", pattern: /헤드\s*밴드\s*만|헤드밴드\s*교체|헤드\s*쿠션\s*만|캐노피\s*만/ },
      { label: "parts_only", pattern: /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품/ },
      { label: "charger_or_cable_only", pattern: /충전기\s*만|케이블\s*만|어댑터\s*만|usb\s*케이블\s*만/i },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "non_apple_clone", pattern: /짝퉁|가품|복제품|레플리카/ },
      { label: "broken", pattern: /고장|불량\s*품|파손\s*품|작동\s*안\s*됨|소리\s*안\s*나/ },
      { label: "wrong_product_airpods_pro_or_2_3_4", pattern: /에어\s*팟\s*프로|airpods\s*pro|에어\s*팟\s*[234]\s*세대|airpods\s*[234]/i },
    ],
  },

  iphone_15_pro_128gb_self: {
    laneKey: "iphone_15_pro_128gb_self",
    category: "smartphone",
    queries: [
      "아이폰 15 프로 128",
      "아이폰15프로 128",
      "iphone 15 pro 128",
      "iphone 15 pro 128 자급제",
      "아이폰 15 pro 128 자급제",
      "아이폰 15 pro 자급제",
      "아이폰 15 프로 블랙티타늄",
      "아이폰 15 프로 화이트티타늄",
      "아이폰 15 프로 블루티타늄",
      "아이폰 15 프로 내추럴티타늄",
      "아이폰 15 프로 128gb",
      "아이폰15프로 128gb",
    ],
    pages: 6,
    targetParseReady: 200,
    priceMin: 600_000,
    priceMax: 1_700_000,
    acceptAll: [/아이폰\s*15\s*프로|iphone\s*15\s*pro/i],
    acceptAnyOf: [],
    reject: [],
    rejectLabelled: [
      { label: "wrong_model_pro_max", pattern: /프로\s*맥스|promax|pro\s*max|프맥/i },
      { label: "wrong_model_15_base_or_plus", pattern: /아이폰\s*15\s*플러스|iphone\s*15\s*plus|아이폰\s*15\s*기본/i },
      { label: "wrong_model_14", pattern: /아이폰\s*14|iphone\s*14/i },
      { label: "wrong_model_16", pattern: /아이폰\s*16|iphone\s*16/i },
      { label: "wrong_storage_64", pattern: /(?:^|[^0-9])64\s*(?:gb|기가)\b/i },
      { label: "wrong_storage_256", pattern: /(?:^|[^0-9])256\s*(?:gb|기가)?\b/i },
      { label: "wrong_storage_512_1tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|1\s*테라/i },
      { label: "carrier_skt", pattern: /\bskt\b|sk\s*텔레콤|에스케이\s*텔레콤/ },
      { label: "carrier_kt", pattern: /(?:^|\s)kt\s*(?:완납|개통|약정|이동|번호|요금|승계|유심)|케이티\s*개통|kt\s*전용/i },
      { label: "carrier_lg", pattern: /\blgu\+?|\blg\s*u\+?|유플\s*러스|엘지\s*유플|엘지유플|lg\s*전용/i },
      { label: "carrier_locked_generic", pattern: /통신사\s*(?:개통|이동|전용|확정)|번호\s*이동|약정\s*(?:승계|진행|걸|남)|선택\s*약정|공시\s*지원|완납\s*폰|완납폰|제휴\s*카드|할부\s*승계|할부\s*원금|할부\s*잔여|개통\s*후|확정\s*기변|확정기변/ },
      { label: "broken_or_parts", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품|침수|배터리\s*교체\s*요망/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "refurbished_only", pattern: /리퍼\s*폰|리퍼폰|리퍼\s*제품|리퍼\s*수령/ },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품)|필름\s*(?:만|단품)|충전기\s*만|보호\s*필름\s*만/ },
    ],
  },

  macbook_pro_14_m3_18_512: {
    laneKey: "macbook_pro_14_m3_18_512",
    category: "laptop",
    queries: [
      "맥북 프로 14 m3 18 512",
      "맥북프로 14 m3",
      "macbook pro 14 m3",
      "맥북 프로 14인치 m3",
      "macbook pro 14 m3 18gb 512gb",
      "맥북 프로 m3 14",
    ],
    pages: 10,
    targetParseReady: 200,
    priceMin: 1_500_000,
    priceMax: 3_000_000,
    acceptAll: [/맥북|macbook/i, /프로|pro/i, /m3\s*(?:pro|max)|\bm3\b/i],
    acceptAnyOf: [[/14\s*인치|14\s*형|\b14"|14″|\b14\b/i]],
    reject: [],
    rejectLabelled: [
      { label: "wrong_chip_m1", pattern: /\bm1\b|m1\s*(?:pro|max|칩)|\(m1\)/i },
      { label: "wrong_chip_m2", pattern: /\bm2\b|m2\s*(?:pro|max|칩)|\(m2\)/i },
      { label: "wrong_chip_m4", pattern: /\bm4\b|m4\s*(?:pro|max|칩)|\(m4\)/i },
      { label: "wrong_size_16", pattern: /16\s*인치|16\s*형|\b16"|16″/i },
      { label: "wrong_model_air", pattern: /에어|\bair\b/i },
      { label: "wrong_ram_8", pattern: /(?:^|[^0-9])8\s*(?:gb|기가)\b|8\s*gb\s*ram/i },
      { label: "wrong_ram_16", pattern: /(?:^|[^0-9])16\s*(?:gb|기가)\b/i },
      { label: "wrong_ram_24", pattern: /(?:^|[^0-9])24\s*(?:gb|기가)\b/i },
      { label: "wrong_ram_36", pattern: /(?:^|[^0-9])36\s*(?:gb|기가)\b/i },
      { label: "wrong_storage_256", pattern: /(?:^|[^0-9])256\s*(?:gb|기가)\b/i },
      { label: "wrong_storage_1tb_2tb", pattern: /\b1\s*tb\b|\b2\s*tb\b|1\s*테라|2\s*테라/i },
      { label: "parts_only", pattern: /액정\s*만|메인보드|로직보드|상판|하판|배터리\s*만|키보드\s*만|부품\s*용|부품용/ },
      { label: "broken_or_water", pattern: /고장|침수|파손\s*품|작동\s*불량/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
    ],
  },

  iphone_14_pro_128gb_self: {
    laneKey: "iphone_14_pro_128gb_self",
    category: "smartphone",
    queries: [
      "아이폰 14 프로 128 자급제",
      "아이폰14프로 128 자급제",
      "iphone 14 pro 128 자급제",
      "아이폰 14 프로 자급제",
      "아이폰 14 프로 128",
      "아이폰14프로 128",
      "iphone 14 pro 128",
      "아이폰 14 프로 128gb",
      "아이폰14프로 128gb",
    ],
    pages: 8,
    targetParseReady: 200,
    priceMin: 350_000,
    priceMax: 1_100_000,
    acceptAll: [/아이폰\s*14\s*프로|iphone\s*14\s*pro/i],
    acceptAnyOf: [],
    reject: [],
    rejectLabelled: [
      { label: "wrong_model_pro_max", pattern: /프로\s*맥스|promax|pro\s*max|프맥/i },
      { label: "wrong_model_14_base_or_plus", pattern: /아이폰\s*14\s*플러스|iphone\s*14\s*plus|아이폰\s*14\s*기본/i },
      { label: "wrong_model_13", pattern: /아이폰\s*13|iphone\s*13/i },
      { label: "wrong_model_15", pattern: /아이폰\s*15|iphone\s*15/i },
      { label: "wrong_storage_64", pattern: /(?:^|[^0-9])64\s*(?:gb|기가)\b/i },
      { label: "wrong_storage_256", pattern: /(?:^|[^0-9])256\s*(?:gb|기가)?\b/i },
      { label: "wrong_storage_512_1tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|1\s*테라/i },
      { label: "carrier_skt", pattern: /\bskt\b|sk\s*텔레콤|에스케이\s*텔레콤/ },
      { label: "carrier_kt", pattern: /(?:^|\s)kt\s*(?:완납|개통|약정|이동|번호|요금|승계|유심)|케이티\s*개통|kt\s*전용/i },
      { label: "carrier_lg", pattern: /\blgu\+?|\blg\s*u\+?|유플\s*러스|엘지\s*유플|엘지유플|lg\s*전용/i },
      { label: "carrier_locked_generic", pattern: /통신사\s*(?:개통|이동|전용|확정)|번호\s*이동|약정\s*(?:승계|진행|걸|남)|선택\s*약정|공시\s*지원|완납\s*폰|완납폰|제휴\s*카드|할부\s*승계|할부\s*원금|할부\s*잔여|개통\s*후|확정\s*기변|확정기변/ },
      { label: "broken_or_parts", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품|침수|배터리\s*교체\s*요망/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "refurbished_only", pattern: /리퍼\s*폰|리퍼폰|리퍼\s*제품|리퍼\s*수령/ },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품)|필름\s*(?:만|단품)|충전기\s*만|보호\s*필름\s*만/ },
    ],
  },

  iphone_16_pro_128gb_self: {
    laneKey: "iphone_16_pro_128gb_self",
    category: "smartphone",
    queries: [
      "아이폰 16 프로 128 자급제",
      "아이폰16프로 128 자급제",
      "iphone 16 pro 128 자급제",
      "아이폰 16 프로 자급제",
    ],
    pages: 10,
    targetParseReady: 200,
    priceMin: 700_000,
    priceMax: 1_700_000,
    acceptAll: [/아이폰\s*16\s*(?:프로|pro)|iphone\s*16\s*(?:pro|프로)/i],
    acceptAnyOf: [],
    reject: [],
    rejectLabelled: [
      { label: "wrong_model_pro_max", pattern: /프로\s*맥스|promax|pro\s*max|프맥/i },
      { label: "wrong_model_16_base_or_plus", pattern: /아이폰\s*16\s*플러스|iphone\s*16\s*plus|아이폰\s*16\s*기본|아이폰\s*16e\b|iphone\s*16e\b/i },
      { label: "wrong_model_15", pattern: /아이폰\s*15(?!\d)|iphone\s*15(?!\d)/i },
      { label: "wrong_model_17", pattern: /아이폰\s*17(?!\d)|iphone\s*17(?!\d)/i },
      { label: "wrong_storage_256", pattern: /(?:^|[^0-9])256\s*(?:gb|기가)?\b/i },
      { label: "wrong_storage_512_1tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|1\s*테라/i },
      { label: "carrier_skt", pattern: /\bskt\b|sk\s*텔레콤|에스케이\s*텔레콤/ },
      { label: "carrier_kt", pattern: /(?:^|\s)kt\s*(?:완납|개통|약정|이동|번호|요금|승계|유심)|케이티\s*개통|kt\s*전용/i },
      { label: "carrier_lg", pattern: /\blgu\+?|\blg\s*u\+?|유플\s*러스|엘지\s*유플|엘지유플|lg\s*전용/i },
      { label: "carrier_locked_generic", pattern: /통신사\s*(?:개통|이동|전용|확정)|번호\s*이동|약정\s*(?:승계|진행|걸|남)|선택\s*약정|공시\s*지원|완납\s*폰|완납폰|제휴\s*카드|할부\s*승계|할부\s*원금|할부\s*잔여|개통\s*후|확정\s*기변|확정기변/ },
      { label: "broken_or_parts", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품|침수|배터리\s*교체\s*요망/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "refurbished_only", pattern: /리퍼\s*폰|리퍼폰|리퍼\s*제품|리퍼\s*수령/ },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품)|필름\s*(?:만|단품)|충전기\s*만|보호\s*필름\s*만/ },
    ],
  },

  galaxy_s25_ultra_256_self: {
    laneKey: "galaxy_s25_ultra_256_self",
    category: "smartphone",
    queries: [
      "갤럭시 s25 울트라 256 자급제",
      "갤s25울트라 256 자급제",
      "galaxy s25 ultra 256 자급제",
      "s25 울트라 자급제 256",
      "갤럭시 s25 울트라 256",
      "갤럭시s25울트라 256",
      "galaxy s25 ultra 256",
      "갤럭시 s25 울트라 자급제",
      "s25 ultra 256 self",
      "갤럭시 s25 울트라 256gb",
      "s25울트라 256 자급제",
      "s25 ultra 256",
    ],
    pages: 6,
    targetParseReady: 200,
    priceMin: 600_000,
    priceMax: 1_900_000,
    acceptAll: [/갤럭시\s*s25\s*울트라|galaxy\s*s25\s*ultra|s25\s*ultra|s25\s*울트라/i],
    acceptAnyOf: [],
    reject: [],
    rejectLabelled: [
      { label: "wrong_model_s26", pattern: /갤럭시\s*s26|galaxy\s*s26|\bs26\s*(?:울트라|ultra|플러스|plus|기본|\+)?/i },
      { label: "wrong_model_s24", pattern: /갤럭시\s*s24|galaxy\s*s24|\bs24\s*(?:울트라|ultra|플러스|plus|기본|\+)?/i },
      { label: "wrong_model_s23", pattern: /갤럭시\s*s23|galaxy\s*s23|\bs23\s*(?:울트라|ultra|플러스|plus|기본|\+)?/i },
      { label: "wrong_model_plus_or_base", pattern: /s25\s*(?:플러스|plus|\+)|갤럭시\s*s25\s*플러스|galaxy\s*s25\s*plus|s25\s*(?:기본|일반|basic)/i },
      { label: "wrong_storage_512_1tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|1\s*테라/i },
      { label: "carrier_skt", pattern: /\bskt\b\s*(?:완납|개통|약정|이동|승계|전용)|skt\s*완납폰|skt\s*전용/i },
      { label: "carrier_kt", pattern: /(?:^|\s)kt\s*(?:완납|개통|약정|이동|승계|전용)|케이티\s*개통|kt\s*완납폰/i },
      { label: "carrier_lg", pattern: /\blgu\+|\blg\s*u\+|유플\s*러스|엘지\s*유플|엘지유플|lg\s*전용/i },
      { label: "carrier_locked_generic", pattern: /통신사\s*개통|약정\s*승계|완납\s*폰|완납폰/ },
      { label: "broken_or_parts", pattern: /액정\s*파손|부품\s*용|부품용/ },
      { label: "buying_post", pattern: /매입(?!\s*도)|삽니다|구해요|구매\s*합니다|구매합니다|구합니다/ },
      { label: "refurbished_only", pattern: /리퍼\s*폰|리퍼폰|리퍼\s*제품|리퍼\s*수령|센터\s*리퍼/ },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품)|필름\s*(?:만|단품)|충전기\s*만|보호\s*필름\s*만|s\s*펜\s*만|s펜만|어댑터\s*만/ },
      { label: "lost_or_locked", pattern: /분실\s*폰|분실폰|잠김|락걸림|아이디\s*잠금|구글\s*계정\s*잠금|분실\s*보상폰|분실보상폰/ },
    ],
  },

  airpods_pro_3: {
    laneKey: "airpods_pro_3",
    category: "earphone",
    queries: [
      "에어팟 프로 3",
      "에어팟프로 3",
      "에어팟 프로 3세대",
      "에어팟프로3",
      "airpods pro 3",
      "airpods pro 3rd",
      "에어팟 프로3",
      "에어팟 프로 3 2025",
      "ap pro 3",
    ],
    pages: 8,
    targetParseReady: 200,
    priceMin: 200_000,
    priceMax: 450_000,
    acceptAll: [/에어\s*팟|airpods/i, /프로|pro/i],
    acceptAnyOf: [[/3\s*세대|프로\s*3\b|pro\s*3\b|\b3rd\b/i]],
    reject: [],
    rejectLabelled: [
      { label: "wrong_gen_1", pattern: /1\s*세대|\b1st\b|프로\s*1\b|pro\s*1\b/i },
      { label: "wrong_gen_2", pattern: /2\s*세대|\b2nd\b|프로\s*2\b|pro\s*2\b/i },
      { label: "wrong_model_max", pattern: /맥스|\bmax\b/i },
      { label: "wrong_connector_lightning", pattern: /라이트닝|lightning/i },
      { label: "case_only", pattern: /케이스\s*(?:만|단품|개별)|하드\s*케이스\s*만|실리콘\s*케이스\s*만|보관\s*케이스\s*만/ },
      { label: "tip_only", pattern: /이어\s*팁\s*(?:만|단품|교체)|폼\s*팁\s*만|팁만\s*판매|이어팁\s*세트\s*만/ },
      { label: "charger_or_cable_only", pattern: /충전기\s*만|케이블\s*만|어댑터\s*만|usb\s*케이블\s*만|무선\s*충전기\s*만/i },
      { label: "parts_only", pattern: /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "non_apple_clone", pattern: /짝퉁|가품|복제품|레플리카/ },
      { label: "broken", pattern: /고장|불량\s*품|파손\s*품|작동\s*안\s*됨|소리\s*안\s*나/ },
    ],
  },

  galaxy_s24_ultra_256_self: {
    laneKey: "galaxy_s24_ultra_256_self",
    category: "smartphone",
    queries: [
      "갤럭시 s24 울트라 256 자급제",
      "galaxy s24 ultra 256 자급제",
      "s24 울트라 자급제 256",
      "갤럭시 s24 울트라 256",
      "galaxy s24 ultra 256",
      "갤럭시 s24 울트라 자급제",
      "s24 ultra 256",
    ],
    pages: 6,
    targetParseReady: 200,
    priceMin: 600_000,
    priceMax: 1_700_000,
    acceptAll: [/갤럭시\s*s24\s*울트라|galaxy\s*s24\s*ultra|s24\s*ultra|s24\s*울트라/i],
    acceptAnyOf: [],
    reject: [],
    rejectLabelled: [
      { label: "wrong_model_s25", pattern: /갤럭시\s*s25|galaxy\s*s25|\bs25\s*(?:울트라|ultra|플러스|plus|기본|\+)?/i },
      { label: "wrong_model_s23", pattern: /갤럭시\s*s23|galaxy\s*s23|\bs23\s*(?:울트라|ultra|플러스|plus|기본|\+)?/i },
      { label: "wrong_model_s22", pattern: /갤럭시\s*s22|galaxy\s*s22|\bs22\s*(?:울트라|ultra|플러스|plus|기본|\+)?/i },
      { label: "wrong_model_plus_or_base", pattern: /s24\s*(?:플러스|plus|\+)|갤럭시\s*s24\s*플러스|galaxy\s*s24\s*plus|s24\s*(?:기본|일반|basic)/i },
      { label: "wrong_storage_512_1tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|1\s*테라/i },
      { label: "carrier_skt", pattern: /\bskt\b\s*(?:완납|개통|약정|이동|승계|전용)|skt\s*완납폰|skt\s*전용/i },
      { label: "carrier_kt", pattern: /(?:^|\s)kt\s*(?:완납|개통|약정|이동|승계|전용)|케이티\s*개통|kt\s*완납폰/i },
      { label: "carrier_lg", pattern: /\blgu\+|\blg\s*u\+|유플\s*러스|엘지\s*유플|엘지유플|lg\s*전용/i },
      { label: "carrier_locked_generic", pattern: /통신사\s*개통|약정\s*승계|완납\s*폰|완납폰/ },
      { label: "broken_or_parts", pattern: /액정\s*파손|부품\s*용|부품용/ },
      { label: "buying_post", pattern: /매입(?!\s*도)|삽니다|구해요|구매\s*합니다|구매합니다|구합니다/ },
      { label: "refurbished_only", pattern: /리퍼\s*폰|리퍼폰|리퍼\s*제품|리퍼\s*수령|센터\s*리퍼/ },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품)|필름\s*(?:만|단품)|충전기\s*만|보호\s*필름\s*만|s\s*펜\s*만|s펜만|어댑터\s*만/ },
      { label: "lost_or_locked", pattern: /분실\s*폰|분실폰|잠김|락걸림|아이디\s*잠금|구글\s*계정\s*잠금|분실\s*보상폰|분실보상폰/ },
    ],
  },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function argValue(name: string, fallback?: string): string | undefined {
  for (const arg of process.argv) {
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function normalize(text: string): string {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^0-9a-z가-힣./\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Bunjang API ──────────────────────────────────────────────────────────────

type SearchHit = {
  pid: string;
  name: string;
  price: number;
  numFaved: number;
  query: string;
};

async function searchPage(query: string, page: number): Promise<SearchHit[]> {
  const url = new URL("https://api.bunjang.co.kr/api/1/find_v2.json");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", String(page));
  url.searchParams.set("n", "40");
  url.searchParams.set("stat_device", "w");
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const data = (await res.json()) as { list?: unknown[] };
  return (data.list ?? [])
    .map((raw): SearchHit | null => {
      const item = raw as Record<string, unknown>;
      const pid = String(item.pid ?? "");
      if (!pid) return null;
      return {
        pid,
        name: String(item.name ?? ""),
        price: toInt(item.price),
        numFaved: toInt(item.num_faved),
        query,
      };
    })
    .filter((x): x is SearchHit => x !== null);
}

type Detail = {
  description: string;
  condition: string;
  saleStatus: string;
  isProshop: boolean;
  salesCount: number;
  reviewRating: number | null;
  reviewCount: number;
};

async function fetchDetail(pid: string): Promise<Detail | null> {
  const url = `https://api.bunjang.co.kr/api/pms/v1/products/${pid}/detail/web`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: { product?: Record<string, unknown>; shop?: Record<string, unknown> };
  };
  const product = json?.data?.product ?? {};
  const shop = json?.data?.shop ?? {};
  return {
    description: String(product.description ?? "").slice(0, 1200),
    condition: String(product.condition ?? ""),
    saleStatus: String(product.saleStatus ?? ""),
    isProshop: shop.proshop === true || shop.isOfficialSeller === true,
    salesCount: toInt(shop.salesCount),
    reviewRating: shop.reviewRating == null ? null : Number(shop.reviewRating),
    reviewCount: toInt(shop.reviewCount),
  };
}

// ─── Filter ──────────────────────────────────────────────────────────────────

type Sample = SearchHit & Detail;

type FilterResult =
  | { parseReady: true; reasons: [] }
  | { parseReady: false; reasons: string[] };

function evaluateLane(config: LaneConfig, sample: Sample): FilterResult {
  const text = normalize(`${sample.name}\n${sample.description}`);
  const reasons: string[] = [];

  if (sample.price > 0) {
    if (sample.price < config.priceMin) reasons.push("price_too_low");
    if (sample.price > config.priceMax) reasons.push("price_too_high");
  }

  for (const pattern of config.acceptAll) {
    if (!pattern.test(text)) reasons.push(`missing_${patternLabel(pattern)}`);
  }

  for (const group of config.acceptAnyOf) {
    if (!group.some((pattern) => pattern.test(text))) {
      reasons.push(`missing_any_${group.map(patternLabel).join("_or_")}`);
    }
  }

  for (const rule of config.rejectLabelled) {
    if (rule.pattern.test(text)) reasons.push(`reject_${rule.label}`);
  }

  return reasons.length === 0
    ? { parseReady: true, reasons: [] }
    : { parseReady: false, reasons };
}

function patternLabel(pattern: RegExp): string {
  return pattern.source.slice(0, 24).replace(/[^a-z0-9가-힣]+/gi, "_");
}

// ─── Collection ──────────────────────────────────────────────────────────────

async function collectCandidates(config: LaneConfig): Promise<SearchHit[]> {
  const byPid = new Map<string, SearchHit>();
  for (const query of config.queries) {
    for (let page = 0; page < config.pages; page++) {
      const items = await searchPage(query, page);
      for (const item of items) {
        if (!byPid.has(item.pid)) byPid.set(item.pid, item);
      }
      await sleep(150);
      if (items.length === 0) break;
    }
    process.stdout.write(`  query "${query}" → cumulative ${byPid.size} unique pids\n`);
  }
  return [...byPid.values()];
}

async function fetchAllDetails(
  hits: SearchHit[],
  onProgress: (done: number, total: number, ready: number) => void,
  config: LaneConfig,
): Promise<{ samples: Sample[]; evaluations: { sample: Sample; result: FilterResult }[] }> {
  const samples: Sample[] = [];
  const evaluations: { sample: Sample; result: FilterResult }[] = [];
  let readyCount = 0;
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i];
    const detail = await fetchDetail(hit.pid);
    await sleep(180);
    if (!detail) continue;
    const sample: Sample = { ...hit, ...detail };
    const result = evaluateLane(config, sample);
    samples.push(sample);
    evaluations.push({ sample, result });
    if (result.parseReady) readyCount++;
    if ((i + 1) % 25 === 0) onProgress(i + 1, hits.length, readyCount);
    if (readyCount >= config.targetParseReady && i >= 220) break;
  }
  return { samples, evaluations };
}

// ─── Output ──────────────────────────────────────────────────────────────────

type RejectStats = { reason: string; count: number };

function tallyRejects(
  evaluations: { sample: Sample; result: FilterResult }[],
): RejectStats[] {
  const counts = new Map<string, number>();
  for (const { result } of evaluations) {
    if (result.parseReady) continue;
    for (const reason of result.reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

async function writeLaneOutputs(
  config: LaneConfig,
  evaluations: { sample: Sample; result: FilterResult }[],
  generatedAt: string,
): Promise<{ parseReady: number; rejected: number; total: number }> {
  const laneDir = path.join(outBase, config.laneKey);
  await mkdir(laneDir, { recursive: true });

  const passed = evaluations.filter((e) => e.result.parseReady);
  const rejected = evaluations.filter((e) => !e.result.parseReady);

  const samples = evaluations.map((e) => ({
    pid: e.sample.pid,
    name: e.sample.name,
    price: e.sample.price,
    num_faved: e.sample.numFaved,
    query: e.sample.query,
    description: e.sample.description,
    condition: e.sample.condition,
    sale_status: e.sample.saleStatus,
    is_proshop: e.sample.isProshop,
    sales_count: e.sample.salesCount,
    review_rating: e.sample.reviewRating,
    review_count: e.sample.reviewCount,
    parse_ready: e.result.parseReady,
    reject_reasons: e.result.parseReady ? [] : e.result.reasons,
  }));

  await writeFile(path.join(laneDir, "samples.json"), JSON.stringify(samples, null, 2));

  const rejectStats = tallyRejects(evaluations);
  const summary = {
    version: 1,
    lane_key: config.laneKey,
    category: config.category,
    generated_at: generatedAt,
    method: "mine-narrow-lane-v1",
    queries: config.queries,
    pages: config.pages,
    price_range_krw: [config.priceMin, config.priceMax],
    target_parse_ready: config.targetParseReady,
    total_fetched: evaluations.length,
    parse_ready_count: passed.length,
    rejected_count: rejected.length,
    target_reached: passed.length >= config.targetParseReady,
    reject_breakdown: rejectStats,
    accept_rules: {
      accept_all: config.acceptAll.map((p) => p.source),
      accept_any_of: config.acceptAnyOf.map((group) => group.map((p) => p.source)),
    },
    reject_rules: config.rejectLabelled.map((r) => ({ label: r.label, pattern: r.pattern.source })),
  };
  await writeFile(path.join(laneDir, "parse_summary.json"), JSON.stringify(summary, null, 2));

  const rejectedSamples = rejected.map((e) => ({
    pid: e.sample.pid,
    name: e.sample.name,
    price: e.sample.price,
    reject_reasons: e.result.reasons,
  }));
  await writeFile(path.join(laneDir, "rejected.json"), JSON.stringify(rejectedSamples, null, 2));

  const readySamples = passed.slice(0, config.targetParseReady).map((e) => ({
    pid: e.sample.pid,
    name: e.sample.name,
    price: e.sample.price,
    query: e.sample.query,
  }));
  await writeFile(path.join(laneDir, "parse_ready_sample.json"), JSON.stringify(readySamples, null, 2));

  const laneConfigDoc = {
    lane_key: config.laneKey,
    category: config.category,
    queries: config.queries,
    accept_all: config.acceptAll.map((p) => p.source),
    accept_any_of: config.acceptAnyOf.map((group) => group.map((p) => p.source)),
    reject_rules: config.rejectLabelled.map((r) => ({ label: r.label, pattern: r.pattern.source })),
    price_min_krw: config.priceMin,
    price_max_krw: config.priceMax,
  };
  await writeFile(path.join(laneDir, "lane_config.json"), JSON.stringify(laneConfigDoc, null, 2));

  return {
    parseReady: passed.length,
    rejected: rejected.length,
    total: evaluations.length,
  };
}

// ─── Entry ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const laneArg = argValue("--lane") as LaneKey | undefined;
  if (!laneArg || !LANES[laneArg]) {
    console.error("usage: mine-narrow-lane.ts --lane=<key>");
    console.error("available lanes:", Object.keys(LANES).join(", "));
    process.exit(1);
  }
  const config = LANES[laneArg];
  const pagesOverride = argValue("--pages");
  if (pagesOverride) config.pages = Number(pagesOverride);

  const generatedAt = new Date().toISOString();
  console.log(`[${config.laneKey}] mining narrow lane`);
  console.log(`  queries (${config.queries.length}): ${config.queries.join(" | ")}`);
  console.log(`  pages: ${config.pages}, target parse_ready: ${config.targetParseReady}`);

  const hits = await collectCandidates(config);
  console.log(`[${config.laneKey}] candidates: ${hits.length}`);

  const { evaluations } = await fetchAllDetails(
    hits,
    (done, total, ready) =>
      console.log(`  detail ${done}/${total} (parse_ready=${ready})`),
    config,
  );

  const stats = await writeLaneOutputs(config, evaluations, generatedAt);
  console.log(
    `[${config.laneKey}] done. total=${stats.total} parse_ready=${stats.parseReady} rejected=${stats.rejected}`,
  );
  if (stats.parseReady < config.targetParseReady) {
    console.warn(
      `  ⚠ parse_ready (${stats.parseReady}) below target (${config.targetParseReady}). Increase --pages or widen queries.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export { LANES, evaluateLane };
export type { LaneKey, LaneConfig, Sample };
