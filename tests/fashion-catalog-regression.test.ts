import { strict as assert } from "node:assert";
import { test } from "node:test";

import { ruleMatch } from "../src/lib/catalog";

test("fashion catalog resolves duplicate legacy shoe and bag lanes", () => {
  assert.equal(
    ruleMatch("아디다스 토바코 그루엔 메사 브라운 데저트 290")?.id,
    "shoe-adidas-tobacco-broad",
  );
  assert.equal(
    ruleMatch("아디다스 x 웨일스 보너 삼바 컬리지에이트 레드")?.id,
    "shoe-adidas-samba-wales-bonner",
  );
  assert.equal(
    ruleMatch("코치 태비 숄더백 20")?.id,
    "bag-coach-tabby",
  );
});

test("tnf nuptse 1996 requires explicit 1996 signal", () => {
  assert.equal(
    ruleMatch("노스페이스 1996 레트로 눕시 패딩")?.id,
    "clothing-tnf-nuptse-1996",
  );
  assert.equal(
    ruleMatch("노스페이스 700 눕시 패딩 그레이")?.id,
    "clothing-tnf-nuptse-broad",
  );
});
