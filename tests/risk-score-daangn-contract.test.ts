import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildRiskScore } from "../src/lib/risk-score";

test("daangn risk score uses manner temperature instead of review-count new seller copy", () => {
  const score = buildRiskScore({
    marketplaceSource: "daangn",
    sellerReviewCount: 0,
    daangnMannerTemperature: null,
    photoCount: 0,
  });

  const seller = score.axes.find((axis) => axis.axis === "seller");
  const photo = score.axes.find((axis) => axis.axis === "photo");

  assert.equal(seller?.reason, "매너온도 미확인");
  assert.notEqual(seller?.reason, "신규 판매자 (후기 0)");
  assert.equal(photo?.level, 0);
  assert.equal(photo?.reason, null);
});

test("daangn risk score warns on low manner temperature and real low photo counts", () => {
  const score = buildRiskScore({
    marketplaceSource: "daangn",
    sellerReviewCount: 0,
    daangnMannerTemperature: 32.1,
    photoCount: 1,
  });

  const seller = score.axes.find((axis) => axis.axis === "seller");
  const photo = score.axes.find((axis) => axis.axis === "photo");

  assert.equal(seller?.reason, "매너온도 32.1°C");
  assert.equal(photo?.reason, "사진 1장");
});
