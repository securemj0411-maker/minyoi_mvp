// Wave 203 (2026-05-18): 셀러 "미개봉" 자연어 + 배터리/사이클 measure 모순 감지.
//
// 사용자 통찰 (pid 408845367): "미개봉인데 어떻게 배터리 97%??"
// 진짜 미개봉 = 박스 안 뜯음 = 한 번도 안 켰음 = 배터리 % measure 불가능.
// 셀러가 "미개봉" + "배터리 97%" 둘 다 박았으면 거짓 미개봉. 자연어 무시.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListingOptions } from "@/lib/option-parser";

function parse(title: string, description = "") {
  return parseListingOptions({
    title,
    description,
    category: "smartwatch",
    skuId: "applewatch-se2",
    skuName: "Apple Watch SE 2nd gen",
  });
}

describe("Wave 203 — 셀러 거짓 '미개봉' 자연어 + 배터리 measure 모순 차단", () => {
  describe("거짓 미개봉 (자연어 + 배터리 measure) → unopened 차단", () => {
    it("배터리 97% + 미개봉 자연어 → unopened 아님, clean (사용자 보고 매물)", () => {
      const r = parse(
        "애플워치se2 40mm(배터리성능97%)스타라이트",
        "미개봉 애플워치 SE2 40mm 스타라이트 색상입니다. 배터리 성능 97%로 아주 좋습니다. 풀박스로 구매 당시 그대로 드립니다.",
      );
      // 객관적 신호 박힘 검증
      assert.equal(r.batteryHealth, 97, "battery 97 추출");
      assert.ok(r.conditionNotes?.includes("battery_high_health"), `battery_high_health 박혀야 — got: ${JSON.stringify(r.conditionNotes)}`);
      assert.ok(r.conditionNotes?.includes("full_set"), "풀박스 박혀야");
      // 자연어 "미개봉" 신호 차단 검증
      assert.ok(!r.conditionNotes?.includes("new_or_open_box"), `미개봉 자연어 차단되어야 (배터리 measure 모순) — got: ${JSON.stringify(r.conditionNotes)}`);
      // condition_class = clean (객관적 신호 기반) — unopened/normal 아님
      assert.equal(r.conditionClass, "clean", `clean 박혀야 — got: ${r.conditionClass}`);
    });

    it("배터리 98% + 미개봉 자연어 → unopened 차단, clean", () => {
      const r = parse(
        "아이폰 15 256GB 미개봉 새상품",
        "미개봉 박스 그대로. 배터리 효율 98%.",
      );
      assert.ok(!r.conditionNotes?.includes("new_or_open_box"), "미개봉 차단");
      assert.ok(r.conditionNotes?.includes("battery_high_health"), "battery_high_health 박힘");
    });
  });

  describe("진짜 미개봉 (배터리 measure 없음) → unopened 유지", () => {
    it("미개봉 + 배터리 measure 없음 → new_or_open_box 박힘", () => {
      const r = parse(
        "애플워치 SE2 40mm 미개봉 풀박스",
        "박스 안 뜯음, 미개봉 상태입니다. 풀박스로 드림.",
      );
      assert.equal(r.batteryHealth, null, "배터리 measure 없음");
      assert.ok(r.conditionNotes?.includes("new_or_open_box"), `진짜 미개봉 박혀야 — got: ${JSON.stringify(r.conditionNotes)}`);
    });
  });

  describe("battery_high_health 신호 — 95~99% 객관적 신호", () => {
    it("battery 95% → battery_high_health 박힘", () => {
      const r = parse("애플워치 SE2 사용감 적음", "배터리 효율 95% 입니다. 사용감 적음.");
      assert.equal(r.batteryHealth, 95);
      assert.ok(r.conditionNotes?.includes("battery_high_health"));
    });

    it("battery 99% → battery_high_health", () => {
      const r = parse("아이폰 14 99%", "배터리 효율 99%.");
      assert.ok(r.conditionNotes?.includes("battery_high_health"));
    });

    it("battery 100% → battery_perfect (별도 신호)", () => {
      const r = parse("아이폰 14 100%", "배터리 효율 100%.");
      assert.ok(r.conditionNotes?.includes("battery_perfect"));
      assert.ok(!r.conditionNotes?.includes("battery_high_health"), "100% 는 battery_high_health 아님");
    });

    it("battery 90% → battery_high_health 아님 (95 미만)", () => {
      const r = parse("아이폰 14 90%", "배터리 90%.");
      assert.ok(!r.conditionNotes?.includes("battery_high_health"));
    });
  });

  describe("regression — 진짜 미개봉 매물 unopened 유지", () => {
    it("description '미개봉' + 배터리 측정 없음 + 풀박 → unopened", () => {
      const r = parse(
        "애플워치 SE2 40mm 미개봉 풀박스 새상품",
        "박스 미개봉 상태입니다. 풀구성. 봉인 안 뜯음.",
      );
      assert.equal(r.conditionClass, "unopened", `unopened 박혀야 — got: ${r.conditionClass}`);
    });
  });
});
