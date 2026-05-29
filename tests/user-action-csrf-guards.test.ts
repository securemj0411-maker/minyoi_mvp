import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("credit and account state mutation APIs require the user action header", () => {
  const routePaths = [
    "src/app/api/packs/pool/detail-access/route.ts",
    "src/app/api/me/account/delete/route.ts",
    "src/app/api/packs/reveals/delete/route.ts",
    "src/app/api/me/telegram/start-verify/route.ts",
    "src/app/api/me/telegram/disconnect/route.ts",
    "src/app/api/billing/manual-deposit/route.ts",
    "src/app/api/user/home-region/route.ts",
  ];

  for (const routePath of routePaths) {
    const route = source(routePath);
    assert.match(route, /hasUserActionHeader\(req\.headers\)/, routePath);
    assert.match(route, /missing_user_action_header/, routePath);
  }
});

test("first-party clients send the user action header for protected mutations", () => {
  const clients = [
    "src/components/explore-client.tsx",
    "src/app/me/account/delete/page.tsx",
    "src/components/user-reveal-dashboard.tsx",
    "src/components/telegram-connect-panel.tsx",
    "src/app/billing/manual/manual-deposit-client.tsx",
    "src/app/billing/processing/processing-client.tsx",
    "src/components/home-region-onboarding.tsx",
  ];

  for (const clientPath of clients) {
    assert.match(source(clientPath), /"x-minyoi-user-action": "1"/, clientPath);
  }
});
