import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { conditionResaleAdjustmentKrw, expectedProfitFromMarketPrice } from "@/lib/profit";

describe("condition-aware profit adjustment", () => {
  it("soft condition chips apply a capped resale haircut", () => {
    assert.equal(
      conditionResaleAdjustmentKrw({
        marketPrice: 200_000,
        conditionChips: ["condition:earphone_missing_parts", "condition:earphone_hygiene_warning"],
      }),
      14_000,
    );
  });

  it("already separated broad condition classes do not double-penalize their own chip", () => {
    assert.equal(
      conditionResaleAdjustmentKrw({
        marketPrice: 300_000,
        conditionClass: "low_batt",
        conditionChips: ["condition:low_battery_health"],
      }),
      0,
    );
    assert.equal(
      conditionResaleAdjustmentKrw({
        marketPrice: 300_000,
        conditionClass: "worn",
        conditionChips: ["condition:cosmetic_wear"],
      }),
      0,
    );
  });

  it("expected profit uses adjusted resale price before fees", () => {
    const plain = expectedProfitFromMarketPrice({
      buyPrice: 100_000,
      marketPrice: 150_000,
      buyShipping: 0,
      marketplaceSource: "bunjang",
    });
    const adjusted = expectedProfitFromMarketPrice({
      buyPrice: 100_000,
      marketPrice: 150_000,
      buyShipping: 0,
      marketplaceSource: "bunjang",
      conditionChips: ["condition:fashion_stain_or_discoloration"],
    });

    assert.ok(plain);
    assert.ok(adjusted);
    assert.equal(adjusted.conditionAdjustment, 12_000);
    assert.ok(adjusted.max < plain.max);
    assert.equal(adjusted.sellFee, Math.round((150_000 - 12_000) * 0.035));
  });

  it("Daangn keeps zero fee but still prices condition risk", () => {
    const adjusted = expectedProfitFromMarketPrice({
      buyPrice: 60_000,
      marketPrice: 100_000,
      buyShipping: 0,
      marketplaceSource: "daangn",
      conditionChips: ["condition:clothing_pilling"],
    });

    assert.ok(adjusted);
    assert.equal(adjusted.sellFee, 0);
    assert.equal(adjusted.resellShipping, 0);
    assert.equal(adjusted.safetyBuffer, 0);
    assert.equal(adjusted.conditionAdjustment, 4_000);
    assert.equal(adjusted.max, 36_000);
  });
});
