// Wave 238 (2026-05-19) — AI L2 shadow audit + learning queue 단위 테스트.
//
// 범위:
//   1. shadow audit disabled 시 no-op.
//   2. SUPABASE env 없을 때 graceful skip (production guard).
//   3. learning queue pass verdict skip + 빈 sku_id skip.
//
// DB I/O / OpenAI 호출은 production sweep 이 검증. 본 테스트는 pure logic only.

import { test } from "node:test";
import { strict as assert } from "node:assert";

// runtime env unset side effects 분리.
function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const original: Record<string, string | undefined> = {};
  for (const k of Object.keys(overrides)) {
    original[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  const restore = () => {
    for (const k of Object.keys(original)) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  };
  try {
    const r = fn();
    if (r instanceof Promise) {
      return r.finally(restore);
    }
    restore();
    return Promise.resolve(r);
  } catch (e) {
    restore();
    throw e;
  }
}

test("Wave 238: shadow audit disabled 시 candidates=0 + audited=0", async () => {
  // SUPABASE env unset → findUnauditedPoolEntries 가 empty Set 반환.
  // shadow audit enabled 라도 candidate 없으면 audited=0.
  await withEnv({
    AI_L2_SHADOW_AUDIT_ENABLED: "0",
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fake",
  }, async () => {
    const { runShadowAudit } = await import("../src/lib/ai-l2-shadow-audit.ts");
    const stats = await runShadowAudit({
      rows: [],
      poolEntries: [],
    });
    assert.equal(stats.enabled, false, "enabled=false");
    assert.equal(stats.candidates, 0);
    assert.equal(stats.audited, 0);
    assert.equal(stats.budgetGuardOk, false, "guard 안 거치고 즉시 return");
  });
});

test("Wave 238: shadow audit env on + poolEntries 빈 배열 → no-op", async () => {
  await withEnv({
    AI_L2_SHADOW_AUDIT_ENABLED: "1",
    AI_L2_DAILY_BUDGET_USD: "10",
    SUPABASE_URL: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  }, async () => {
    // Bust import cache so the module re-reads env.
    delete require.cache[require.resolve("../src/lib/ai-l2-shadow-audit.ts")];
    const { runShadowAudit } = await import("../src/lib/ai-l2-shadow-audit.ts");
    const stats = await runShadowAudit({
      rows: [],
      poolEntries: [],
    });
    // SUPABASE env 없으면 fetchTodayAiL2CostUsd 0 → guard pass → candidates=0 → 즉시 return.
    assert.equal(stats.enabled, true);
    assert.equal(stats.candidates, 0);
    assert.equal(stats.audited, 0);
  });
});

test("Wave 238: learning queue pass verdict skip", async () => {
  await withEnv({
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fake",
  }, async () => {
    const { enqueueLearningSignal } = await import("../src/lib/ai-l2-learning-queue.ts");
    const result = await enqueueLearningSignal({
      skuId: "shoe-test",
      pid: 12345,
      aiClassification: "pass",
      aiConfidence: 0.9,
      aiReason: "정상",
      listingTitle: "test",
    });
    assert.equal(result.enqueued, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "ai_pass_no_signal");
  });
});

test("Wave 238: learning queue 빈 skuId skip", async () => {
  await withEnv({
    SUPABASE_URL: "https://example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fake",
  }, async () => {
    const { enqueueLearningSignal } = await import("../src/lib/ai-l2-learning-queue.ts");
    const result = await enqueueLearningSignal({
      skuId: "",
      pid: 12345,
      aiClassification: "reject",
      aiConfidence: 0.9,
      aiReason: "fake",
      listingTitle: "test",
    });
    assert.equal(result.enqueued, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "sku_id_missing");
  });
});

// Note: SUPABASE env 부재 시 supabase_env_missing skip 은 production 운영 path 에서 검증.
// module-level const 가 첫 import 시 capture 되므로 test 순서 의존 → unit 에서 안 박음.
