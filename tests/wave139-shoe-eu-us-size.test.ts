// Wave 139 (2026-05-16): 신발 EU/US 사이즈 → mm 변환 검증.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseShoeSizeMm } from "@/lib/parsers/wave92-fashion-mobility";

describe("Wave 139 — EU/US 사이즈 → mm 변환", () => {
  it("EU 38 → 240mm", () => {
    assert.equal(parseShoeSizeMm("닥마 2976 EU 38"), 240);
    assert.equal(parseShoeSizeMm("어그 클래식 미니 eu38"), 240);
  });

  it("EU 42 → 265mm", () => {
    assert.equal(parseShoeSizeMm("호카 본디 EU 42"), 265);
  });

  it("EU 46 → 290mm", () => {
    assert.equal(parseShoeSizeMm("나이키 EU 46"), 290);
  });

  it("EU prefix 없으면 false positive 차단", () => {
    // "39 닥터마틴" 같은 단독 숫자는 안 잡힘 (US와 헷갈림)
    assert.equal(parseShoeSizeMm("39 닥터마틴 2976 첼시부츠"), null);
  });

  it("Wave 414 — 명품 신발 EU decimal/bracket/suffix 표기를 보수적으로 파싱", () => {
    assert.equal(parseShoeSizeMm("[40] 에르메스 바운싱 스니커즈 카프스킨 누아블랑"), 250);
    assert.equal(parseShoeSizeMm("[40.5사이즈]에르메스 H 부메랑 스니커즈"), 255);
    assert.equal(parseShoeSizeMm("[37.5사이즈]프라다 브러쉬드 레더 스니커즈 화이트"), 240);
    assert.equal(parseShoeSizeMm("[풀구성] 42.5 / 에르메스 바운싱 스니커즈 블랑"), 270);
    assert.equal(parseShoeSizeMm("프라다 청키 스니커즈 베이지 43"), 275);
  });

  it("US 8 → 260mm (남성 기준)", () => {
    assert.equal(parseShoeSizeMm("US 8 나이키 페가수스"), 260);
  });

  it("US 9 → 270mm", () => {
    assert.equal(parseShoeSizeMm("us9 새상품"), 270);
    assert.equal(parseShoeSizeMm("MR993GL 메이드 인 USA US 9"), 270);
  });

  it("US 11 → 290mm", () => {
    assert.equal(parseShoeSizeMm("ugg us 11"), 290);
  });

  it("US prefix 없으면 false positive 차단", () => {
    assert.equal(parseShoeSizeMm("나이키 8 운동화"), null);
  });

  it("기존 mm/UK/cm 패턴 보존 (regression)", () => {
    assert.equal(parseShoeSizeMm("호카 본디 270mm"), 270);
    assert.equal(parseShoeSizeMm("닥마 1460 UK 7"), 260);
    assert.equal(parseShoeSizeMm("아식스 26cm"), 260);
    assert.equal(parseShoeSizeMm("뉴발란스 220"), 220);
  });

  it("description 사이즈 (parseShoeOptions가 title+desc 같이 봄)", () => {
    // 실제 매물: "사이즈 220 (UK3)" — 220 또는 UK3 둘 다 매칭
    assert.equal(parseShoeSizeMm("닥터마틴 1460 스무스 블랙 부츠\n사이즈 220 (UK3)"), 220);
    // US 8 / 260cm 둘 다 박힌 매물
    assert.equal(parseShoeSizeMm("MR993GL\nUS8 / 260cm"), 260);
  });
});
