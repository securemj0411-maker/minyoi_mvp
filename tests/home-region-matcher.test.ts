import assert from "node:assert/strict";
import test from "node:test";

import { matchDaangnRegionByPath } from "@/lib/daangn-region-matcher";

test("home region matcher keeps unmapped Kakao dong instead of replacing it with a nearby mapped dong", () => {
  const match = matchDaangnRegionByPath("서울특별시 동작구 상도1동");

  assert.ok(match);
  assert.equal(match.daangn_region_id, "324");
  assert.equal(match.daangn_region_name, "상도1동");
  assert.equal(match.daangn_full_path, "서울특별시 동작구 상도1동");
  assert.notEqual(match.daangn_region_name, "사당동");
  assert.notEqual(match.daangn_full_path, "서울특별시 동작구 사당동");
});

test("home region matcher still returns exact Daangn dong mapping when it exists", () => {
  const match = matchDaangnRegionByPath("서울특별시 동작구 사당동");

  assert.ok(match);
  assert.equal(match.daangn_region_id, "6091");
  assert.equal(match.daangn_region_name, "사당동");
  assert.equal(match.daangn_full_path, "서울특별시 동작구 사당동");
});
