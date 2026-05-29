import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { conditionChipDisplayLabel } from "@/components/condition-chip";

describe("condition chip display labels", () => {
  it("uses the normalized grading chip keys for shoe extras", () => {
    assert.equal(conditionChipDisplayLabel("extra:extra_laces"), "여분끈");
    assert.equal(conditionChipDisplayLabel("extra:insole_changed"), "깔창 교체");
  });

  it("does not expose stale pre-normalization shoe extra keys", () => {
    assert.equal(conditionChipDisplayLabel("shoe:extra_laces"), null);
    assert.equal(conditionChipDisplayLabel("shoe:insole_changed"), null);
  });
});
