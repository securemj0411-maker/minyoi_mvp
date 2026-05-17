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

test("storage: no explicit token → SKU base option fallback (Wave 182 Phase 3)", () => {
  // Wave 182 (2026-05-17) §12b 정책 변경: base 가정 허용 (가장 낮은 옵션 + UI 표시).
  // iPhone 15 Pro Max 는 Apple 이 128GB 안 만듦 → SKU_BASE_OPTIONS 의 base = 256GB.
  // 안전성: base 시세 = 가장 낮은 옵션 → priceGap underestimate → false positive 0.
  const result = parse("아이폰15프로맥스 화이트", "자급제 입니다");
  assert.equal(result.storageGb, 256);
  // option_base_assumed 에 "storage" 박혀 있어야 UI 표시 가능.
  assert.deepEqual((result.parsedJson as { option_base_assumed?: string[] | null }).option_base_assumed, ["storage"]);
});

test("storage: typo 126gb → SKU base fallback (Wave 182 Phase 3)", () => {
  // 126gb 라는 typo 는 parser 가 인식 X → SKU base (iPhone 16e = 128GB) 가정.
  // 매물의 진짜 storage 가 256GB 였더라도 base 128 시세로 비교 → priceGap 보수적.
  const result = parse("아이폰 16e 126gb 풀박스", "", "iphone-16e", "iPhone 16e");
  assert.equal(result.storageGb, 128);
});

test("storage: 2테라", () => {
  assert.equal(parse("아이폰15프로맥스 2테라").storageGb, 2048);
});

test("storage: 용량 prefix path", () => {
  assert.equal(parse("아이폰15프로맥스", "용량 256gb").storageGb, 256);
});
