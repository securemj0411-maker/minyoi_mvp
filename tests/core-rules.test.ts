import assert from "node:assert/strict";
import test from "node:test";

import { buildCandidatePoolRows } from "@/lib/candidate-pool-builder";
import { CATALOG } from "@/lib/catalog";
import { parseGameConsoleListing } from "@/lib/game-console-parser";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import {
  analysisOutputChanged,
  listingOutputChanged,
  toListingOutputRows,
  toRankedAnalysisRows,
} from "@/lib/score-output-mapper";
import {
  shouldCoalesceActiveSeenOnlyTouch,
  shouldRefreshSearchSeller,
  splitActiveSeenOnlyTouches,
  splitActiveSeenOnlyTouchesByPoolProtection,
} from "@/lib/tick-pipeline";
import {
  computePoolConfidence,
  poolSkipReason,
} from "@/lib/pool-policy.mjs";
import { median, percentileRank, trimmedSellerMarket } from "@/lib/market-math";

test("earphone side-only unit is excluded as parts", () => {
  const result = classifyListing("에어팟 프로2 오른쪽 유닛 판매", "정상 작동합니다", 55_000);
  assert.equal(result.listingType, "parts");
});

test("manual sold-out wording is excluded before category-specific parsing", () => {
  const titleResult = classifyListing("에어팟 4세대 노캔 X 판매완료", "정상 작동합니다", 130_000);
  assert.equal(titleResult.listingType, "callout");

  const genericResult = classifyListing("애플워치 울트라2 거래완료", "", 650_000);
  assert.equal(genericResult.listingType, "callout");
});

test("search seller cache skips unchanged recent sellers", () => {
  const nowMs = Date.parse("2026-05-11T12:00:00.000Z");
  const oneHour = 60 * 60 * 1000;
  const threeHours = 3 * 60 * 60 * 1000;
  const row = {
    source: "bunjang",
    seller_uid: "123",
    is_proshop: false,
    source_json: { search: { bizseller: false } },
    last_seen_at: "2026-05-11T12:00:00.000Z",
    updated_at: "2026-05-11T12:00:00.000Z",
  };

  assert.equal(shouldRefreshSearchSeller(row, {
    seller_uid: "123",
    is_proshop: false,
    source_json: { search: { bizseller: false } },
    last_seen_at: "2026-05-11T11:30:00.000Z",
  }, nowMs, oneHour), false);

  assert.equal(shouldRefreshSearchSeller(row, {
    seller_uid: "123",
    is_proshop: false,
    source_json: { search: { bizseller: false } },
    last_seen_at: "2026-05-11T10:30:00.000Z",
  }, nowMs, oneHour), true);

  assert.equal(shouldRefreshSearchSeller(row, {
    seller_uid: "123",
    is_proshop: false,
    source_json: { search: { bizseller: false } },
    last_seen_at: "2026-05-11T10:30:00.000Z",
  }, nowMs, threeHours), false);

  assert.equal(shouldRefreshSearchSeller({ ...row, is_proshop: true }, {
    seller_uid: "123",
    is_proshop: false,
    source_json: { search: { bizseller: false } },
    last_seen_at: "2026-05-11T11:59:00.000Z",
  }, nowMs, threeHours), true);
});

test("raw active seen-only touch coalescing is a dry-run eligibility helper", () => {
  const nowMs = Date.parse("2026-05-11T12:00:00.000Z");
  const tenMinutes = 10 * 60 * 1000;

  assert.equal(shouldCoalesceActiveSeenOnlyTouch({
    last_seen_at: "2026-05-11T11:55:00.000Z",
  }, nowMs, tenMinutes), true);

  assert.equal(shouldCoalesceActiveSeenOnlyTouch({
    last_seen_at: "2026-05-11T11:45:00.000Z",
  }, nowMs, tenMinutes), false);

  assert.equal(shouldCoalesceActiveSeenOnlyTouch({
    last_seen_at: null,
  }, nowMs, tenMinutes), false);

  assert.equal(shouldCoalesceActiveSeenOnlyTouch({
    last_seen_at: "not-a-date",
  }, nowMs, tenMinutes), false);
});

test("raw active seen-only touch coalescing splits only recent active touches", () => {
  const nowMs = Date.parse("2026-05-11T12:00:00.000Z");
  const tenMinutes = 10 * 60 * 1000;
  const existing = new Map([
    [1, { last_seen_at: "2026-05-11T11:55:00.000Z" }],
    [2, { last_seen_at: "2026-05-11T11:45:00.000Z" }],
    [3, { last_seen_at: null }],
  ]);

  assert.deepEqual(splitActiveSeenOnlyTouches([1, 2, 3, 4], existing, nowMs, tenMinutes), {
    touchNow: [2, 3, 4],
    skipped: [1],
  });
});

test("raw active seen-only touch coalescing keeps pool rows on tighter window", () => {
  const nowMs = Date.parse("2026-05-11T12:00:00.000Z");
  const tenMinutes = 10 * 60 * 1000;
  const thirtyMinutes = 30 * 60 * 1000;
  const existing = new Map([
    [1, { last_seen_at: "2026-05-11T11:45:00.000Z" }],
    [2, { last_seen_at: "2026-05-11T11:45:00.000Z" }],
    [3, { last_seen_at: "2026-05-11T11:20:00.000Z" }],
  ]);

  assert.deepEqual(
    splitActiveSeenOnlyTouchesByPoolProtection([1, 2, 3], existing, new Set([1]), nowMs, tenMinutes, thirtyMinutes),
    {
      touchNow: [1, 3],
      skipped: [2],
      protectedPool: [1],
      nonPool: [2, 3],
    },
  );
});

test("conditional sold-out deletion wording is not treated as already sold", () => {
  const result = classifyListing("에어팟 4세대 노캔 X 판매완료시 삭제", "정상 판매중입니다", 130_000);
  assert.notEqual(result.listingType, "callout");
});

test("counterfeit AirPods wording is excluded from candidate pool", () => {
  const result = classifyListing("에어팟 프로2(차이팟) 팝니다", "정상 작동합니다.", 22_000);
  assert.equal(result.listingType, "callout");
});

test("earphone full set with both units stays normal", () => {
  const result = classifyListing(
    "에어팟 프로2 C타입 양쪽 유닛 본체 풀세트",
    "좌우 양쪽 유닛과 충전케이스 모두 있습니다. 정상 작동합니다.",
    145_000,
  );
  assert.equal(result.listingType, "normal");
  assert.equal(result.sku?.id, "airpods-pro-2-usbc");
});

test("earphone charging case only is excluded as parts", () => {
  const result = classifyListing(
    "에어팟 프로2 C타입 본체 단품",
    "유닛 없이 충전케이스만 판매합니다.",
    60_000,
  );
  assert.equal(result.listingType, "parts");
});

test("earphone protective case-only listings are excluded as accessory", () => {
  assert.equal(
    classifyListing("만날로니안 에어팟 프로 2세대 케이스", "케이스 새상품입니다.", 18_000).listingType,
    "accessory",
  );
  assert.equal(
    classifyListing("에어팟 프로2 케이스", "보호 케이스만 판매합니다.", 15_000).listingType,
    "accessory",
  );
  assert.equal(
    classifyListing("에어팟 프로2 커버 미개봉", "보호 커버 단품입니다.", 12_000).listingType,
    "accessory",
  );
});

test("earphone full set with included case wording stays normal", () => {
  const result = classifyListing(
    "에어팟프로2세대 라이트닝 풀박스 케이스 포함",
    "좌우 유닛, 충전케이스, 보호 케이스까지 같이 드립니다.",
    150_000,
  );
  assert.equal(result.listingType, "normal");
  assert.equal(result.sku?.id, "airpods-pro-2-lightning");
});

test("earphone fullbox with missing left or right unit is excluded as parts", () => {
  assert.equal(
    classifyListing(
      "에어팟 프로2 풀박스",
      "애플 에어팟 프로 2세대 입니다. 왼쪽 잃어 버려서 없습니다. 박스 풀박스입니다.",
      100_000,
    ).listingType,
    "parts",
  );

  const normalWear = classifyListing(
    "[S급]에어팟 프로2 풀박스",
    "본체 생활기스. 왼쪽은 눈에 잘 안보이는 생활기스 있고 오른쪽은 깨끗합니다.",
    160_000,
  );
  assert.notEqual(normalWear.listingType, "parts");
});

test("smartwatch strap is excluded as accessory", () => {
  const result = classifyListing("애플워치 울트라2 스트랩 오션밴드", "정품 스트랩만 판매합니다", 30_000);
  assert.equal(result.listingType, "accessory");
});

test("smartwatch full unit with included case or box is not excluded as accessory", () => {
  const result = classifyListing(
    "애플워치 se2 44mm",
    "케이스와 박스도 같이 드려요. 정상 작동하고 상태 좋습니다.",
    95_000,
  );
  assert.notEqual(result.listingType, "accessory");
  assert.equal(result.sku?.id, "applewatch-se2");
});

test("non-earphone title-dominant accessory listings stay excluded", () => {
  assert.equal(
    classifyListing("아이폰 15 프로 맥세이프 케이스", "새상품 케이스입니다", 20_000).listingType,
    "accessory",
  );
  assert.notEqual(classifyListing("애플워치 se2 스트랩 단품", "스트랩만 판매합니다", 18_000).listingType, "normal");
});

test("GS25 shipping text does not make a smartwatch match Galaxy S25", () => {
  const result = classifyListing(
    "애플워치 시리즈 6 40mm 골드 셀룰러 풀박스",
    "배송은 GS25 반값택배 가능하고 배터리 효율은 81%입니다.",
    100_000,
  );
  assert.notEqual(result.sku?.id, "galaxy-s25");
});

test("rental smartphone listing is commercial, not normal", () => {
  const result = classifyListing("갤럭시 S24 울트라 단기 렌탈 대여", "업체 렌탈 상품입니다", 80_000);
  assert.equal(result.listingType, "commercial");
});

test("negated damage wording does not force damaged classification", () => {
  const result = classifyListing("아이폰 15 프로 256GB 파손 없음", "잔상 없음 기능 정상", 800_000);
  assert.notEqual(result.listingType, "damaged");
});

test("AirPods 4 no-ANC wording becomes precise comparable key", () => {
  const parsed = parseListingOptions({
    category: "earphone",
    skuId: "airpods_4",
    title: "에어팟 4세대 기본모델 유선충전",
    description: "노캔 안되는 일반모델입니다.",
  });
  assert.equal(parsed.comparableKey, "airpods|airpods_4|usbc|no_anc");
  assert.equal(parsed.needsReview, false);
});

test("AirPods Max color/model hints infer USB-C generation", () => {
  const parsed = parseListingOptions({
    category: "earphone",
    skuId: "airpods_max",
    title: "에어팟 맥스 미드나이트 c핀 풀박스",
  });
  assert.equal(parsed.comparableKey, "airpods|airpods_max|usbc");
  assert.equal(parsed.parsedJson.airpods_max_generation, "max_usbc");
  assert.equal(parsed.needsReview, false);
});

test("AirPods Max ambiguous generation stays review-gated even with USB-C hint", () => {
  const parsed = parseListingOptions({
    category: "earphone",
    skuId: "airpods_max",
    title: "Apple AirPods Max 1st or 2nd generation USB-C 모델",
  });
  assert.equal(parsed.comparableKey, "airpods|airpods_max|usbc");
  assert.equal(parsed.parsedJson.airpods_max_generation, "unknown_generation");
  assert.equal(parsed.needsReview, true);
});

test("AirPods Max color-only and weak Lightning rows stay review-gated", () => {
  const colorOnly = parseListingOptions({
    category: "earphone",
    skuId: "airpods_max",
    title: "에어팟 맥스 스페이스 그레이",
  });
  assert.equal(colorOnly.parsedJson.airpods_max_generation, "unknown_generation");
  assert.equal(colorOnly.needsReview, true);

  const weakLightning = parseListingOptions({
    category: "earphone",
    skuId: "airpods_max",
    title: "에어팟 맥스 스페이스 그레이 8핀 판매",
  });
  assert.equal(weakLightning.comparableKey, "airpods|airpods_max|lightning");
  assert.equal(weakLightning.parsedJson.airpods_max_generation, "max_lightning");
  assert.equal(weakLightning.needsReview, true);
});

test("AirPods Max Lightning generation parses separately from USB-C", () => {
  const parsed = parseListingOptions({
    category: "earphone",
    skuId: "airpods_max",
    title: "에어팟 맥스 스페이스 그레이 8핀 풀박스",
  });
  assert.equal(parsed.comparableKey, "airpods|airpods_max|lightning");
  assert.equal(parsed.parsedJson.airpods_max_generation, "max_lightning");
  assert.equal(parsed.needsReview, false);
});

test("headphone included accessories do not make full unit an accessory listing", () => {
  const result = classifyListing(
    "에어팟 맥스 미드나이트 (USB-C)",
    "박스, 헤드 실리콘, 이어 쿠션 실리콘, 외부케이스, 거치대, 파우치, 충전선 다 드립니다",
    410_000,
  );
  assert.equal(result.listingType, "normal");
  assert.equal(result.sku?.id, "airpods-max");
});

test("headphone standalone cushion and case listings stay excluded", () => {
  assert.equal(
    classifyListing("BOSE 보스 QC 울트라 헤드폰 이어 쿠션 블랙", "이어 쿠션입니다", 35_000).listingType,
    "accessory",
  );
  assert.equal(
    classifyListing("에어팟 맥스1 소닉스x산리오 쿠로미 케이스 Airpods Max case", "케이스입니다", 25_000).listingType,
    "accessory",
  );
  assert.equal(
    classifyListing("보스 qc45 파우치", "보스 QC45 파우치만 판매합니다", 20_000).listingType,
    "accessory",
  );
});

test("AirPods Max merch-only listings are excluded without blocking real units", () => {
  assert.equal(
    classifyListing("엔시티위시 유우시 특전 포카 에어팟맥스", "포토카드 특전입니다", 28_000).listingType,
    "accessory",
  );

  const realUnit = classifyListing("에어팟 맥스 미드나이트 USB-C 풀박스", "정품 헤드폰 판매합니다", 430_000);
  assert.equal(realUnit.listingType, "normal");
  assert.equal(realUnit.sku?.id, "airpods-max");
});

test("non-AirPods headphone SKUs parse without connector review", () => {
  const parsed = parseListingOptions({
    category: "earphone",
    skuId: "sony-wh-1000xm5",
    title: "소니 WH-1000XM5 헤드폰 실버",
  });
  assert.equal(parsed.comparableKey, "earphone|sony_wh_1000xm5");
  assert.equal(parsed.needsReview, false);
});

test("full-size headphone bare-unit wording is not treated as earbud parts", () => {
  const airpodsMax = classifyListing(
    "에어팟 맥스 8핀 색상 스페이스 그레이 A급 헤드폰, 헤드셋",
    "헤드패드, 이어패드에 실리콘 커버 씌워놔서 깨끗해요. 기기 단품으로 드립니다.",
    420_000,
  );
  assert.equal(airpodsMax.listingType, "normal");
  assert.equal(airpodsMax.sku?.id, "airpods-max");

  const sony = classifyListing(
    "SONY WH-1000XM5 베이지 헤드폰 판매합니다",
    "소니 WH-1000XM5 베이지 색상 헤드폰 판매합니다. 헤드폰 기기단품.",
    140_000,
  );
  assert.equal(sony.listingType, "normal");
  assert.equal(sony.sku?.id, "sony-wh-1000xm5");
});

test("full-size headphone bundled case wording is not standalone accessory", () => {
  const result = classifyListing(
    "소니 wh-1000XM5 블랙 헤드폰 + 케이스",
    "소니 블랙 헤드폰 풀박스에 케이스까지 같이 드립니다. 충전 케이블도 포함입니다.",
    230_000,
  );
  assert.equal(result.listingType, "normal");
  assert.equal(result.sku?.id, "sony-wh-1000xm5");
});

test("full-size headphone audio output failure is damaged", () => {
  const result = classifyListing(
    "에어팟맥스 실버 고쳐서 쓰실분 연결은 되는데 오디오가 안나오네요..",
    "블루투스 연결은 됩니다.",
    150_000,
  );
  assert.equal(result.listingType, "damaged");
});

test("headphone negated risk wording does not force callout or damaged", () => {
  const genuine = classifyListing(
    "[새상품 / 정품] 비츠 솔로4 무선 온이어 헤드폰 제니 스페셜 에디션",
    "전 상품 미개봉 새상품, 100% 정품만을 판매합니다. 가품일 경우 200% 환불.",
    499_000,
  );
  assert.notEqual(genuine.listingType, "callout");

  const noDamage = classifyListing(
    "보스 노이즈 캔슬링 블루투스헤드폰, 블랙, BOSE QC45 풀박스",
    "제 눈에는 큰하자가 없으나 예민하신분은 피해주세요. 파손우려 없이 배송합니다.",
    256_787,
  );
  assert.notEqual(noDamage.listingType, "damaged");
});

test("MacBook old model number prevents decade-old 13-inch from mixing with modern models", () => {
  const parsed = parseListingOptions({
    category: "laptop",
    skuId: "macbook_air",
    title: "맥북에어 A1466 13인치 8GB 256GB",
  });
  assert.equal(parsed.comparableKey, "macbook|macbook_air|a1466|intel|13in|8gb_ram|256gb_ssd");
});

test("MacBook release year becomes part of laptop comparable key", () => {
  const parsed = parseListingOptions({
    category: "laptop",
    skuId: "macbook_pro",
    title: "맥북프로 13인치 2015년형 8GB 256GB",
  });
  assert.equal(parsed.comparableKey, "macbook|macbook_pro|2015y|unknown_chip|13in|8gb_ram|256gb_ssd");
  assert.equal(parsed.needsReview, true);
});

test("monitor model code and core options become comparable key", () => {
  const parsed = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "LG 울트라기어 27GL650F 27인치 FHD IPS 144Hz 게이밍 모니터",
  });

  assert.equal(parsed.comparableKey, "monitor|27gl650f|27in|fhd|144hz|ips|unknown_shape");
  assert.equal(parsed.needsReview, false);
  assert.equal(parsed.parsedJson.monitor_brand, "lg");
  assert.equal(parsed.parsedJson.monitor_model_code, "27gl650f");
});

test("generic monitor key stays review gated without model code", () => {
  const parsed = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "27인치 QHD 180Hz 게이밍 모니터 판매",
  });

  assert.equal(parsed.comparableKey, "monitor|generic_monitor|27in|qhd|180hz|unknown_panel|unknown_shape");
  assert.equal(parsed.needsReview, true);
  assert.equal(parsed.parsedJson.monitor_model_code, null);
});

test("monitor accessory and damaged panel listings are gated before normal pool", () => {
  assert.equal(
    classifyListing("카멜마운트 모니터암 판매", "모니터 암 단품입니다", 35_000).listingType,
    "accessory",
  );
  assert.equal(
    classifyListing("LG 27인치 모니터 화면 세로줄 있음", "패널 불량으로 싸게 팝니다", 40_000).listingType,
    "damaged",
  );
});

test("monitor common line names and model hints improve comparable key", () => {
  const odyssey = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "삼성 오디세이 G4 24인치 240hz 게이밍 모니터",
  });
  assert.equal(odyssey.model, "odyssey_g4");
  assert.equal(odyssey.comparableKey, "monitor|odyssey_g4|24in|fhd|240hz|ips|unknown_shape");

  const benq = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "벤큐 XL2540K 240hz 게이밍 모니터",
  });
  assert.equal(benq.comparableKey, "monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape");
  assert.equal(benq.needsReview, false);
});

test("monitor domestic cm screen size maps to comparable inch bucket", () => {
  const parsed = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "LG 울트라기어 68cm QHD 165Hz 게이밍 모니터",
  });

  assert.equal(parsed.screenSizeIn, 27);
  assert.equal(parsed.comparableKey, "monitor|generic_monitor|27in|qhd|165hz|unknown_panel|unknown_shape");
  assert.equal(parsed.needsReview, true);
});

test("monitor model code, ultrawide resolution, and bare refresh are parsed conservatively", () => {
  const modelSize = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "LG전자 27US550 판매합니다",
  });
  assert.equal(modelSize.screenSizeIn, 27);
  assert.equal(modelSize.comparableKey, "monitor|27us550|27in|uhd_4k|60hz|ips|unknown_shape");

  const ultrawide = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "한성컴퓨터 UWQHD IPS 게이밍 리얼 144 울트라와이드 모니터",
  });
  assert.equal(ultrawide.comparableKey, "monitor|generic_monitor|unknown_screen|wqhd|144hz|ips|ultrawide");
});

test("monitor model hints cover common gaming and office model codes", () => {
  const lg4k = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "LG전자 27US550 판매합니다",
  });
  assert.equal(lg4k.comparableKey, "monitor|27us550|27in|uhd_4k|60hz|ips|unknown_shape");
  assert.equal(lg4k.needsReview, false);

  const highRefresh = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "ROG SWIFT OLED PG27AQDP 게이밍 모니터 판매해요",
    description: "480hz LG OLED패널 입니다.",
  });
  assert.equal(highRefresh.comparableKey, "monitor|pg27aqdp|27in|qhd|480hz|oled|unknown_shape");
  assert.equal(highRefresh.needsReview, false);

  const lgQhd = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "LG울트라기어 27gs85q 게이밍모니터 27인치",
  });
  assert.equal(lgQhd.comparableKey, "monitor|27gs85q|27in|qhd|180hz|ips|unknown_shape");
  assert.equal(lgQhd.needsReview, false);

  const codePanel = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "카멜 CT2210IPS 54cm 안드로이드 터치모니터",
  });
  assert.equal(codePanel.parsedJson.monitor_panel_type, "ips");
});

test("monitor parser accepts hyphenated and short-tail model codes without Dell false positives", () => {
  const legion = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "레노버 게이밍 모니터 QHD 300Hz",
    description: "LEGION 27Q-11 QHD 300Hz Fast IPS 모델입니다",
  });
  assert.equal(legion.parsedJson.monitor_brand, null);
  assert.equal(legion.parsedJson.monitor_model_code, "27q_11");
  assert.equal(legion.comparableKey, "monitor|27q_11|27in|qhd|300hz|ips|unknown_shape");
  assert.equal(legion.needsReview, false);

  const crossover = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "26년 1월구매 게이밍 모니터 27인치",
    description: "WQHD 게이밍 모니터 27인치 팝니다. 크로스오버 279QA9 모델인 것 같습니다.",
  });
  assert.equal(crossover.parsedJson.monitor_brand, null);
  assert.equal(crossover.parsedJson.monitor_model_code, "279qa9");
  assert.equal(crossover.screenSizeIn, 27);
});

test("monitor parser adds high-confidence discovered model hints only by model code", () => {
  const philips = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "필립스 32M2N8800 4K OLED 모니터 팝니다.",
  });
  assert.equal(philips.comparableKey, "monitor|32m2n8800|32in|uhd_4k|240hz|oled|unknown_shape");
  assert.equal(philips.needsReview, false);

  const alienware = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "aw2525hm",
  });
  assert.equal(alienware.comparableKey, "monitor|aw2525hm|25in|fhd|320hz|ips|unknown_shape");
  assert.equal(alienware.needsReview, false);

  const battleg = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "BG27FM3 게이밍 모니터 27형 240hz",
  });
  assert.equal(battleg.comparableKey, "monitor|bg27fm3|27in|fhd|240hz|tn|unknown_shape");
  assert.equal(battleg.needsReview, false);
});

test("monitor selected official model-code rows keep exact comparable axes", () => {
  const samsungOffice = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "(미개봉) 삼성전자 27인치 모니터 LS27F354FHK",
  });
  assert.equal(samsungOffice.comparableKey, "monitor|ls27f354fhk|27in|fhd|60hz|pls|unknown_shape");
  assert.equal(samsungOffice.needsReview, false);
  assert.equal(
    classifyListing("(미개봉) 삼성전자 27인치 모니터 LS27F354FHK", "", 120_000).listingType,
    "normal",
  );

  const lgUltrawide = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "LG 39GX900A-B 울트라기어 OLED 모니터 판매",
  });
  assert.equal(lgUltrawide.comparableKey, "monitor|39gx900a|39in|wqhd|240hz|oled|curved_ultrawide");
  assert.equal(lgUltrawide.needsReview, false);

  const alienware = parseListingOptions({
    category: "monitor",
    skuId: "monitor",
    title: "Dell Alienware AW2525HM 게이밍 모니터",
  });
  assert.equal(alienware.comparableKey, "monitor|aw2525hm|25in|fhd|320hz|ips|unknown_shape");
  assert.equal(alienware.needsReview, false);
  assert.equal(classifyListing("aw2525hm", "", 250_000).listingType, "normal");
});

test("monitor bundled PC set is treated as multi", () => {
  assert.equal(
    classifyListing("게이밍 본체 모니터 키보드 마우스 풀세트", "컴퓨터와 모니터 같이 판매합니다", 650_000).listingType,
    "multi",
  );
});

test("speaker selected portable exact models parse internally but remain pool-gated", () => {
  const sku = CATALOG.find((row) => row.id === "speaker-jbl-go-4");
  assert.ok(sku);
  assert.equal(sku.category, "speaker");

  const parsed = parseListingOptions({
    category: "speaker",
    skuId: sku.id,
    skuName: sku.modelName,
    title: "JBL GO4 블루투스 스피커 미개봉",
  });
  assert.equal(parsed.comparableKey, "speaker|jbl_go_4|portable_bluetooth_speaker");
  assert.equal(parsed.needsReview, false);
  assert.equal(classifyListing("JBL GO4 블루투스 스피커 미개봉", "", 40_000).listingType, "normal");
});

test("speaker accessory and wrong device-class rows are blocked before speaker comps", () => {
  assert.equal(
    classifyListing("JBL GO4 하드쉘 케이스", "스피커 본체 없음", 13_000).listingType,
    "accessory",
  );
  assert.equal(
    classifyListing("JBL EON ONE COMPACT PA 스피커", "믹서 내장 행사장용", 800_000).listingType,
    "unknown",
  );
});

test("camera body-only exact models parse internally but remain pool-gated", () => {
  const sku = CATALOG.find((row) => row.id === "camera-canon-eos-r6-mark-ii");
  assert.ok(sku);
  assert.equal(sku.category, "camera");

  const parsed = parseListingOptions({
    category: "camera",
    skuId: sku.id,
    skuName: sku.modelName,
    title: "캐논 EOS R6 Mark II 바디 알육막투 바디 보증남음",
  });
  assert.equal(parsed.comparableKey, "camera|canon|eos_r6_mark_ii|body_only|no_lens");
  assert.equal(parsed.needsReview, false);
  assert.equal(classifyListing("캐논 EOS R6 Mark II 바디 알육막투 바디 보증남음", "", 2_150_000).listingType, "normal");
});

test("camera lens bundle, body cap, fixed-lens compact, and damaged rows do not pass body-only comps", () => {
  assert.notEqual(
    classifyListing("캐논 미러리스 eos R10바디+18-45렌즈+256+64메모리", "", 930_000).listingType,
    "normal",
  );
  assert.notEqual(
    classifyListing("캐논 미러리스용(EF-M) 카메라 바디캡+렌즈밑캡", "", 6_500).listingType,
    "normal",
  );
  assert.equal(
    classifyListing("캐논 G7X Mark3", "", 1_300_000).listingType,
    "unknown",
  );
  assert.equal(
    classifyListing("니콘 1 J1 미러리스 카메라 바디만 하자있음", "", 55_000).listingType,
    "damaged",
  );
});

test("game console parser separates Switch OLED full set and body-only", () => {
  const fullSet = parseGameConsoleListing(
    "닌텐도 스위치 OLED 화이트 본체 풀박스",
    "독, 조이콘, 충전기 포함 정상 작동",
    270_000,
  );
  assert.equal(fullSet.listingType, "normal");
  assert.equal(fullSet.comparableKey, "game_console|nintendo_switch|oled|full_set");
  assert.equal(fullSet.needsReview, false);

  const bodyOnly = parseGameConsoleListing(
    "닌텐도 스위치 oled 본체만 판매",
    "조이콘 없이 본체 단품입니다",
    180_000,
  );
  assert.equal(bodyOnly.listingType, "normal");
  assert.equal(bodyOnly.comparableKey, "game_console|nintendo_switch|oled|body_only");
});

test("game console parser separates PS5 disc and digital editions", () => {
  const disc = parseGameConsoleListing(
    "플레이스테이션5 PS5 본체 디스크버전",
    "듀얼센스 포함 풀박스입니다",
    500_000,
  );
  assert.equal(disc.comparableKey, "game_console|playstation_5|disc|full_set");

  const digital = parseGameConsoleListing(
    "플스5 본체 디지털 에디션",
    "본체 전원 케이블 듀얼센스 포함",
    430_000,
  );
  assert.equal(digital.comparableKey, "game_console|playstation_5|digital|full_set");
});

test("game console parser excludes title/accessory/damaged/buying noise", () => {
  assert.equal(
    parseGameConsoleListing("닌텐도 스위치 젤다의 전설 타이틀 팝니다", "", 45_000).listingType,
    "game_title",
  );
  assert.equal(
    parseGameConsoleListing("닌텐도 스위치 OLED 도크 풀구성 본체X", "독과 충전기만 있습니다", 50_000).listingType,
    "accessory",
  );
  assert.equal(
    parseGameConsoleListing("닌텐도 스위치 OLED 본체 와이파이 에러", "수리 필요", 135_000).listingType,
    "damaged_or_modded",
  );
  assert.equal(
    parseGameConsoleListing("닌텐도 스위치 oled 본체만 삽니다", "구매합니다", 150_000).listingType,
    "buying",
  );
});

test("game console parser protects body listings while keeping low-price case accessories out", () => {
  const body = parseGameConsoleListing("닌텐도 스위치 OLED 화이트 본체", "", 170_000);
  assert.equal(body.listingType, "normal");
  assert.equal(body.comparableKey, "game_console|nintendo_switch|oled|unknown_body");

  const bodyOnly = parseGameConsoleListing("닌텐도 스위치 oled 기기 본체 단품", "", 170_000);
  assert.equal(bodyOnly.listingType, "normal");
  assert.equal(bodyOnly.comparableKey, "game_console|nintendo_switch|oled|body_only");

  assert.equal(
    parseGameConsoleListing("(본체 케이스) 닌텐도 스위치 스칼렛 바이올렛 OLED 전용", "", 5_000).listingType,
    "accessory",
  );
  assert.equal(
    parseGameConsoleListing("닌텐도 스위치 OLED 본체 벚꽃 실리콘 케이스", "", 3_000).listingType,
    "accessory",
  );
});

test("game console parser ignores negated damage wording", () => {
  const withGame = parseGameConsoleListing(
    "닌텐도 스위치 본체 네온 레드/블루 풀박스 모동숲 포함",
    "하자나 불량, 기스 등 특이사항 없음",
    250_000,
  );
  assert.notEqual(withGame.listingType, "damaged_or_modded");

  const switch2Bundle = parseGameConsoleListing(
    "닌텐도 스위치 2 본체 풀박스 칩포함 인기 게임 칩 7개 일괄 판매",
    "조이콘 쏠림이나 버튼 불량 전혀 없습니다.",
    850_000,
  );
  assert.equal(switch2Bundle.listingType, "multi_bundle");
  assert.equal(switch2Bundle.moddedOrDamaged, false);
});

test("game console parser keeps non-console contamination as unknown", () => {
  const parsed = parseGameConsoleListing(
    "[전국최저가] 5월추천PC 게이밍본체 종류별 판매합니다",
    "본체구매시 키보드 무료. 불량률 최소화, 파손보험 가입 배송.",
    300_000,
  );
  assert.equal(parsed.listingType, "unknown");
  assert.equal(parsed.model, null);
  assert.equal(parsed.comparableKey, null);
});

test("game console parser narrows obvious sealed and minor-accessory body configs", () => {
  const sealed = parseGameConsoleListing(
    "[미개봉 새상품] 닌텐도 스위치 OLED 본체 화이트 홍콩판 정품",
    "박스에 비닐 포장도 안 뜯은 완전 새 제품입니다.",
    510_000,
  );
  assert.equal(sealed.comparableKey, "game_console|nintendo_switch|oled|full_set");
  assert.equal(sealed.needsReview, false);

  const bodyWithPouch = parseGameConsoleListing(
    "닌텐도 스위치 올레드 OLED 본체 +파우치 판매 HEG-001",
    "구성 : 닌텐도 스위치 본체 + 파우치. 박스 및 기타 구성품 X",
    250_000,
  );
  assert.equal(bodyWithPouch.comparableKey, "game_console|nintendo_switch|oled|body_only");
  assert.equal(bodyWithPouch.needsReview, false);
});

test("game console parser avoids Switch 2 leakage and narrows clear Switch Lite configs", () => {
  const oledAfterSwitch2Purchase = parseGameConsoleListing(
    "닌텐도 스위치 OLED 화이트 본체",
    "이번에 스위치2를 사서 풀팩임에도 저렴하게 올립니다.",
    240_000,
  );
  assert.equal(oledAfterSwitch2Purchase.model, "nintendo_switch_oled");
  assert.equal(oledAfterSwitch2Purchase.edition, "oled");

  const switch2Direct = parseGameConsoleListing(
    "닌텐도 스위치2 본체 풀박스",
    "스위치2 본체 풀박스 판매합니다.",
    480_000,
  );
  assert.equal(switch2Direct.model, "nintendo_switch_2");
  assert.equal(switch2Direct.edition, "switch_2");
  assert.equal(switch2Direct.needsReview, true);
  assert.ok(switch2Direct.reasons.includes("switch_2_owner_review_required"));

  const liteBodyOnly = parseGameConsoleListing(
    "닌텐도 스위치 라이트 그레이 본체",
    "구성품은 닌텐도 스위치 라이트 본체입니다. 박스 및 충전기 등 기타 구성품은 없습니다.",
    130_000,
  );
  assert.equal(liteBodyOnly.comparableKey, "game_console|nintendo_switch|lite|body_only");
  assert.equal(liteBodyOnly.needsReview, false);

  const liteFullSet = parseGameConsoleListing(
    "닌텐도 스위치 라이트 더콰이즈 본체 + 충전기",
    "정품 충전기랑 박스도 같이 드려요.",
    130_000,
  );
  assert.equal(liteFullSet.comparableKey, "game_console|nintendo_switch|lite|full_set");
  assert.equal(liteFullSet.needsReview, false);
});

test("game console parser narrows explicit hardware component descriptions", () => {
  const switchHardware = parseGameConsoleListing(
    "닌텐도 스위치 OLED 본체+조이콘+독+그립 판매",
    "박스는 없고 본체+조이콘+독+그립+충전기 포함입니다.",
    320_000,
  );
  assert.equal(switchHardware.comparableKey, "game_console|nintendo_switch|oled|full_set");
  assert.equal(switchHardware.needsReview, false);

  const switchBodyWithCharger = parseGameConsoleListing(
    "닌텐도 스위치 OLED 화이트 본체 + 충전기",
    "닌텐도 스위치 OLED 화이트 본체랑 충전기 같이 판매합니다.",
    230_000,
  );
  assert.equal(switchBodyWithCharger.comparableKey, "game_console|nintendo_switch|oled|body_only");
  assert.equal(switchBodyWithCharger.needsReview, false);

  const ps5Boxed = parseGameConsoleListing(
    "플레이스테이션5 PS5 본체 디스크버전",
    "구성품은 본체, 전원선, hdmi 케이블, 게임패드, c타입 케이블이고 원래박스 있어요.",
    490_000,
  );
  assert.equal(ps5Boxed.comparableKey, "game_console|playstation_5|disc|full_set");
  assert.equal(ps5Boxed.needsReview, false);
});

test("game console parser uses conservative PS5 CFI and Switch partial component signals", () => {
  const ps5CfiDisc = parseGameConsoleListing(
    "PS5 디스크 에디션 본체 + 페르소나3 리로드",
    "ps5입니다. 제조년월 2021년 CFI-1018A 모델입니다.",
    500_000,
  );
  assert.equal(ps5CfiDisc.edition, "disc");

  const ps5CfiDigital = parseGameConsoleListing(
    "플레이스테이션5 본체 화이트",
    "CFI 1018B 모델이고 듀얼센스, 전원선, HDMI 케이블 포함입니다.",
    430_000,
  );
  assert.equal(ps5CfiDigital.comparableKey, "game_console|playstation_5|digital|full_set");
  assert.equal(ps5CfiDigital.needsReview, false);

  const switchPartial = parseGameConsoleListing(
    "닌텐도스위치oled화이트본체+조이콘+충전기 팝니다",
    "박스없고 본체 조이콘 충전기 구성입니다.",
    180_000,
  );
  assert.equal(switchPartial.comparableKey, "game_console|nintendo_switch|oled|body_only");
  assert.equal(switchPartial.needsReview, false);

  const sealedLite = parseGameConsoleListing(
    "닌텐도 스위치 라이트 옐로우 본체 국내 정품",
    "새상품으로 가구요 무료배송입니다.",
    255_000,
  );
  assert.equal(sealedLite.comparableKey, "game_console|nintendo_switch|lite|full_set");
  assert.equal(sealedLite.needsReview, false);

  const installedGame = parseGameConsoleListing(
    "닌텐도 스위치 OLED 화이트 본체",
    "새상품입니다. 사진에 있는 게임은 설치 되어 있습니다. 피파21 칩하나 드립니다.",
    280_000,
  );
  assert.equal(installedGame.bodyConfig, "unknown_body");
  assert.equal(installedGame.needsReview, true);
});

test("iPad Pro bare screen size near generation becomes precise comparable key", () => {
  const parsed = parseListingOptions({
    category: "tablet",
    skuId: "ipad_pro",
    title: "아이패드 프로 5세대 m1 12.9 128기가 셀룰러 풀박+애펜2",
  });
  assert.equal(parsed.comparableKey, "ipad|ipad_pro|12_9in|128gb|cellular");
  assert.equal(parsed.needsReview, false);
});

test("iPad Pro compact generation title keeps 11-inch split", () => {
  const parsed = parseListingOptions({
    category: "tablet",
    skuId: "ipad_pro",
    title: "아이패드 프로4세대 11 128GB 스그",
  });
  assert.equal(parsed.comparableKey, "ipad|ipad_pro|11in|128gb|wifi");
  assert.equal(parsed.needsReview, false);
});

test("iPad mini generation and A17 Pro chip infer mini screen generation", () => {
  const mini5 = parseListingOptions({
    category: "tablet",
    skuId: "ipad_mini",
    title: "아이패드 미니 스페이스 그레이 5세대 64기가",
  });
  assert.equal(mini5.comparableKey, "ipad|ipad_mini|7_9in|64gb|wifi");

  const miniA17 = parseListingOptions({
    category: "tablet",
    skuId: "ipad_mini",
    title: "아이패드 미니 a17 256기가",
  });
  assert.equal(miniA17.comparableKey, "ipad|ipad_mini|8_3in|256gb|wifi");
});

test("Galaxy Tab FE and Wi-Fi variants do not mix with base or GPS", () => {
  const fe = parseListingOptions({
    category: "tablet",
    skuId: "galaxy_tab_s9_fe",
    title: "갤럭시탭 S9 FE 128GB Wi-Fi 그레이",
  });
  assert.equal(fe.comparableKey, "galaxy_tab|galaxy_tab_s9_fe|10_9in|128gb|wifi");
  assert.equal(fe.needsReview, false);

  const base = parseListingOptions({
    category: "tablet",
    skuId: "galaxy_tab_s9",
    title: "갤럭시 탭 S9 Wi-Fi 128GB 그라파이트",
  });
  assert.equal(base.comparableKey, "galaxy_tab|galaxy_tab_s9|11in|128gb|wifi");
  assert.equal(base.needsReview, false);
});

test("smartphone cases and grip accessories do not enter normal phone pool", () => {
  assert.equal(
    classifyListing("슈피겐 갤럭시S24 옵틱아머 어비스그린 새제품", "케이스입니다", 17_000).listingType,
    "accessory",
  );
  assert.equal(
    classifyListing("TYREUS 헬로키티 맥세이프 그립톡 아이폰16프로 새제품", "그립톡 단품", 11_000).listingType,
    "accessory",
  );
  assert.equal(
    classifyListing("아이폰 15 POLO case 미개봉", "케이스 새상품", 50_000).listingType,
    "accessory",
  );
});

test("smartphone repair parts and buying posts are excluded before scoring", () => {
  assert.equal(
    classifyListing("정품 아이폰 12 백글라스 판매합니다", "후면 유리 부품입니다", 5_000).listingType,
    "parts",
  );
  assert.equal(
    classifyListing("갤럭시 s24 울트라 구매함", "구매 원합니다", 700_000).listingType,
    "buying",
  );
});

test("description-level buying intent is excluded without blocking purchase-history wording", () => {
  assert.equal(
    classifyListing(
      "에어팟 프로2 구매",
      "에어팟프로2 8핀 정품만 구매합니다. 10만원선에서 구합니다.",
      100_000,
    ).listingType,
    "buying",
  );

  assert.notEqual(
    classifyListing(
      "26년 1월구매 게이밍 모니터 27인치",
      "정상 작동하고 구매내역 있습니다.",
      180_000,
    ).listingType,
    "buying",
  );

  assert.notEqual(
    classifyListing(
      "애플워치 울트라 49MM",
      "중고거래했습니다. 도난제품 아닙니다. 알아서 초기화 하시고 쓰실분 구합니다.",
      266_000,
    ).listingType,
    "buying",
  );
});

test("pool policy gives one shared skip reason for blocked flags", () => {
  const confidence = computePoolConfidence(0.8, ["coarse_market_price"]);
  assert.equal(confidence, 0.8);
  assert.equal(
    poolSkipReason({
      profitMin: 30_000,
      price: 100_000,
      skuMedian: 170_000,
      riskHits: 0,
      thumbnailUrl: "https://example.test/1.jpg",
      categoryCanEnterPool: true,
      comparableKey: "airpods|airpods_pro_2_usbc|usbc",
      needsReview: false,
      confidence,
      scoreFlags: ["coarse_market_price"],
    }),
    "blocked_coarse_market_price",
  );
});

test("pool policy blocks extreme discount even when AI says normal", () => {
  const confidence = computePoolConfidence(0.85, ["extreme_discount_review", "deep_discount_review", "ai_normal"]);
  assert.equal(confidence, 1);
  assert.equal(
    poolSkipReason({
      profitMin: 120_000,
      price: 25_000,
      skuMedian: 175_000,
      riskHits: 0,
      thumbnailUrl: "https://example.test/watch.jpg",
      categoryCanEnterPool: true,
      comparableKey: "applewatch|applewatch_se2|44mm|unknown_connectivity",
      needsReview: false,
      confidence,
      scoreFlags: ["extreme_discount_review", "deep_discount_review", "ai_normal"],
    }),
    "blocked_extreme_discount_review",
  );
});

test("pool policy blocks AI second-opinion hold even when candidate otherwise looks good", () => {
  const confidence = computePoolConfidence(0.95, ["ai_second_opinion_hold", "ai_normal"]);
  assert.equal(confidence, 1);
  assert.equal(
    poolSkipReason({
      profitMin: 45_000,
      price: 125_000,
      skuMedian: 180_000,
      riskHits: 0,
      thumbnailUrl: "https://example.test/airpods.jpg",
      categoryCanEnterPool: true,
      comparableKey: "airpods|airpods_pro_2_usbc|usbc",
      needsReview: false,
      confidence,
      scoreFlags: ["ai_second_opinion_hold", "ai_normal"],
    }),
    "blocked_ai_second_opinion_hold",
  );
});

test("pool policy blocks inactive sale status before reveal", () => {
  assert.equal(
    poolSkipReason({
      profitMin: 30000,
      price: 120000,
      saleStatus: "RESERVED",
      skuMedian: 180000,
      riskHits: 0,
      thumbnailUrl: "https://example.com/a.jpg",
      categoryCanEnterPool: true,
      comparableKey: "airpods|airpods_4|usbc|anc",
      needsReview: false,
      confidence: 0.9,
      scoreFlags: ["ai_normal"],
    }),
    "sale_status_inactive",
  );
});

test("market math trims seller-level price outliers before median", () => {
  const rows = [
    { pid: 1, seller_uid: "a", price: 100_000 },
    { pid: 2, seller_uid: "b", price: 102_000 },
    { pid: 3, seller_uid: "c", price: 103_000 },
    { pid: 4, seller_uid: "d", price: 104_000 },
    { pid: 5, seller_uid: "e", price: 105_000 },
    { pid: 6, seller_uid: "f", price: 106_000 },
    { pid: 7, seller_uid: "g", price: 107_000 },
    { pid: 8, seller_uid: "h", price: 999_000 },
  ];
  const market = trimmedSellerMarket(rows);
  assert.equal(market.count, 7);
  assert.equal(market.median, 104_000);
});

test("market math uses seller representative prices to reduce duplicate seller skew", () => {
  const rows = [
    { pid: 1, seller_uid: "same", price: 100_000 },
    { pid: 2, seller_uid: "same", price: 120_000 },
    { pid: 3, seller_uid: "other", price: 200_000 },
  ];
  assert.equal(trimmedSellerMarket(rows).median, 155_000);
});

test("market math median and percentile rank stay stable on small samples", () => {
  assert.equal(median([30, 10, 20, 40]), 25);
  assert.equal(percentileRank([], 100), 0.5);
  assert.equal(percentileRank([10, 20, 30], 20), 0.5);
});

test("candidate pool builder blocks non-ready laptop category despite high profit", () => {
  const parsedByPid = new Map([
    [1, {
      category: "laptop" as const,
      comparable_key: "macbook|macbook_air|m2|13in|8gb_ram|256gb_ssd",
      parse_confidence: 1,
      needs_review: false,
    }],
  ]);
  const result = buildCandidatePoolRows({
    rows: [{
      pid: 1,
      price: 400_000,
      skuMedian: 800_000,
      estimatedBuyCost: 400_000,
      shippingFee: 0,
      shippingFeeGeneral: 0,
      riskHits: 0,
      thumbnailUrl: "https://example.test/macbook.jpg",
      skuId: "macbook_air",
      score: 90,
      scoreFlags: [],
    }],
    parsedByPid,
    catalogById: new Map(CATALOG.map((sku) => [sku.id, sku])),
    categoryReadiness: {
      laptop: {
        status: "internal_only",
        label: "PC/Laptop",
        note: "hold",
        minReadyPool: 8,
        minParseRate: 0.85,
        minTrustedKeys: 8,
      },
    },
    now: "2026-05-11T00:00:00.000Z",
  });

  assert.equal(result.entries.length, 0);
  assert.deepEqual(result.invalidations, [{ pid: 1, reason: "category_internal_only_laptop" }]);
});

test("score output mapper preserves rows while assigning rank by score", () => {
  const base = {
    url: "https://example.test",
    name: "item",
    price: 100_000,
    skuId: "airpods_pro_2_usb_c",
    skuName: "AirPods Pro 2nd gen (USB-C)",
    skuMedian: 170_000,
    descriptionPreview: "normal",
    imageUrlTemplate: null,
    imageCount: 1,
    thumbnailUrl: "https://example.test/1.jpg",
    priceGap: 0.3,
    numFaved: 0,
    velocity: 0.5,
    reviewRating: 5,
    reviewCount: 10,
    safety: 0.8,
    riskHits: 0,
    scoreFlags: [],
    shippingFee: 0,
    shippingFeeGeneral: 0,
    shippingSource: "test",
    estimatedBuyCost: 100_000,
    grossResellGap: 70_000,
    netGapAfterShipping: 60_000,
  };
  const rows = toRankedAnalysisRows([
    { ...base, pid: "1", score: 10 },
    { ...base, pid: "2", score: 90 },
  ], "2026-05-11T00:00:00.000Z");

  assert.equal(rows[0].candidate_rank, 2);
  assert.equal(rows[1].candidate_rank, 1);
});

test("score output mapper coerces integer database fields", () => {
  const row = {
    url: "https://example.test",
    name: "item",
    price: 100_000.4,
    skuId: "airpods_pro_2_usb_c",
    skuName: "AirPods Pro 2nd gen (USB-C)",
    skuMedian: 1_216_095.5,
    descriptionPreview: "normal",
    imageUrlTemplate: null,
    imageCount: 1.2,
    thumbnailUrl: "https://example.test/1.jpg",
    priceGap: 0.3,
    numFaved: 1.6,
    velocity: 0.5,
    reviewRating: 5,
    reviewCount: 10.4,
    safety: 0.8,
    riskHits: 0.2,
    score: 90,
    scoreFlags: [],
    shippingFee: 2500.5,
    shippingFeeGeneral: 3500.5,
    shippingSource: "test",
    estimatedBuyCost: 102_500.5,
    grossResellGap: 70_000.5,
    netGapAfterShipping: 60_000.5,
  };
  const listings = toListingOutputRows([{ ...row, pid: "1" }], "2026-05-11T00:00:00.000Z");
  const analyses = toRankedAnalysisRows([{ ...row, pid: "1" }], "2026-05-11T00:00:00.000Z");

  assert.equal(listings[0].sku_median, 1_216_096);
  assert.equal(listings[0].shipping_fee, 2501);
  assert.equal(listings[0].shipping_fee_general, 3501);
  assert.equal(listings[0].estimated_buy_cost, 102_501);
  assert.equal(listings[0].gross_resell_gap, 70_001);
  assert.equal(listings[0].net_gap_after_shipping, 60_001);
  assert.equal(analyses[0].num_faved, 2);
  assert.equal(analyses[0].review_count, 10);
  assert.equal(analyses[0].risk_hits, 0);
});

test("score output diff ignores timestamp-only changes", () => {
  const row = {
    url: "https://example.test",
    name: "item",
    price: 100_000,
    skuId: "airpods_pro_2_usb_c",
    skuName: "AirPods Pro 2nd gen (USB-C)",
    skuMedian: 170_000,
    descriptionPreview: "normal",
    imageUrlTemplate: null,
    imageCount: 1,
    thumbnailUrl: "https://example.test/1.jpg",
    priceGap: 0.3,
    numFaved: 1,
    velocity: 0.5,
    reviewRating: 5,
    reviewCount: 10,
    safety: 0.8,
    riskHits: 0,
    score: 90,
    scoreFlags: ["ai_normal"],
    shippingFee: 2500,
    shippingFeeGeneral: 3500,
    shippingSource: "test",
    estimatedBuyCost: 102_500,
    grossResellGap: 70_000,
    netGapAfterShipping: 60_000,
  };
  const listings = toListingOutputRows([{ ...row, pid: "1" }], "2026-05-11T00:00:00.000Z");
  const analyses = toRankedAnalysisRows([{ ...row, pid: "1" }], "2026-05-11T00:00:00.000Z");
  const existingListing = {
    ...listings[0],
    source_json: { pipeline: "old" },
    generated_at: "2026-05-10T00:00:00.000Z",
    updated_at: "2026-05-10T00:00:00.000Z",
  };
  const existingAnalysis = {
    ...analyses[0],
    source_json: { pipeline: "old" },
    analyzed_at: "2026-05-10T00:00:00.000Z",
    updated_at: "2026-05-10T00:00:00.000Z",
  };

  assert.equal(listingOutputChanged(listings[0], existingListing), false);
  assert.equal(listingOutputChanged({ ...listings[0], price: listings[0].price + 1 }, existingListing), true);
  assert.equal(analysisOutputChanged(analyses[0], existingAnalysis), false);
  assert.equal(analysisOutputChanged({ ...analyses[0], candidate_rank: 99 }, existingAnalysis), false);
  assert.equal(analysisOutputChanged({ ...analyses[0], score_flags: [] }, existingAnalysis), true);
});
