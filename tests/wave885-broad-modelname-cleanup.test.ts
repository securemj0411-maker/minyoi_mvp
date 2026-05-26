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

test("Wave 885: PARSER_VERSION bumped to v62", () => {
  assert.equal(PARSER_VERSION, "option-parser-v62");
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
