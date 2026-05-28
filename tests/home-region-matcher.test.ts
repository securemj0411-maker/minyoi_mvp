import assert from "node:assert/strict";
import test from "node:test";

import { matchDaangnRegionByPath } from "@/lib/daangn-region-matcher";

test("home region matcher resolves Sangdo 1-dong to the exact Daangn dong", () => {
  const match = matchDaangnRegionByPath("서울특별시 동작구 상도1동");

  assert.ok(match);
  assert.equal(match.daangn_region_id, "6092");
  assert.equal(match.daangn_region_name, "상도1동");
  assert.equal(match.daangn_full_path, "서울특별시 동작구 상도1동");
  assert.notEqual(match.daangn_region_name, "사당동");
  assert.notEqual(match.daangn_full_path, "서울특별시 동작구 사당동");
});

test("home region matcher resolves Sangdo-dong to the exact Daangn dong", () => {
  const match = matchDaangnRegionByPath("서울특별시 동작구 상도동");

  assert.ok(match);
  assert.equal(match.daangn_region_id, "6093");
  assert.equal(match.daangn_region_name, "상도동");
  assert.equal(match.daangn_full_path, "서울특별시 동작구 상도동");
});

test("home region matcher still returns exact Daangn dong mapping when it exists", () => {
  const match = matchDaangnRegionByPath("서울특별시 동작구 사당동");

  assert.ok(match);
  assert.equal(match.daangn_region_id, "6091");
  assert.equal(match.daangn_region_name, "사당동");
  assert.equal(match.daangn_full_path, "서울특별시 동작구 사당동");
});
