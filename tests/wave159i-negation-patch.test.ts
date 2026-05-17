// Wave 159i (2026-05-17): flawed false positive negation 회귀 test.
// 정상 매물이 flawed로 잘못 분류 안 되게 차단.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseListingOptions } from "@/lib/option-parser";

function parse(title: string, desc: string) {
  return parseListingOptions({ title, description: desc });
}

describe("Wave 159i — flawed false positive negation 회귀 차단", () => {
  it("'정품 배터리 교체' 명시 → flawed 아님 (셀러 공식 교체)", () => {
    const r = parse(
      "아이폰 14 프로맥스 128GB",
      "배터리 성능 100% 정품배터리교체. 모든 기능 정상 작동합니다.",
    );
    assert.notEqual(r.conditionClass, "flawed", `정품 배터리 교체 매물이 flawed로 분류됨: ${JSON.stringify(r.conditionNotes)}`);
  });

  it("'잔상이나 화면 하자 없' 부정형 정상 표현 → flawed 아님", () => {
    const r = parse(
      "아이폰 14 프로 256GB",
      "액정 깨끗합니다. 잔상이나 화면하자 없어요. 외관 극미세사용감 있어요.",
    );
    assert.notEqual(r.conditionClass, "flawed", `잔상 없 매물이 flawed로 분류됨: ${JSON.stringify(r.conditionNotes)}`);
  });

  it("'전 기능 이상없' / '모든 기능 정상' → flawed 아님", () => {
    const r = parse(
      "갤럭시 S22 256GB",
      "정상 해지폰 공기계폰. 전기능 이상없고 베터리 최상입니다.",
    );
    assert.notEqual(r.conditionClass, "flawed");
  });

  it("'잔상, 멍 없' 부정형 → display_defect 아님", () => {
    const r = parse(
      "아이폰 15 프로 256GB",
      "잔상, 멍 없습니다. 기능 문제 없습니다. 외관 신품급.",
    );
    assert.notEqual(r.conditionClass, "flawed");
  });

  it("진짜 flawed 매물은 그대로 분류 (negation false positive 검증)", () => {
    const r = parse(
      "아이폰 13 깨진 액정",
      "액정 깨져서 수리 필요. 잔상 있음. 카메라 안됨.",
    );
    assert.equal(r.conditionClass, "flawed", `진짜 flawed 매물이 normal로 분류됨: ${JSON.stringify(r.conditionNotes)}`);
  });
});
