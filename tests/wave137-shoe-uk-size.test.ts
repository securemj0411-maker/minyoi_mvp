// Wave 137 (2026-05-16): 신발 UK 사이즈 → mm 변환 검증.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseShoeSizeMm } from "@/lib/parsers/wave92-fashion-mobility";

describe("Wave 137 — parseShoeSizeMm UK conversion", () => {
  it("UK 6 → 250mm (닥마식)", () => {
    assert.equal(parseShoeSizeMm("닥터마틴 1460 8홀 블랙 - UK6"), 250);
  });

  it("UK 7 → 260mm", () => {
    assert.equal(parseShoeSizeMm("(260)UK7 닥터마틴 어콜드월 1460 벡스"), 260);
    // 명시 260도 매칭 — 둘 다 결과 동일
  });

  it("UK 9 → 280mm", () => {
    assert.equal(parseShoeSizeMm("닥터마틴 1460 블랙 uk9"), 280);
  });

  it("UK 10 → 290mm", () => {
    assert.equal(parseShoeSizeMm("호카 본디 UK10 새상품"), 290);
  });

  it("UK3 → 220mm (Wave 138 범위 확장, 여성 일반)", () => {
    assert.equal(parseShoeSizeMm("닥터마틴 플로라 첼시UK3((무배))"), 220);
    // Wave 138: 220은 여성 일반 사이즈, 차단 안 함
  });

  it("UK 7.5 → 무시 (부동소수점)", () => {
    // 부동소수점은 정확도 우선으로 무시
    assert.equal(parseShoeSizeMm("나이키 UK 7.5 자켓"), null);
  });

  it("기존 mm 패턴은 그대로", () => {
    assert.equal(parseShoeSizeMm("호카 본디 8 250mm 새상품"), 250);
    assert.equal(parseShoeSizeMm("(270) 닥터마틴 1460"), 270);
  });

  it("키즈 사이즈 차단 (UK 2 같은 거 안 잡힘)", () => {
    assert.equal(parseShoeSizeMm("아동 UK 2"), null);
    assert.equal(parseShoeSizeMm("어그 UK1 키즈"), null);
  });

  it("UK 이전 글자가 영문/숫자면 매칭 안 됨 (false positive 차단)", () => {
    // "DUK6" 같은 잘못된 매칭 방지
    assert.equal(parseShoeSizeMm("ADUK6 운동화"), null);
    assert.equal(parseShoeSizeMm("1UK7 모델"), null);
  });

  it("매물 title 다양한 패턴", () => {
    assert.equal(parseShoeSizeMm("[260]UK7 닥터마틴 x 어콜드월"), 260);  // 명시 + UK 둘 다
    assert.equal(parseShoeSizeMm("닥마 1460 블랙 (UK6)"), 250);
    assert.equal(parseShoeSizeMm("Dr.Martens 1460 black UK 8"), 270);
  });
});
