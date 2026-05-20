import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PORTONE_CHANNEL_KEY, PORTONE_STORE_ID } from "../src/lib/portone-config";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("PortOne V2 public test channel config is available", () => {
  assert.equal(PORTONE_STORE_ID, "store-670b9708-35fd-4e46-9cd0-48b5c0e56f6a");
  assert.equal(PORTONE_CHANNEL_KEY, "channel-key-69134205-c63b-46d9-b389-aff785c8dfe3");
});

test("checkout calls PortOne requestPayment before granting credits", () => {
  const checkout = source("src/app/billing/checkout/checkout-client.tsx");

  assert.match(checkout, /@portone\/browser-sdk\/v2/);
  assert.match(checkout, /PortOne\.requestPayment/);
  assert.match(checkout, /storeId: PORTONE_STORE_ID/);
  assert.match(checkout, /channelKey: PORTONE_CHANNEL_KEY/);
  assert.match(checkout, /currency: "CURRENCY_KRW"/);
  assert.match(checkout, /payMethod: "CARD"/);
  assert.match(checkout, /결제자 이메일/);
  assert.match(checkout, /isValidEmail/);
  assert.match(checkout, /EMAIL_STORAGE_KEY/);
  assert.match(checkout, /결제자 이름/);
  assert.match(checkout, /fullName/);
  assert.match(checkout, /NAME_STORAGE_KEY/);
  assert.match(checkout, /결제자 휴대폰 번호/);
  assert.match(checkout, /isValidKoreanMobilePhone/);
  assert.match(checkout, /phoneNumber/);
  assert.match(checkout, /PHONE_STORAGE_KEY/);
  assert.match(checkout, /subscribeClientPlan\(planKey, response\.paymentId, orderId\)/);
});

test("billing subscribe route verifies PortOne payment status and amount", () => {
  const route = source("src/app/api/billing/subscribe/route.ts");
  const verifier = source("src/lib/portone-server.ts");

  assert.match(route, /verifyPortOnePayment/);
  assert.match(route, /expectedAmount: plan\.priceKrw/);
  assert.match(route, /missing_payment_id/);
  assert.match(verifier, /api\.portone\.io\/payments/);
  assert.match(verifier, /Authorization: `PortOne \$\{apiSecret\}`/);
  assert.match(verifier, /payment\.status !== "PAID"/);
  assert.match(verifier, /payment\.amount\?\.total/);
});
