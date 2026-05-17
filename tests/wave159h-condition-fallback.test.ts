// Wave 159h (2026-05-17): condition fallback shared module 회귀 test.
// 박은 critical bug (unopened/mint 임의 fallback) 가 미래 회귀 안 들어오게.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  conditionFallbackChain,
  pickByConditionFallback,
  CONDITION_FALLBACK_CHAIN,
  SAFE_FINAL_FALLBACK,
} from "@/lib/condition-fallback";

describe("Wave 159h — conditionFallbackChain", () => {
  it("모든 8 condition 정의됨", () => {
    for (const cls of ["unopened", "mint", "clean", "normal", "worn", "low_batt", "flawed", "all"]) {
      assert.ok(CONDITION_FALLBACK_CHAIN[cls], `${cls} chain 누락`);
    }
  });

  it("flawed → worn 우선 (불특정 condition 잡지 않음)", () => {
    const chain = conditionFallbackChain("flawed");
    assert.deepEqual(chain, ["flawed", "worn", "low_batt", "normal", "all"]);
    // unopened/mint/clean 임의 fallback 금지
    assert.ok(!chain.includes("unopened"), "flawed chain에 unopened 있으면 차익 부풀려짐");
    assert.ok(!chain.includes("mint"), "flawed chain에 mint 있으면 차익 부풀려짐");
  });

  it("low_batt → worn/normal 우선 (mint/unopened 금지)", () => {
    const chain = conditionFallbackChain("low_batt");
    assert.ok(!chain.includes("unopened"));
    assert.ok(!chain.includes("mint"));
  });

  it("worn → normal 우선", () => {
    const chain = conditionFallbackChain("worn");
    assert.deepEqual(chain, ["worn", "normal", "all"]);
    assert.ok(!chain.includes("unopened"));
    assert.ok(!chain.includes("mint"));
  });

  it("미정의 condition은 보수적 default", () => {
    const chain = conditionFallbackChain("unknown_class");
    assert.deepEqual(chain, ["unknown_class", "normal", "worn", "clean", "all"]);
    assert.ok(!chain.includes("unopened"));
    assert.ok(!chain.includes("mint"));
  });

  it("null/undefined → normal default", () => {
    assert.deepEqual(conditionFallbackChain(null), CONDITION_FALLBACK_CHAIN.normal);
    assert.deepEqual(conditionFallbackChain(undefined), CONDITION_FALLBACK_CHAIN.normal);
  });

  it("SAFE_FINAL_FALLBACK에 unopened/mint 절대 없음", () => {
    assert.ok(!SAFE_FINAL_FALLBACK.includes("unopened"));
    assert.ok(!SAFE_FINAL_FALLBACK.includes("mint"));
  });
});

describe("Wave 159h — pickByConditionFallback", () => {
  type TestRow = { samples: number; price: number };
  const getSamples = (r: TestRow) => r.samples;

  it("target 매칭 + sample 충분 → target 선택", () => {
    const byCondition = new Map<string, TestRow>([
      ["normal", { samples: 5, price: 100 }],
      ["worn", { samples: 3, price: 80 }],
    ]);
    const result = pickByConditionFallback(byCondition, "normal", getSamples);
    assert.equal(result.row?.price, 100);
    assert.equal(result.conditionClass, "normal");
    assert.equal(result.fallbackUsed, false);
  });

  it("target sample 부족 → fallback chain 진행", () => {
    const byCondition = new Map<string, TestRow>([
      ["flawed", { samples: 1, price: 50 }],
      ["worn", { samples: 5, price: 80 }],
    ]);
    const result = pickByConditionFallback(byCondition, "flawed", getSamples);
    assert.equal(result.conditionClass, "worn");
    assert.equal(result.row?.price, 80);
    assert.equal(result.fallbackUsed, true);
  });

  it("**CRITICAL**: flawed target + unopened만 있음 → unopened 잡지 않음", () => {
    // pid 408329098 (iPhone 14 리퍼) 사례 — flawed 매물에 unopened 시세 fallback 차단 검증.
    const byCondition = new Map<string, TestRow>([
      ["unopened", { samples: 1, price: 1287000 }], // 다나와 새 가격
    ]);
    const result = pickByConditionFallback(byCondition, "flawed", getSamples);
    // unopened만 있으니 fallback chain 끝까지 진행 (sample 충분 X)
    // 마지막 fallback: SAFE_FINAL_FALLBACK = [normal, worn, clean] 순. 다 없음 → undefined.
    assert.equal(result.row, undefined, "flawed 매물에 unopened 임의 fallback 절대 X");
  });

  it("**CRITICAL**: flawed + unopened + worn → worn 선택 (unopened 임의 X)", () => {
    const byCondition = new Map<string, TestRow>([
      ["unopened", { samples: 1, price: 1287000 }],
      ["worn", { samples: 10, price: 400000 }],
    ]);
    const result = pickByConditionFallback(byCondition, "flawed", getSamples);
    assert.equal(result.conditionClass, "worn");
    assert.equal(result.row?.price, 400000);
  });

  it("**CRITICAL**: worn target + 다른 conditions → mint/unopened 임의 잡지 않음", () => {
    const byCondition = new Map<string, TestRow>([
      ["unopened", { samples: 5, price: 1000000 }],
      ["mint", { samples: 5, price: 800000 }],
    ]);
    // worn chain: ["worn", "normal", "all"] — unopened/mint 없음
    // 다 sample 부족도 아닌데 chain에 없음 → 안전 fallback 발동
    const result = pickByConditionFallback(byCondition, "worn", getSamples);
    // SAFE_FINAL_FALLBACK: normal/worn/clean — 둘 다 없음 → row undefined
    assert.equal(result.row, undefined, "worn 매물에 unopened/mint 임의 fallback 절대 X");
  });

  it("빈 byCondition → row undefined", () => {
    const result = pickByConditionFallback(undefined, "flawed", getSamples);
    assert.equal(result.row, undefined);
    assert.equal(result.conditionClass, null);
  });
});
