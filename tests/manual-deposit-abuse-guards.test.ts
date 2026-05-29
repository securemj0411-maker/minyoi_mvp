import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("manual deposit blocks repeated auto-grant abuse after a successful request", () => {
  const route = source("src/app/api/billing/manual-deposit/route.ts");

  assert.match(route, /MANUAL_DEPOSIT_SUCCESS_WINDOW_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(route, /status=in\.\(approved,auto_approved\)/);
  assert.match(route, /created_at=gte\.\$\{encodeURIComponent\(recentSuccessCutoff\)\}/);
  assert.match(route, /manual_deposit_daily_cap/);
  assert.match(route, /오늘 계좌이체 충전 신청은 이미 처리됐어요/);
  assert.match(route, /SUPPORT_OPEN_KAKAO_URL/);
});

test("manual deposit applies a longer cooldown after rejected requests", () => {
  const route = source("src/app/api/billing/manual-deposit/route.ts");

  assert.match(route, /MANUAL_DEPOSIT_REJECTED_COOLDOWN_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(route, /status=eq\.rejected/);
  assert.match(route, /created_at=gte\.\$\{encodeURIComponent\(rejectedCutoff\)\}/);
  assert.match(route, /manual_deposit_recent_reject/);
  assert.match(route, /최근 입금 확인이 어려웠던 신청이 있어요/);
});

test("manual deposit errors do not expose raw Supabase response bodies", () => {
  const route = source("src/app/api/billing/manual-deposit/route.ts");

  assert.match(route, /console\.error\("\[manual-deposit\] request insert failed"/);
  assert.match(route, /message: "충전 신청을 처리하지 못했어요\. 잠시 후 다시 시도해주세요\."/);
  assert.match(route, /message: "처리 중 오류가 발생했어요\. 잠시 후 다시 시도해주세요\."/);
  assert.doesNotMatch(route, /message: `신청을 처리하지 못했어요:/);
  assert.doesNotMatch(route, /message: `처리 중 오류가 발생했어요:/);
});

test("manual deposit clients surface support links from guarded responses", () => {
  const manualClient = source("src/app/billing/manual/manual-deposit-client.tsx");
  const processingClient = source("src/app/billing/processing/processing-client.tsx");

  for (const client of [manualClient, processingClient]) {
    assert.match(client, /errorSupportUrl/);
    assert.match(client, /supportUrl\?: string/);
    assert.match(client, /고객센터 오픈카톡 열기/);
  }
});
