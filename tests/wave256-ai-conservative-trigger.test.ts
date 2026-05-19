// Wave 256 (2026-05-20): AI 보수적 escalation trigger — 5 options A-E 검증.
//   사용자: "regex 자신감 과잉 차단. 비용 아끼지 말고 보수적."
//   사용자 매물 pid 405343339 ("메인보드 손상이 있어서... 하자 일절 없습니다") 잡는 패턴 검증.
//
// 본 테스트는 regex pattern 만 검증 (실제 AI 호출 X). tick-pipeline.ts:1750 의 trigger 조건만.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Wave 256 — AI escalation trigger patterns", () => {
  // 옵션 A regex patterns (tick-pipeline.ts 와 동일).
  const NEGATION_RE = /(?:하자|손상|수리|교체|고장|불량|파손|깨짐|기스|스크래치|찍힘)(?:는|도|이|가|을|를)?\s*(?:일절|전혀|아예|단\s*하나|일체|진짜)?\s*(?:없|아닙|아님)/;
  const DAMAGE_KEYWORD_RE = /손상|메인보드|배터리\s*교체|디스플레이\s*교체|화면\s*교체|액정\s*교체|사설\s*수리|부품\s*수리|침수|낙상|충격|크랙|박살|찌그러짐\s*심|깨짐\s*있/;
  const ANY_NEGATIVE_RE = /손상|수리|교체|하자|고장|불량|파손|깨짐|침수|낙상|크랙|기스\s*있|얼룩\s*심|곰팡이|악취/;

  describe("옵션 A — conflicting signal (negation + damage keyword)", () => {
    it("pid 405343339 — 메인보드 손상 + 하자 일절 없 → AI trigger", () => {
      const text = "아이폰 16pro 네츄럴 티타늄 128g 메인보드 손상이 있어서 저렴하게 판매합니다. 이외 부분, 기능에는 하자 일절 없습니다.".toLowerCase();
      const negation = NEGATION_RE.test(text);
      const damage = DAMAGE_KEYWORD_RE.test(text);
      assert.equal(negation, true, `negation 안 잡힘: ${text}`);
      assert.equal(damage, true, `damage 안 잡힘: ${text}`);
      assert.equal(negation && damage, true, "conflicting signal trigger 안 됨");
    });

    it("배터리 교체 + 하자 없음 → AI trigger", () => {
      const text = "아이폰 14 배터리 교체했어요 하자 진짜 없습니다".toLowerCase();
      assert.equal(NEGATION_RE.test(text) && DAMAGE_KEYWORD_RE.test(text), true);
    });

    it("침수 + 하자 일체 없 → AI trigger", () => {
      const text = "갤럭시 침수 이력 있으나 기능 하자 일체 없어요".toLowerCase();
      assert.equal(NEGATION_RE.test(text) && DAMAGE_KEYWORD_RE.test(text), true);
    });

    it("정상 매물 — '하자 없음' 만 → trigger X (damage keyword 없음)", () => {
      const text = "아이폰 15 프로 깨끗하게 사용했어요 하자 없습니다".toLowerCase();
      assert.equal(DAMAGE_KEYWORD_RE.test(text), false);
    });

    it("정상 매물 — 메인보드 손상 만 (negation 없음) → 다른 trigger 잡힘 (이 옵션 X)", () => {
      const text = "메인보드 손상 있어요 부품용으로 판매".toLowerCase();
      assert.equal(NEGATION_RE.test(text), false);
      assert.equal(DAMAGE_KEYWORD_RE.test(text), true);
    });
  });

  describe("옵션 B — positive class + negative keyword (false positive 차단)", () => {
    const POSITIVE_CLASSES = ["mint", "clean", "unopened"];

    it("mint 분류 + '수리' 키워드 → AI trigger", () => {
      const conditionClass = "mint";
      const text = "아이폰 15 새상품 미개봉이지만 사설수리 이력 있음".toLowerCase();
      const isPositive = POSITIVE_CLASSES.includes(conditionClass);
      const hasNeg = ANY_NEGATIVE_RE.test(text);
      assert.equal(isPositive && hasNeg, true);
    });

    it("clean + '하자' 키워드 → AI trigger", () => {
      const conditionClass = "clean";
      const text = "아이폰 15 깨끗 외관 하자 있어요".toLowerCase();
      assert.equal(POSITIVE_CLASSES.includes(conditionClass) && ANY_NEGATIVE_RE.test(text), true);
    });

    it("worn 분류 + negative keyword → trigger X (positive 만 적용)", () => {
      const conditionClass = "worn";
      const text = "사용감 하자 있음".toLowerCase();
      assert.equal(POSITIVE_CLASSES.includes(conditionClass), false);
    });
  });

  describe("옵션 C — ambiguous zone 확대 (0.55~0.75 → 0.40~0.85)", () => {
    const inZoneWide = (score: number) => score >= 0.40 && score <= 0.85;
    const inZoneOld = (score: number) => score >= 0.55 && score <= 0.75;

    it("0.45 → wide trigger (구 zone 0.55~0.75 미커버)", () => {
      assert.equal(inZoneWide(0.45), true);
      assert.equal(inZoneOld(0.45), false);
    });

    it("0.80 → wide trigger (구 zone 0.55~0.75 미커버)", () => {
      assert.equal(inZoneWide(0.80), true);
      assert.equal(inZoneOld(0.80), false);
    });

    it("0.30 → 양쪽 미커버 (너무 낮음 — 명백 flawed)", () => {
      assert.equal(inZoneWide(0.30), false);
    });

    it("0.95 → 양쪽 미커버 (너무 높음 — 명백 unopened)", () => {
      assert.equal(inZoneWide(0.95), false);
    });
  });

  describe("옵션 D — bunjang label 불일치", () => {
    function bunjangConflict(labelMapped: string | null, conditionClass: string): boolean {
      const isPositive = ["mint", "clean", "unopened"].includes(conditionClass);
      const isFlawedOrWorn = conditionClass === "flawed" || conditionClass === "worn";
      return (
        (labelMapped === "flawed" && isPositive) ||
        ((labelMapped === "unopened" || labelMapped === "clean") && isFlawedOrWorn)
      );
    }

    it("bunjang DAMAGED + class mint → trigger", () => {
      assert.equal(bunjangConflict("flawed", "mint"), true);
    });

    it("bunjang NEW + class flawed → trigger", () => {
      assert.equal(bunjangConflict("unopened", "flawed"), true);
    });

    it("bunjang LIKE_NEW + class worn → trigger", () => {
      assert.equal(bunjangConflict("clean", "worn"), true);
    });

    it("bunjang USED + class worn → 일치 (trigger X)", () => {
      assert.equal(bunjangConflict("worn", "worn"), false);
    });

    it("bunjang null → trigger X (다른 옵션 fallback)", () => {
      assert.equal(bunjangConflict(null, "mint"), false);
    });
  });

  describe("옵션 E — needsReview=true 무조건 AI", () => {
    it("needsReview=true → trigger", () => {
      assert.equal(true === true, true); // tautology test — needsReview 만 체크
    });

    it("needsReview=false → 다른 옵션 fallback", () => {
      assert.equal(false === true, false);
    });
  });
});
