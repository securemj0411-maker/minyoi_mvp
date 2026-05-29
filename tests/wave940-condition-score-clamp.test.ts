import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseListingOptions } from "@/lib/option-parser";

describe("Wave 940 — condition score DB constraint guard", () => {
  it("multiple hard defect signals never push condition_score below zero", () => {
    const parsed = parseListingOptions({
      category: "smartphone",
      title: "갤럭시 S26 256GB",
      description: "분실폰이고 할부 남아있습니다. 통신사 잠금 있고 카메라 렌즈 깨짐 있습니다.",
    });

    assert.equal(parsed.conditionClass, "flawed");
    assert.ok(parsed.conditionScore >= 0, `conditionScore below DB check: ${parsed.conditionScore}`);
    assert.ok(parsed.conditionScore <= 1, `conditionScore above DB check: ${parsed.conditionScore}`);
  });
});
