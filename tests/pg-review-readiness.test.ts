import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("PG review public pages expose legal links and business information", () => {
  const footer = source("src/components/app-footer.tsx");
  const plans = source("src/app/plans/page.tsx");

  assert.match(footer, /\/terms/);
  assert.match(footer, /\/privacy/);
  assert.match(footer, /\/refund-policy/);
  assert.match(footer, /상호명/);
  assert.match(footer, /사업자등록번호/);
  assert.match(footer, /통신판매업신고/);
  assert.match(footer, /주소/);
  assert.match(footer, /대표번호/);
  assert.match(plans, /3가지 충전권/);
  assert.match(plans, /자동 갱신 없이 한 번만 결제/);
  assert.match(plans, /환불정책 확인/);
});

test("PG review checkout collects Inicis required buyer fields", () => {
  const checkout = source("src/app/billing/checkout/checkout-client.tsx");
  const privacy = source("src/app/privacy/page.tsx");

  assert.match(checkout, /결제자 이메일/);
  assert.match(checkout, /결제자 이름/);
  assert.match(checkout, /결제자 휴대폰 번호/);
  assert.match(checkout, /\/login\?next=/);
  assert.match(checkout, /email,\n\s+fullName,\n\s+phoneNumber/);
  assert.match(privacy, /결제자 이름, 이메일 주소, 휴대폰 번호/);
  assert.match(privacy, /KG이니시스/);
});

test("PG review sensitive operator pages are server-side gated", () => {
  const adminLayout = source("src/app/admin/layout.tsx");
  const adminTrap = source("src/components/admin-caught-page.tsx");
  const trapRoutes = [
    "src/app/(admin-traps)/root/page.tsx",
    "src/app/(admin-traps)/master/page.tsx",
    "src/app/(admin-traps)/administrator/page.tsx",
    "src/app/(admin-traps)/wp-admin/page.tsx",
    "src/app/(admin-traps)/phpmyadmin/page.tsx",
  ].map(source);
  const debugAdmin = source("src/lib/debug-admin.ts");

  assert.match(adminLayout, /requireSupabaseUserFromCookies/);
  assert.match(adminLayout, /isAdminUser/);
  assert.match(adminLayout, /redirect\("\/login\?next=\/admin"\)/);
  assert.match(adminLayout, /AdminCaughtPage/);
  assert.match(adminTrap, /딱 걸렸죠/);
  assert.match(adminTrap, /access attempt noticed/);
  assert.match(adminTrap, /403 · nice try/);
  assert.match(adminTrap, /거긴 막힌 문이에요/);
  assert.doesNotMatch(adminTrap, /운영자 방/);
  for (const route of trapRoutes) {
    assert.match(route, /AdminCaughtPage/);
  }
  assert.match(debugAdmin, /debug routes disabled in production/);
});
