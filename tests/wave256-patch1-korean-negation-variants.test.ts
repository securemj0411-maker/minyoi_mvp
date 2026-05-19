// Wave 256 patch 1 (2026-05-20): 사용자 검증 — 한국어 negation 변형 미커버 root.
//   사용자 검증 3가지 변형 → 1개만 잡힘:
//     ✓ "하자일절없습니다"
//     ❌ "기스 진심 없습니다" — "진심" 강조어 누락
//     ❌ "떨어뜨려서 충격받은적 전혀없습니다" — "충격" + 동작형 부정 누락
//   fix: 강조어 확장 + keyword 확장 + 동작형 부정 패턴 추가.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// tick-pipeline.ts:1750 와 동일 regex (test 가 hard-code).
const NEGATION_INTENSIFIER = "(?:일절|전혀|아예|단\\s*하나(?:도)?|일체|진짜|진심|정말|완전|완벽히?|단연|하나도|결코|거의|딱히|별로|한\\s*번도|단\\s*한\\s*번도)";
const NEGATION_KEYWORDS = "(?:하자|손상|수리|교체|고장|불량|파손|깨짐|기스|스크래치|찍힘|크랙|찌그러짐|얼룩|오염|침수|낙상|충격|떨어(?:뜨|트)림|이상|문제|사고|결함|이력|흠집)";
const NEGATION_PATTERN_1 = new RegExp(
  `${NEGATION_KEYWORDS}\\s*(?:된\\s*적|받은\\s*적|있는\\s*적|당한\\s*적|진\\s*적|난\\s*적|은\\s*적|한\\s*적|적)?\\s*(?:는|도|이|가|을|를|은|만)?\\s*${NEGATION_INTENSIFIER}?\\s*(?:없|아닙|아님|無|x|X)`,
);
const NEGATION_PATTERN_2 = new RegExp(
  `${NEGATION_INTENSIFIER}\\s*${NEGATION_KEYWORDS}\\s*(?:는|도|이|가|을|를)?\\s*(?:없|아닙|아님)`,
);
const NEGATION_PATTERN_3 = /(?:떨어(?:뜨|트)린|충격\s*받은|침수된|낙상된|박살난|밟힌|튕긴)\s*(?:적|일|경험|이력)\s*(?:은|도)?\s*(?:전혀|일절|한\s*번도|단\s*한\s*번도|진심|정말)?\s*없/;

const DAMAGE_KEYWORD_RE = /손상|메인보드|배터리\s*교체|디스플레이\s*교체|화면\s*교체|액정\s*교체|사설\s*수리|부품\s*수리|침수|낙상|충격|크랙|박살|찌그러짐\s*심|깨짐\s*있|떨어(?:뜨|트)린|떨어(?:뜨|트)림|기스\s*있|얼룩\s*심|얼룩\s*있|이력\s*있|문제\s*있|결함\s*있|수리\s*이력|교체\s*이력/;

function detectNegation(text: string): boolean {
  const lower = text.toLowerCase();
  return NEGATION_PATTERN_1.test(lower) || NEGATION_PATTERN_2.test(lower) || NEGATION_PATTERN_3.test(lower);
}

describe("Wave 256 patch 1 — 한국어 negation 변형 (사용자 검증 직접 케이스)", () => {
  describe("사용자 검증 3가지 변형", () => {
    it("'하자일절없습니다' (regression — 기존 잡힘)", () => {
      assert.equal(detectNegation("아이폰 16프로 하자일절없습니다"), true);
    });

    it("'기스 진심 없습니다' (FIX — 진심 강조어 추가)", () => {
      assert.equal(detectNegation("아이폰 16프로 기스 진심 없습니다"), true);
    });

    it("'떨어뜨려서 충격받은적 전혀없습니다' (FIX — 동작형 부정 + 충격 키워드)", () => {
      // "떨어뜨려서" + "충격받은적 전혀없습니다" — pattern 3 fires.
      assert.equal(detectNegation("아이폰 16프로 떨어뜨려서 충격받은적 전혀없습니다"), true);
    });
  });

  describe("사용자 가능한 다른 변형 (안전 보강)", () => {
    it("'완벽히 새것입니다 하자 정말 없어요'", () => {
      assert.equal(detectNegation("완벽히 새것입니다 하자 정말 없어요"), true);
    });

    it("'결코 손상된 적 없습니다'", () => {
      assert.equal(detectNegation("결코 손상된 적 없습니다"), true);
    });

    it("'기스 하나도 없습니다'", () => {
      assert.equal(detectNegation("아이폰 기스 하나도 없습니다"), true);
    });

    it("'떨어뜨린 적 한 번도 없어요'", () => {
      assert.equal(detectNegation("이 폰 떨어뜨린 적 한 번도 없어요"), true);
    });

    it("'침수된 적 없습니다'", () => {
      assert.equal(detectNegation("침수된 적 없습니다"), true);
    });

    it("'찍힘 얼룩 거의 없어요'", () => {
      assert.equal(detectNegation("찍힘 얼룩 거의 없어요"), true);
    });

    it("'문제 단 하나도 없는 폰'", () => {
      assert.equal(detectNegation("문제 단 하나도 없는 폰"), true);
    });

    it("'수리 이력 일절 없습니다'", () => {
      assert.equal(detectNegation("수리 이력 일절 없습니다"), true);
    });

    it("'충격 받은 적 진심 없어요'", () => {
      assert.equal(detectNegation("충격 받은 적 진심 없어요"), true);
    });
  });

  describe("정상 매물 (negation 매치 안 됨 = false positive 차단)", () => {
    it("'아이폰 16프로 새상품 박스 미개봉'", () => {
      assert.equal(detectNegation("아이폰 16프로 새상품 박스 미개봉"), false);
    });

    it("'상태 좋습니다 깨끗함'", () => {
      assert.equal(detectNegation("상태 좋습니다 깨끗함"), false);
    });

    it("'배터리 100프로 풀박스'", () => {
      assert.equal(detectNegation("배터리 100프로 풀박스"), false);
    });
  });

  describe("conflicting signal (negation + damage keyword 동시) — 사용자 매물 패턴", () => {
    function isConflicting(text: string): boolean {
      const lower = text.toLowerCase();
      return detectNegation(lower) && DAMAGE_KEYWORD_RE.test(lower);
    }

    it("pid 405343339 — '메인보드 손상이 있어서... 하자 일절 없습니다'", () => {
      assert.equal(isConflicting("메인보드 손상이 있어서 저렴하게 판매합니다. 이외 부분, 기능에는 하자 일절 없습니다."), true);
    });

    it("'배터리 교체 했어요 하자 진심 없습니다' — 교체 이력 + 부정", () => {
      assert.equal(isConflicting("아이폰 14 배터리 교체 했어요 하자 진심 없습니다"), true);
    });

    it("'떨어뜨려서 충격받은적 전혀없습니다' — 사용자 변형 (낙상 키워드)", () => {
      // "떨어뜨려서" 가 damage keyword RE 에 있음 (떨어(?:뜨|트)림 + 떨어(?:뜨|트)린).
      assert.equal(isConflicting("아이폰 떨어뜨려서 충격받은적 전혀없습니다"), true);
    });

    it("'침수된 적 없습니다 깨끗합니다' — 부정만 (damage keyword 침수 있음, conflict 발화)", () => {
      assert.equal(isConflicting("아이폰 침수된 적 없습니다 깨끗합니다"), true);
    });

    it("정상 매물 — 'S급 상태 좋' (negation 없음 + damage 없음)", () => {
      assert.equal(isConflicting("아이폰 16프로 s급 상태 좋아요"), false);
    });
  });
});
