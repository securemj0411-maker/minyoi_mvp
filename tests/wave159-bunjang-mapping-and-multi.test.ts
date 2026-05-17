// Wave 159 (2026-05-17): bunjang 영어 enum 매핑 + description 다중상품 검출.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bunjangLabelToConditionClass, resolveConditionClass } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

describe("Wave 158 — bunjang 영어 enum 매핑", () => {
  it("DAMAGED → flawed", () => {
    assert.equal(bunjangLabelToConditionClass("DAMAGED"), "flawed");
  });

  it("HEAVILY_USED → worn", () => {
    assert.equal(bunjangLabelToConditionClass("HEAVILY_USED"), "worn");
  });

  it("USED → worn (보수적)", () => {
    assert.equal(bunjangLabelToConditionClass("USED"), "worn");
  });

  it("LIGHTLY_USED → normal", () => {
    assert.equal(bunjangLabelToConditionClass("LIGHTLY_USED"), "normal");
  });

  it("LIKE_NEW → clean", () => {
    assert.equal(bunjangLabelToConditionClass("LIKE_NEW"), "clean");
  });

  it("NEW → unopened", () => {
    assert.equal(bunjangLabelToConditionClass("NEW"), "unopened");
  });

  it("한글 fallback 보존 (legacy)", () => {
    assert.equal(bunjangLabelToConditionClass("사용감 많음"), "worn");
    assert.equal(bunjangLabelToConditionClass("거의 새것"), "clean");
    assert.equal(bunjangLabelToConditionClass("새상품"), "unopened");
  });

  it("null/빈 문자열 → null", () => {
    assert.equal(bunjangLabelToConditionClass(null), null);
    assert.equal(bunjangLabelToConditionClass(""), null);
    assert.equal(bunjangLabelToConditionClass("UNKNOWN_VALUE"), null);
  });
});

describe("Wave 158 — resolveConditionClass worse-of-rank", () => {
  it("meta=null → notes 단독", () => {
    assert.equal(resolveConditionClass(null, "worn"), "worn");
    assert.equal(resolveConditionClass(null, "normal"), "normal");
  });

  it("notes=normal → meta 신뢰", () => {
    assert.equal(resolveConditionClass("clean", "normal"), "clean");
    assert.equal(resolveConditionClass("unopened", "normal"), "unopened");
  });

  it("worse-of-rank: clean meta + worn notes → worn (낮은 rank 우선)", () => {
    assert.equal(resolveConditionClass("clean", "worn"), "worn");
  });

  it("worse-of-rank: unopened meta + clean notes → clean", () => {
    assert.equal(resolveConditionClass("unopened", "clean"), "clean");
  });

  it("low_batt 항상 우선", () => {
    assert.equal(resolveConditionClass("low_batt", "clean"), "low_batt");
    assert.equal(resolveConditionClass("clean", "low_batt"), "low_batt");
  });

  it("flawed: notes에 있으면 우선 (worse-of-rank)", () => {
    assert.equal(resolveConditionClass("clean", "flawed"), "flawed");
    assert.equal(resolveConditionClass("unopened", "flawed"), "flawed");
  });

  it("실제 시나리오: pid 405711280 LIKE_NEW + full_set description → worse-of-rank", () => {
    // bunjang label LIKE_NEW → clean, description "풀세트" → clean (CLEAN_NOTES.full_set)
    // 같은 rank → 그대로 clean
    assert.equal(resolveConditionClass("clean", "clean"), "clean");
  });

  it("실제 시나리오: pid 397901264 LIKE_NEW + cosmetic_wear → worn", () => {
    // bunjang label 없음 (null), description "테두리 미세 잔얼룩" → cosmetic_wear → worn
    assert.equal(resolveConditionClass(null, "worn"), "worn");
  });
});

describe("Wave 159 — description 다중상품 검출 (classifyListing 통합)", () => {
  it("pid 364899054 케이스: 미개봉 애플워치 10 다중상품 (42mm 60만 / 46mm 62만 / 46mm 64만)", () => {
    const title = "미개봉 애플워치 10 셀룰러 42mm 46mm";
    const desc = `미개봉 국내정품입니다

제트블랙 블랙 42mm ML 60만

로즈 골드 알루미늄 46mm, 플럼 스포츠 루프 62만

실버 데님 알루미늄 46mm 데님스포츠 SM 64만`;
    const result = classifyListing(title, desc, 600000);
    assert.equal(result.listingType, "multi");
  });

  it("정상 매물 (가격 1개)는 multi로 잡히지 않음", () => {
    const title = "에어팟 프로 2세대 USB-C 풀박스";
    const desc = "정품 새상품급 판매. 150,000원에 직거래 우선합니다.";
    const result = classifyListing(title, desc, 150000);
    assert.notEqual(result.listingType, "multi");
  });

  it("원가 비교 정상 매물 (가격 2개)는 multi로 잡히지 않음", () => {
    const title = "갤럭시 워치 7";
    const desc = "정가 30만원짜리 거의 새것입니다. 22만원 처분합니다.";
    const result = classifyListing(title, desc, 220000);
    assert.notEqual(result.listingType, "multi");
  });
});
