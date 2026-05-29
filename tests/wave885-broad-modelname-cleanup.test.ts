// Wave 885 (2026-05-26): broad SKU modelName 부속 설명 (paren/em-dash/slash 나열) 가 comparable_key 에 누출되던 버그.
//   기존: "Seiko (broad — narrow 미박힘 catch-all)" → slug → "seiko_broad_narrow_미박힘_catch_all"
//   기대: paren/em-dash 떼어내고 → "Seiko" → slug → "seiko"
import assert from "node:assert/strict";
import test from "node:test";
import { parseListingOptions, PARSER_VERSION } from "@/lib/option-parser";

function parse(opts: { title: string; skuId: string; skuName: string; category: "watch" | "sport_golf" | "home_appliance" }) {
  return parseListingOptions({
    title: opts.title,
    description: "",
    category: opts.category,
    skuId: opts.skuId,
    skuName: opts.skuName,
  });
}

test("Wave 934: PARSER_VERSION bumped to v63", () => {
  assert.equal(PARSER_VERSION, "option-parser-v63");
});

test("Wave 885: Seiko broad catch-all does not leak 미박힘 placeholder into comparable_key", () => {
  const result = parse({
    title: "세이코 SBTR013 손목시계",
    skuId: "watch-seiko-broad",
    skuName: "Seiko (broad — narrow 미박힘 catch-all)",
    category: "watch",
  });
  assert.ok(result.comparableKey, "comparable_key must exist");
  assert.ok(!result.comparableKey!.includes("미박힘"), `comparable_key must not contain 미박힘 placeholder: ${result.comparableKey}`);
  assert.ok(!result.comparableKey!.includes("catch_all"), `comparable_key must not contain catch_all: ${result.comparableKey}`);
});

test("Wave 885: Seiko 5 broad does not leak SRPD/SBSA 외 list", () => {
  const result = parse({
    title: "세이코 5 빈티지",
    skuId: "watch-seiko-5-broad",
    skuName: "Seiko 5 (broad — SRPD/SBSA 외)",
    category: "watch",
  });
  assert.ok(result.comparableKey, "comparable_key must exist");
  assert.ok(!result.comparableKey!.includes("srpd_sbsa"), `comparable_key must not contain narrow lane list: ${result.comparableKey}`);
  assert.ok(!result.comparableKey!.includes("외"), `comparable_key must not contain 외: ${result.comparableKey}`);
});

test("Wave 885: TaylorMade Driver broad model token stays 'taylormade_driver' (no R7/M/SIM/Stealth list leak)", () => {
  const result = parse({
    title: "테일러메이드 드라이버",
    skuId: "sport-golf-taylormade-driver-broad",
    skuName: "TaylorMade Driver (broad — R7/M/SIM/Stealth/Qi10)",
    category: "sport_golf",
  });
  assert.ok(result.comparableKey, "comparable_key must exist");
  // generation axis (gen_tm_*) 은 별도 토큰 — 정상. 본 테스트는 family|model 부분만 검증.
  const [family, model] = result.comparableKey!.split("|");
  assert.equal(family, "sport_golf");
  assert.equal(model, "taylormade_driver", `model token must be clean: ${result.comparableKey}`);
});

test("Wave 885: Dyson Airwrap broad does not leak HS08/Co-anda 2x parenthetical", () => {
  const result = parse({
    title: "다이슨 에어랩 i.d.",
    skuId: "home-appliance-dyson-airwrap-hs08",
    skuName: "Dyson Airwrap i.d. (HS08, Co-anda 2x)",
    category: "home_appliance",
  });
  assert.ok(result.comparableKey, "comparable_key must exist");
  assert.ok(!result.comparableKey!.includes("hs08_co_anda_2x"), `comparable_key must not contain HS08/Co-anda: ${result.comparableKey}`);
});

// Wave 885 part 2: AirPods Max — USB-C 1세대/2세대 ↔ Lightning 1세대 routing 정정.
//   기존 mustNotContain ["usb-c", "usbc", "c타입", "타입c"] 만 있어서 색상/세대/연도 시그널 없는 매물이
//   잘못 Lightning 으로 routed → comparable_key `airpods|airpods_max|usbc` 에서 1세대/2세대 mixing.
import { ruleMatch } from "@/lib/catalog";

test("Wave 885 Part 2: AirPods Max Lightning (1세대 8핀) routes to airpods-max", () => {
  assert.equal(ruleMatch("에어팟 맥스 스페이스 그레이 8핀", "")?.id, "airpods-max");
  assert.equal(ruleMatch("SS급) 에어팟맥스 8핀", "")?.id, "airpods-max");
  assert.equal(ruleMatch("에어팟 맥스 (1세대) 실버", "")?.id, "airpods-max");
});

test("Wave 885 Part 2: AirPods Max 2024+ USB-C 신컬러 routes to airpods-max-usbc", () => {
  assert.equal(ruleMatch("에어팟 맥스 스타라이트", "")?.id, "airpods-max-usbc");
  assert.equal(ruleMatch("에어팟맥스 미드나이트 새상품", "")?.id, "airpods-max-usbc");
  assert.equal(ruleMatch("에어팟 맥스 퍼플 USB-C", "")?.id, "airpods-max-usbc");
});

test("Wave 885 Part 2: AirPods Max 2/2026/2세대 routes to airpods-max-usbc", () => {
  assert.equal(ruleMatch("에어팟 맥스2 미드나이트 2026", "")?.id, "airpods-max-usbc");
  assert.equal(ruleMatch("애플 에어팟맥스 2세대 c핀", "")?.id, "airpods-max-usbc");
  assert.equal(ruleMatch("애플 에어팟 맥스 USB-C 2024년형", "")?.id, "airpods-max-usbc");
});

// Wave 885 Part 2 safety re-check (사용자 우려 반영):
//   "에어팟 맥스" alone = Lightning default (의도된 기본값) — 변경 X 검증.
//   Apple 이 2024년 9월까지 Lightning 판매 — "2024년 구매" 만으론 model year 판단 불가 →
//   year-only 토큰 (2024/2025/2026) USB-C signal 박지 않음.
test("Wave 885 Part 2 safety: 기본 'AirPods Max' default routes to Lightning (1세대)", () => {
  assert.equal(ruleMatch("에어팟 맥스", "")?.id, "airpods-max");
  assert.equal(ruleMatch("에어팟맥스 새것", "")?.id, "airpods-max");
  assert.equal(ruleMatch("에어팟 맥스 (1세대)", "")?.id, "airpods-max");
});

test("Wave 885 Part 2 safety: 1세대 Lightning 전용 컬러 → Lightning lane (mis-routing 차단)", () => {
  assert.equal(ruleMatch("에어팟 맥스 스카이블루", "")?.id, "airpods-max");
  assert.equal(ruleMatch("에어팟 맥스 핑크", "")?.id, "airpods-max");
  assert.equal(ruleMatch("에어팟 맥스 그린", "")?.id, "airpods-max");
  // 스페이스 그레이는 Lightning 1세대 전용. mis-route 차단.
  assert.equal(ruleMatch("에어팟 맥스 스페이스 그레이 2024년에 구매", "")?.id, "airpods-max");
});

test("Wave 885 Part 2 safety: year-only ('2024년 구매') 는 USB-C signal 안 됨 → Lightning default", () => {
  // Apple 이 2024년 9월까지 Lightning 판매. "2024년 1월 구매" Lightning 매물이 USB-C lane 으로 mis-route 안 되도록.
  assert.equal(ruleMatch("에어팟 맥스 2024년 1월 구매", "")?.id, "airpods-max");
  assert.equal(ruleMatch("에어팟 맥스 실버 2024 새상품", "")?.id, "airpods-max");
});

// Wave 885 Part 3 (사용자 결정): band 시스템 폐기 — pool 진입 gate threshold 1원.
import { bandFromProfit } from "@/lib/profit";

test("Wave 885 Part 3: bandFromProfit threshold 1만 → 1원 (band 폐기 결정)", () => {
  // 차익 1원도 band 1 (양수 차익이면 통과)
  assert.equal(bandFromProfit(1, 1), 1);
  assert.equal(bandFromProfit(9_000, 9_000), 1);
  assert.equal(bandFromProfit(10_000, 10_000), 1);
  // band 2 (4만+) 와 band 3 (7만+) 유지
  assert.equal(bandFromProfit(40_000, 40_000), 2);
  assert.equal(bandFromProfit(70_000, 70_000), 3);
  // 차익 0 / 음수 = null (negative_resell_gap 별도 차단 위해)
  assert.equal(bandFromProfit(0, 0), null);
  assert.equal(bandFromProfit(-100, -100), null);
});
