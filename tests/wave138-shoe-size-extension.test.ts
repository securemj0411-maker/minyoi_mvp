// Wave 138 (2026-05-16): 신발 사이즈 범위 220~309 확장 + cm 표기 변환 검증.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseShoeSizeMm } from "@/lib/parsers/wave92-fashion-mobility";

describe("Wave 138 — parseShoeSizeMm 220mm + cm 변환", () => {
  it("220mm 여성 사이즈 인식 (이전엔 차단)", () => {
    assert.equal(parseShoeSizeMm("호카 본디 9 그레이 220"), 220);
    assert.equal(parseShoeSizeMm("뉴발 990v5 (그레이/220)"), 220);
  });

  it("225mm 여성 사이즈 인식", () => {
    assert.equal(parseShoeSizeMm("뉴발란스 990 V6 블랙 225"), 225);
    assert.equal(parseShoeSizeMm("뉴발란스 990 V5 트리플블랙 225사이즈"), 225);
  });

  it("228mm 등 226~229 사이즈도 인식", () => {
    assert.equal(parseShoeSizeMm("아디다스 삼바 228mm"), 228);
  });

  it("215mm 이하 키즈 차단 유지", () => {
    assert.equal(parseShoeSizeMm("아이용 운동화 200"), null);
    assert.equal(parseShoeSizeMm("키즈 NB 327 215"), null);
    assert.equal(parseShoeSizeMm("160 유아"), null);
  });

  it("cm 표기 → mm 변환 (Wave 138)", () => {
    assert.equal(parseShoeSizeMm("호카 본디 26cm"), 260);
    assert.equal(parseShoeSizeMm("닥마 1460 24cm"), 240);
    assert.equal(parseShoeSizeMm("아식스 1130 28cm"), 280);
  });

  it("부동소수점 cm (25.5cm → 255mm)", () => {
    assert.equal(parseShoeSizeMm("나이키 페가수스 25.5cm"), 255);
    assert.equal(parseShoeSizeMm("Asics 26.5cm"), 265);
  });

  it("cm 표기 범위 벗어나면 차단 (31cm 이상)", () => {
    assert.equal(parseShoeSizeMm("31cm 신발"), null);
    assert.equal(parseShoeSizeMm("16cm 키즈"), null);
  });

  it("기존 mm + UK 패턴 보존 (regression 차단)", () => {
    assert.equal(parseShoeSizeMm("호카 본디 8 250mm"), 250);
    assert.equal(parseShoeSizeMm("[270] 닥터마틴"), 270);
    assert.equal(parseShoeSizeMm("UK 7 닥마 1460"), 260);
  });
});
