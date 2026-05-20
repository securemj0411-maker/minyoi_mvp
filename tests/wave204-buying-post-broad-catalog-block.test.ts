// Wave 204 (2026-05-18): buy-intent 매물 broad catalog 일반 차단.
//
// 사용자 코멘트 #155 (pid 397387660): "갤탭 s9 fe 플러스 구함" — broad SKU galaxy-tab-s9-fe-plus 진입.
// 기존: narrow lane (ipad_pro_11_m4 / sony_wh1000xm4 / iphone_15_pro_128) 3개만 buying_post reject.
// 근본 fix: parser 일반 detection → buying_post note → FLAWED + POOL_BLOCK + COMPARABLE_EXCLUDE 모두.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListingOptions, extractConditionClass, FLAWED_NOTES } from "@/lib/option-parser";
import { POOL_BLOCK_NOTES, COMPARABLE_EXCLUDE_NOTES } from "@/lib/condition-policy";

function parse(title: string, description = "", category: "tablet" | "smartphone" | "earphone" = "tablet", skuId = "galaxy-tab-s9-fe-plus", skuName = "Galaxy Tab S9 FE Plus") {
  return parseListingOptions({
    title,
    description,
    category,
    skuId,
    skuName,
  });
}

describe("Wave 204 — buy-intent 매물 broad catalog 일반 차단", () => {
  describe("buying_post note 박힘 (broad catalog 일반)", () => {
    it("title '구함' 단독 → buying_post 박힘 (사용자 보고 매물)", () => {
      const r = parse("갤탭 s9 fe 플러스 구함", "구매 합리적으로 진행합니다.");
      assert.ok(r.conditionNotes?.includes("buying_post"), `buying_post 박혀야 — got: ${JSON.stringify(r.conditionNotes)}`);
    });

    it("title '삽니다' → buying_post", () => {
      const r = parse("아이폰 15 256gb 삽니다", "정중히 매입 진행.");
      assert.ok(r.conditionNotes?.includes("buying_post"));
    });

    it("title '매입' → buying_post", () => {
      const r = parse("애플워치 SE2 매입 합니다", "");
      assert.ok(r.conditionNotes?.includes("buying_post"));
    });

    it("title '구합니다' → buying_post", () => {
      const r = parse("갤럭시 버즈3 프로 구합니다", "");
      assert.ok(r.conditionNotes?.includes("buying_post"));
    });

    it("title 'wtb' (영문) → buying_post", () => {
      const r = parse("Sony WH-1000XM5 WTB", "Looking to buy");
      assert.ok(r.conditionNotes?.includes("buying_post"));
    });
  });

  describe("buying_post → condition_class flawed (FLAWED 매핑)", () => {
    it("title '구함' → flawed 분류", () => {
      const r = parse("갤탭 s9 fe 플러스 구함");
      assert.equal(r.conditionClass, "flawed", `flawed 박혀야 (POOL_BLOCK + 시세 sample 제외) — got: ${r.conditionClass}`);
    });
  });

  describe("POOL_BLOCK + COMPARABLE_EXCLUDE 검증 (drift 차단)", () => {
    it("buying_post 는 FLAWED_NOTES 에 있음", () => {
      assert.ok((FLAWED_NOTES as readonly string[]).includes("buying_post"));
    });
    it("buying_post 는 POOL_BLOCK_NOTES 에 있음", () => {
      assert.ok((POOL_BLOCK_NOTES as readonly string[]).includes("buying_post"));
    });
    it("buying_post 는 COMPARABLE_EXCLUDE_NOTES 에 있음 (POOL_BLOCK subset 자동)", () => {
      assert.ok((COMPARABLE_EXCLUDE_NOTES as readonly string[]).includes("buying_post"));
    });
    it("condition_class 자체를 만드는 notes는 비교군 UI 제외 목록에 두지 않음", () => {
      assert.ok(!(COMPARABLE_EXCLUDE_NOTES as readonly string[]).includes("new_or_open_box"));
      assert.ok(!(COMPARABLE_EXCLUDE_NOTES as readonly string[]).includes("low_battery_health"));
    });
  });

  describe("regression — 정상 판매 매물 false positive 차단", () => {
    it("정상 판매 'OOO 판매합니다' → buying_post 박지 X", () => {
      const r = parse("갤탭 s9 fe 플러스 판매합니다", "사용감 적음, 풀박스 구성품.");
      assert.ok(!r.conditionNotes?.includes("buying_post"));
    });

    it("정상 판매 description '구매하시면 빠른 배송' → title 만 체크라 buying_post X", () => {
      const r = parse("갤탭 s9 fe 플러스 256gb", "구매하시면 빠른 배송 처리.");
      assert.ok(!r.conditionNotes?.includes("buying_post"), `description 만 매칭이면 차단 안 되어야 (title-only) — got: ${JSON.stringify(r.conditionNotes)}`);
    });

    it("'개봉' 정상 표현 → buying_post 박지 X", () => {
      const r = parse("갤탭 s9 fe 플러스 미개봉", "포장 안 뜯음.");
      assert.ok(!r.conditionNotes?.includes("buying_post"));
    });
  });

  describe("extractConditionClass — buying_post 가 flawed 매핑", () => {
    it("buying_post 단독 → flawed", () => {
      assert.equal(extractConditionClass(["buying_post"]), "flawed");
    });
    it("buying_post + positive 신호 → flawed (worse-of)", () => {
      assert.equal(extractConditionClass(["buying_post", "good_condition", "full_set"]), "flawed");
    });
  });
});
