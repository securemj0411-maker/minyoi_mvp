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

test("risk score hides lock and battery axes when category does not support those checks", () => {
  const score = buildRiskScore({
    marketplaceSource: "daangn",
    categorySlug: "earphone",
    descriptionPreview: "에어팟 맥스 미개봉 새제품입니다.",
    daangnMannerTemperature: 38.2,
    photoCount: 4,
  });

  const lock = score.axes.find((axis) => axis.axis === "lock");
  const battery = score.axes.find((axis) => axis.axis === "battery");

  assert.equal(lock?.applicable, false);
  assert.equal(lock?.reason, null);
  assert.equal(battery?.applicable, false);
  assert.equal(battery?.reason, null);
});

test("risk score still surfaces explicit battery defects for non-efficiency categories", () => {
  const score = buildRiskScore({
    marketplaceSource: "daangn",
    categorySlug: "earphone",
    descriptionPreview: "오른쪽 배터리 빨리 닳음 있습니다.",
    daangnMannerTemperature: 38.2,
    photoCount: 4,
  });

  const battery = score.axes.find((axis) => axis.axis === "battery");

  assert.equal(battery?.applicable, undefined);
  assert.equal(battery?.level, 2);
  assert.equal(battery?.reason, "배터리 risk 키워드");
});

test("risk score keeps lock and missing battery disclosure checks for device categories", () => {
  const score = buildRiskScore({
    marketplaceSource: "daangn",
    categorySlug: "laptop",
    descriptionPreview: "맥북 프로 14인치 M1 Pro 16GB 512GB 실버 판매합니다.",
    daangnMannerTemperature: 38.2,
    photoCount: 4,
  });

  const lock = score.axes.find((axis) => axis.axis === "lock");
  const battery = score.axes.find((axis) => axis.axis === "battery");

  assert.equal(lock?.applicable, undefined);
  assert.equal(lock?.reason, null);
  assert.equal(battery?.applicable, undefined);
  assert.equal(battery?.level, 1);
  assert.equal(battery?.reason, "배터리 효율 미공개");
});
