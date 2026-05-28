import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateDaangnRegionDistance,
  resolveDaangnGeoByPath,
} from "@/lib/daangn-region-distance";

const SANGDO_1 = "서울특별시 동작구 상도1동";

test("Daangn distance keeps nearby Seoul life-zone listings actionable", () => {
  const sadang = evaluateDaangnRegionDistance(SANGDO_1, "6091", "사당동");
  assert.equal(sadang.actionable, true);
  assert.ok((sadang.distanceKm ?? 999) < 8);

  const seocho = evaluateDaangnRegionDistance(SANGDO_1, "366", "서초4동");
  assert.equal(seocho.actionable, true);
  assert.ok((seocho.distanceKm ?? 999) < 10);

  const geumcheon = evaluateDaangnRegionDistance(SANGDO_1, "295", "가산동");
  assert.equal(geumcheon.actionable, true);
  assert.ok((geumcheon.distanceKm ?? 999) < 10);
});

test("Daangn distance blocks listings outside the practical direct-trade radius", () => {
  const iljik = evaluateDaangnRegionDistance(SANGDO_1, "4440", "일직동");

  assert.equal(iljik.actionable, false);
  assert.equal(iljik.bucket, "far");
  assert.ok((iljik.distanceKm ?? 0) > 10);
});

test("Daangn distance blocks clearly non-local listings instead of allowing all same-country regions", () => {
  const jeju = evaluateDaangnRegionDistance(SANGDO_1, "3813", "한림읍");

  assert.equal(jeju.actionable, false);
  assert.equal(jeju.bucket, "too_far");
  assert.ok((jeju.distanceKm ?? 0) > 400);
});

test("Daangn distance resolves Sangdo 1-dong to its exact centroid", () => {
  const geo = resolveDaangnGeoByPath(SANGDO_1);

  assert.ok(geo);
  assert.equal(geo.id, "6092");
  assert.equal(geo.name, "상도1동");
});

test("Daangn distance does not show a far label before the user sets a home region", () => {
  const signal = evaluateDaangnRegionDistance(null, "366", "서초4동");

  assert.equal(signal.actionable, true);
  assert.equal(signal.bucket, "unknown");
  assert.equal(signal.label, null);
});
