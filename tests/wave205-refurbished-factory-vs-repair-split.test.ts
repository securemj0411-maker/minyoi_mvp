// Wave 205 (2026-05-18): refurbished 분리 — 공식 리퍼 vs 사설/부분 수리.
//
// 사용자 코멘트 #158 (pid 408779051): "DJI 오즈모 포켓3 리퍼 미개봉" → flawed.
// 사용자 의문: "리퍼 ≠ 훼손". 공식 리퍼는 박스 미개봉 + 1회 공식 수리 후 재판매 (정상 작동).
// 기존: 리퍼/사설수리/부분수리 모두 refurbished_or_repaired (FLAWED) → flawed.
// 근본 fix:
//   - 공식 리퍼 → refurbished_factory (FLAWED X, 정상 시세)
//   - 사설/부분/일부/자가 수리 → refurbished_or_repaired 유지 (FLAWED, 훼손 흔적)

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListingOptions, extractConditionClass, FLAWED_NOTES } from "@/lib/option-parser";

function parse(title: string, description = "") {
  return parseListingOptions({
    title,
    description,
    category: "drone",
    skuId: "dji-osmo-pocket-3",
    skuName: "DJI Osmo Pocket 3",
  });
}

describe("Wave 205 — refurbished factory vs unofficial repair 분리", () => {
  describe("공식 리퍼 → refurbished_factory (FLAWED X)", () => {
    it("'리퍼 미개봉' → refurbished_factory + new_or_open_box (사용자 보고 매물)", () => {
      const r = parse(
        "DJI 오즈모 포켓3 리퍼 미개봉",
        "리퍼 제품이지만 박스 미개봉 그대로입니다. 풀구성 드림.",
      );
      assert.ok(r.conditionNotes?.includes("refurbished_factory"), `refurbished_factory 박혀야 — got: ${JSON.stringify(r.conditionNotes)}`);
      assert.ok(!r.conditionNotes?.includes("refurbished_or_repaired"), `refurbished_or_repaired 박지 X (공식 리퍼) — got: ${JSON.stringify(r.conditionNotes)}`);
      assert.ok(r.conditionNotes?.includes("new_or_open_box"), `new_or_open_box 박혀야 (미개봉) — got: ${JSON.stringify(r.conditionNotes)}`);
    });

    it("'리퍼폰' → refurbished_factory", () => {
      const r = parse("아이폰 15 리퍼폰", "리퍼폰입니다.");
      assert.ok(r.conditionNotes?.includes("refurbished_factory"));
      assert.ok(!r.conditionNotes?.includes("refurbished_or_repaired"));
    });

    it("'리퍼 제품' → refurbished_factory", () => {
      const r = parse("애플워치 SE2 리퍼 제품", "리퍼 제품입니다.");
      assert.ok(r.conditionNotes?.includes("refurbished_factory"));
    });

    it("공식 리퍼 + 미개봉 → condition_class unopened (FLAWED X 검증)", () => {
      const r = parse(
        "DJI 오즈모 포켓3 리퍼 미개봉",
        "리퍼 제품이지만 박스 미개봉 그대로. 풀구성.",
      );
      assert.equal(r.conditionClass, "unopened", `unopened 박혀야 (refurbished_factory + new_or_open_box, FLAWED X) — got: ${r.conditionClass}`);
    });
  });

  describe("사설/부분 수리 → refurbished_or_repaired (FLAWED 유지)", () => {
    it("'사설 수리' → refurbished_or_repaired", () => {
      const r = parse("아이폰 15 액정 사설 수리 받았어요", "사설 수리 후 정상.");
      assert.ok(r.conditionNotes?.includes("refurbished_or_repaired"));
      assert.ok(!r.conditionNotes?.includes("refurbished_factory"));
    });

    it("'부분 수리' → refurbished_or_repaired", () => {
      const r = parse("갤럭시 S23 부분 수리", "부분 수리 이력 있음.");
      assert.ok(r.conditionNotes?.includes("refurbished_or_repaired"));
    });

    it("'자가 수리' → refurbished_or_repaired", () => {
      const r = parse("아이폰 14 자가 수리 진행", "자가 수리 완료.");
      assert.ok(r.conditionNotes?.includes("refurbished_or_repaired"));
    });

    it("사설 수리 → condition_class flawed (FLAWED 매핑)", () => {
      const r = parse("아이폰 15 액정 사설 수리 받았어요", "사설 수리 후 정상.");
      assert.equal(r.conditionClass, "flawed");
    });
  });

  describe("regression — '리퍼 아님' negation 유지", () => {
    it("'리퍼 아닙니다' → refurbished 신호 박지 X", () => {
      const r = parse("아이폰 15 정품", "리퍼 아닙니다. 정식 발매품.");
      assert.ok(!r.conditionNotes?.includes("refurbished_factory"));
      assert.ok(!r.conditionNotes?.includes("refurbished_or_repaired"));
    });
  });

  describe("정책 검증", () => {
    it("refurbished_factory 는 FLAWED_NOTES 에 없음", () => {
      assert.ok(!(FLAWED_NOTES as readonly string[]).includes("refurbished_factory"));
    });
    it("refurbished_or_repaired 는 FLAWED_NOTES 에 유지", () => {
      assert.ok((FLAWED_NOTES as readonly string[]).includes("refurbished_or_repaired"));
    });
    it("refurbished_factory 단독 → normal 분류 (FLAWED X)", () => {
      assert.equal(extractConditionClass(["refurbished_factory"]), "normal");
    });
    it("refurbished_factory + new_or_open_box → unopened", () => {
      assert.equal(extractConditionClass(["refurbished_factory", "new_or_open_box"]), "unopened");
    });
  });
});
