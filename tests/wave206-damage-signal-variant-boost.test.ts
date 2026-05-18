// Wave 206 (2026-05-18): damage signal 변형 보강.
//
// 사용자 코멘트 #160 (pid 399177378 AirPods 4 ANC): "본체가 안닫히고 떨어트림 많음" → worn 잘못.
// 누락된 변형: "떨어트림" (옛 "떨어뜨려" 만), "본체 안 닫힘" closure 불량.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListingOptions } from "@/lib/option-parser";

function parse(title: string, description = "") {
  return parseListingOptions({
    title,
    description,
    category: "earphone",
    skuId: "airpods-4-anc",
    skuName: "AirPods 4 (ANC)",
  });
}

describe("Wave 206 — damage signal 변형 보강", () => {
  describe("closure defect (본체 안 닫힘)", () => {
    it("'본체 안닫히고 떨어트림 많음' → repair_or_defect_signal + flawed (사용자 보고 매물)", () => {
      const r = parse("에어팟4세대 노캔", "본체가 안닫히고 떨어트림 많음. 잘 안 들리는 경우도 있음.");
      assert.ok(r.conditionNotes?.includes("repair_or_defect_signal"), `repair_or_defect_signal 박혀야 — got: ${JSON.stringify(r.conditionNotes)}`);
      assert.equal(r.conditionClass, "flawed", `flawed 박혀야 (worn 아님) — got: ${r.conditionClass}`);
    });

    it("'본체 닫히지 않음' → repair_or_defect_signal", () => {
      const r = parse("에어팟프로 2세대", "본체가 닫히지 않습니다.");
      assert.ok(r.conditionNotes?.includes("repair_or_defect_signal"));
    });

    it("'케이스 안닫힘' → repair_or_defect_signal", () => {
      const r = parse("에어팟 케이스 단품", "케이스 안닫힘 상태입니다.");
      assert.ok(r.conditionNotes?.includes("repair_or_defect_signal"));
    });
  });

  describe("drop/impact variant (떨어트림)", () => {
    it("'떨어트림' (변형) → repair_or_defect_signal", () => {
      const r = parse("에어팟4세대", "사용 중 떨어트림 있었음. 동작은 정상.");
      assert.ok(r.conditionNotes?.includes("repair_or_defect_signal"));
    });

    it("'떨어트린 적 있어요' → repair_or_defect_signal", () => {
      const r = parse("에어팟프로 2", "한 번 떨어트린 적 있어요.");
      assert.ok(r.conditionNotes?.includes("repair_or_defect_signal"));
    });

    it("'자주 떨어트렸어요' → repair_or_defect_signal", () => {
      const r = parse("에어팟 맥스", "자주 떨어트렸어요.");
      assert.ok(r.conditionNotes?.includes("repair_or_defect_signal"));
    });
  });

  describe("regression — 정상 표현 negation", () => {
    it("'본체 잘 닫힘' → repair_or_defect_signal 박지 X", () => {
      const r = parse("에어팟4세대", "본체 잘 닫히고 작동 정상입니다.");
      assert.ok(!r.conditionNotes?.includes("repair_or_defect_signal"));
    });

    it("'본체 정상으로 닫힘' → repair_or_defect_signal 박지 X", () => {
      const r = parse("에어팟 프로 2", "본체 정상으로 닫히고 페어링 잘 됨.");
      assert.ok(!r.conditionNotes?.includes("repair_or_defect_signal"));
    });
  });
});
