import assert from "node:assert/strict";
import test from "node:test";

import {
  decideAiL2Review,
  isAiL2PolicyEnabled,
  shouldReviewByPolicy,
} from "@/lib/ai-l2-policy";

function withEnv(value: string | undefined, fn: () => void) {
  const prev = process.env.AI_L2_POLICY_ENABLED;
  if (value == null) delete process.env.AI_L2_POLICY_ENABLED;
  else process.env.AI_L2_POLICY_ENABLED = value;
  try {
    fn();
  } finally {
    if (prev == null) delete process.env.AI_L2_POLICY_ENABLED;
    else process.env.AI_L2_POLICY_ENABLED = prev;
  }
}

test("shouldReviewByPolicy off → legacy boolean (no flag, low gap, no suspicious) skips", () => {
  withEnv(undefined, () => {
    assert.equal(isAiL2PolicyEnabled(), false);
    const out = shouldReviewByPolicy({ priceGap: 0.3, scoreFlags: [] });
    assert.equal(out, false);
  });
});

test("shouldReviewByPolicy off → legacy reviews when scoreFlags non-empty", () => {
  withEnv("0", () => {
    const out = shouldReviewByPolicy({ priceGap: 0.1, scoreFlags: ["weak_normal_signal"] });
    assert.equal(out, true);
  });
});

test("shouldReviewByPolicy off → legacy reviews on priceGap ≥ 0.55", () => {
  withEnv(undefined, () => {
    const out = shouldReviewByPolicy({ priceGap: 0.6, scoreFlags: [] });
    assert.equal(out, true);
  });
});

test("shouldReviewByPolicy off → legacy reviews on legacySuspicious flag", () => {
  withEnv(undefined, () => {
    const out = shouldReviewByPolicy({
      priceGap: 0.1,
      scoreFlags: [],
      legacySuspicious: true,
    });
    assert.equal(out, true);
  });
});

test("shouldReviewByPolicy on → routes through decideAiL2Review (extreme gap)", () => {
  withEnv("1", () => {
    assert.equal(isAiL2PolicyEnabled(), true);
    const out = shouldReviewByPolicy({ priceGap: 0.8, scoreFlags: [] });
    assert.equal(out, true);
    assert.equal(decideAiL2Review({ priceGap: 0.8, scoreFlags: [] }).review, true);
  });
});

test("shouldReviewByPolicy on → skips when no signal (policy says skip)", () => {
  withEnv("1", () => {
    const out = shouldReviewByPolicy({ priceGap: 0.2, scoreFlags: [] });
    assert.equal(out, false);
  });
});

test("shouldReviewByPolicy on → open_set category triggers review even with no flag/gap", () => {
  withEnv("1", () => {
    const out = shouldReviewByPolicy({
      priceGap: 0.1,
      scoreFlags: [],
      category: "desktop_custom_build",
    });
    assert.equal(out, true);
  });
});
