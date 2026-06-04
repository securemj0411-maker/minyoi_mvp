import { strict as assert } from "node:assert";
import { test } from "node:test";

import { normalizeConditionTier } from "../src/components/condition-chip";

test("condition tier display normalizes parser storage keys", () => {
  assert.equal(normalizeConditionTier("s_grade"), "S");
  assert.equal(normalizeConditionTier("a_grade"), "A");
  assert.equal(normalizeConditionTier("b_grade"), "B");
  assert.equal(normalizeConditionTier("c_grade"), "C");
  assert.equal(normalizeConditionTier("d_grade"), "D");
  assert.equal(normalizeConditionTier("reject"), "D");
  assert.equal(normalizeConditionTier("unknown_condition"), "UNKNOWN");
});

test("condition tier display keeps already-normalized UI keys", () => {
  assert.equal(normalizeConditionTier("S"), "S");
  assert.equal(normalizeConditionTier("A"), "A");
  assert.equal(normalizeConditionTier("B"), "B");
  assert.equal(normalizeConditionTier("C"), "C");
  assert.equal(normalizeConditionTier("D"), "D");
  assert.equal(normalizeConditionTier("UNKNOWN"), "UNKNOWN");
});
