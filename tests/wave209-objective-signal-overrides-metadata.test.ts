// Wave 209 (2026-05-18): objective measurement 우선 — metadata worse-of 무시.
//
// 사용자 #159 재확인: Wave 203 박았는데 final condition_class 여전히 normal.
// 이유: resolveConditionClass worse-of 가 metadata "사용감 적음" (normal) 우선 → description clean 무시.
// 사용자 통찰: "metadata 신뢰도 낮음. 배터리/사이클 객관적 새거면 다르게 봐야".
// 근본 fix: battery_high_health (95~99%) / battery_perfect (100%) 있으면 description 우선.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListingOptions, resolveConditionClass } from "@/lib/option-parser";

function parse(title: string, description = "", bunjangLabel: string | null = null) {
  return parseListingOptions({
    title,
    description,
    category: "smartwatch",
    skuId: "applewatch-se2",
    skuName: "Apple Watch SE 2nd gen",
    bunjangConditionLabel: bunjangLabel,
  });
}

describe("Wave 209 — objective measurement 우선 (worse-of 무시)", () => {
  describe("사용자 #159 매물 재현 — 객관적 clean 신호 metadata override 무시", () => {
    it("배터리 97% + 풀박스 + metadata '사용감 적음' (LIGHTLY_USED) → clean 분류 (사용자 의도)", () => {
      const r = parse(
        "애플워치 SE2 40mm GPS 배터리 97%",
        "배터리 효율 97% 풀박스 구성품 전부 드림. 사용감 적음.",
        "LIGHTLY_USED",
      );
      assert.ok(r.conditionNotes?.includes("battery_high_health"), `battery_high_health 박혀야 — got: ${JSON.stringify(r.conditionNotes)}`);
      assert.ok(r.conditionNotes?.includes("full_set"), "full_set 박혀야");
      assert.equal(r.conditionClass, "clean", `clean 박혀야 (사용자 의도 — 객관적 신호 우선) — got: ${r.conditionClass}`);
    });

    it("배터리 100% + metadata '사용감 적음' → clean (battery_perfect 우선)", () => {
      const r = parse(
        "애플워치 SE2 배터리 100%",
        "배터리 효율 100% 풀구성.",
        "LIGHTLY_USED",
      );
      assert.equal(r.conditionClass, "clean");
    });

    it("배터리 98% + metadata 'LIKE_NEW' → clean (이미 LIKE_NEW 라서 worse-of OK)", () => {
      const r = parse(
        "애플워치 SE2 배터리 98%",
        "배터리 효율 98%.",
        "LIKE_NEW",
      );
      assert.equal(r.conditionClass, "clean");
    });
  });

  describe("regression — objective signal 없으면 worse-of 유지 (Wave 140 정책)", () => {
    it("metadata '사용감 적음' + description 무신호 → normal (worse-of OK)", () => {
      const r = parse("애플워치 SE2 GPS 40mm", "정상 작동.", "LIGHTLY_USED");
      assert.equal(r.conditionClass, "normal", `metadata "사용감 적음" 그대로 — got: ${r.conditionClass}`);
    });

    it("metadata '사용감 많음' + description '미개봉' (셀러 인플레) → worn (worse-of 유지, 객관적 신호 없음)", () => {
      const r = parse("애플워치 SE2", "미개봉 새상품.", "HEAVILY_USED");
      assert.equal(r.conditionClass, "worn", `셀러 인플레 metadata 우선 (객관적 신호 X) — got: ${r.conditionClass}`);
    });
  });

  describe("resolveConditionClass — hasObjectiveCleanSignal 가드", () => {
    it("metadata normal + notes clean + objective signal → clean (override 무시)", () => {
      assert.equal(resolveConditionClass("normal", "clean", true), "clean");
    });
    it("metadata normal + notes clean + 객관적 신호 없음 → normal (worse-of)", () => {
      assert.equal(resolveConditionClass("normal", "clean", false), "normal");
    });
    it("metadata worn + notes unopened + objective signal → unopened", () => {
      assert.equal(resolveConditionClass("worn", "unopened", true), "unopened");
    });
    it("metadata worn + notes worn + objective signal → worn (notes 이미 낮음)", () => {
      assert.equal(resolveConditionClass("worn", "worn", true), "worn");
    });
    it("metadata flawed + notes clean + objective signal → flawed (DAMAGED 명시적 손상 우선, 안전)", () => {
      // Wave 209: metadata "flawed" (DAMAGED) = 셀러 명시적 손상. 객관적 신호로 무시 X (false negative 차단).
      assert.equal(resolveConditionClass("flawed", "clean", true), "flawed");
    });
  });
});
