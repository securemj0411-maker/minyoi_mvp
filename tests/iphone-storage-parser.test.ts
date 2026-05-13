import assert from "node:assert/strict";
import test from "node:test";

import { parseListingOptions } from "@/lib/option-parser";

// Wave 49 — explicit storage parsing regression guards. Confirms parser already
// handles 256기가 / 1T / 1TB / 1테라 / 1T glued / 256g 등 explicit token. silent
// 추정 (storage 명시 없는 row → 추정) 은 의도적으로 차단된 채 유지.

function parse(title: string, description = "", skuId = "iphone-15-pro-max", skuName = "iPhone 15 Pro Max") {
  return parseListingOptions({ title, description, category: "smartphone", skuId, skuName });
}

test("storage: explicit 256기가 bare", () => {
  assert.equal(parse("아이폰 14 256기가").storageGb, 256);
});

test("storage: explicit 256g compact", () => {
  assert.equal(parse("아이폰16프로 256g").storageGb, 256);
});

test("storage: explicit 256 bare with model adjacency (smartphone permitted by current parser)", () => {
  assert.equal(parse("아이폰16 프로 256").storageGb, 256);
});

test("storage: 1T with surrounding spaces", () => {
  assert.equal(parse("아이폰15프로맥스 1T 화이트티타늄").storageGb, 1024);
});

test("storage: 1tb compact suffix glued to model", () => {
  assert.equal(parse("아이폰15프로맥스1tb").storageGb, 1024);
});

test("storage: 1테라 glued directly to model name", () => {
  // Title pattern observed in production: "아이폰15프로맥스1테라 ..."
  assert.equal(parse("아이폰15프로맥스1테라 정품 자급제 판매합니다").storageGb, 1024);
});

test("storage: 1테라 glued + noisy suffix", () => {
  assert.equal(
    parse("아이폰15프로맥스1테라유튜버하실분풀구성드립니다내츄럴티").storageGb,
    1024,
  );
});

test("storage: 1테라 with whitespace before", () => {
  assert.equal(
    parse("[미사용급/애플케어/자급제] 아이폰16프로맥스 1테라").storageGb,
    1024,
  );
});

test("storage: 1테라 in description only", () => {
  assert.equal(
    parse("아이폰15프로맥스 블루 티타늄", "1테라 S급입니다").storageGb,
    1024,
  );
});

test("storage: no explicit token → null (silent inference forbidden)", () => {
  // Title/desc 어디에도 storage 명시 없음. silent inference 금지 정책 회귀 가드.
  assert.equal(parse("아이폰15프로맥스 화이트", "자급제 입니다").storageGb, null);
});

test("storage: typo 126gb does not match 128 (precision over recall)", () => {
  assert.equal(parse("아이폰 16e 126gb 풀박스").storageGb, null);
});

test("storage: 2테라", () => {
  assert.equal(parse("아이폰15프로맥스 2테라").storageGb, 2048);
});

test("storage: 용량 prefix path", () => {
  assert.equal(parse("아이폰15프로맥스", "용량 256gb").storageGb, 256);
});
