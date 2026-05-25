import { strict as assert } from "node:assert";
import { test } from "node:test";
import { localizeProductLineLabel } from "../src/lib/product-line-display";

test("product line teaser labels prefer Korean market wording", () => {
  assert.equal(localizeProductLineLabel("Nike Dunk Low"), "나이키 덩크 로우");
  assert.equal(localizeProductLineLabel("Nike Air Force 1 LV8"), "나이키 에어포스 1 LV8");
  assert.equal(localizeProductLineLabel("Adidas Gazelle OG"), "아디다스 가젤 OG");
  assert.equal(localizeProductLineLabel("Louis Vuitton LV Trainer"), "루이비통 LV 트레이너");
  assert.equal(localizeProductLineLabel("Bottega Veneta Cassette Camera / Cobble Bag"), "보테가 베네타 카세트 카메라 / 코블 백");
  assert.equal(localizeProductLineLabel("Supreme Shoulder / Mesh / Bandana Side Bag"), "슈프림 숄더 / 메쉬 / 반다나 사이드 백");
  assert.equal(localizeProductLineLabel("Prada Pocono Nylon Vintage"), "프라다 포코노 나일론 빈티지");
});

test("product line teaser labels keep unavoidable model tokens while localizing common Apple terms", () => {
  assert.equal(localizeProductLineLabel("iPhone 16 Pro Max 256GB"), "아이폰 16 프로맥스 256GB");
  assert.equal(localizeProductLineLabel("MacBook Air M4 13\" 256GB"), "맥북 에어 M4 13\" 256GB");
  assert.equal(localizeProductLineLabel("AirPods Max 2nd gen"), "에어팟 맥스 2세대");
});
