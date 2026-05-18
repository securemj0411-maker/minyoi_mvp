import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("kakao login requests message scope for memo notifications", () => {
  const kakao = source("src/lib/kakao.ts");
  const authForm = source("src/components/auth-form.tsx");

  assert.match(kakao, /KAKAO_LOGIN_SCOPES = "profile_nickname profile_image talk_message"/);
  assert.match(authForm, /import \{ KAKAO_LOGIN_SCOPES \}/);
  assert.match(authForm, /scopes: KAKAO_LOGIN_SCOPES/);
  assert.doesNotMatch(authForm, /scopes: "profile_nickname profile_image"/);
});

test("debug kakao memo route sends default and custom self messages behind admin auth", () => {
  const route = source("src/app/api/debug/kakao-memo/route.ts");
  const panel = source("src/app/debug/kakao-memo-test-panel.tsx");
  const debugPage = source("src/app/debug/page.tsx");

  assert.match(route, /requireDebugAdmin\(req\)/);
  assert.match(route, /kakaoAccessToken is required/);
  assert.match(route, /https:\/\/kapi\.kakao\.com/);
  assert.match(route, /\/v2\/api\/talk\/memo\/default\/send/);
  assert.match(route, /\/v2\/api\/talk\/memo\/send/);
  assert.match(route, /template_object/);
  assert.match(route, /template_id/);
  assert.match(route, /DEFAULT_KAKAO_MEMO_TEMPLATE_ID/);
  assert.match(panel, /session\?\.provider_token/);
  assert.match(panel, /signInWithOAuth/);
  assert.match(panel, /KAKAO_LOGIN_SCOPES/);
  assert.match(panel, /\/api\/debug\/kakao-memo/);
  assert.match(panel, /테스트 카톡 보내기/);
  assert.match(panel, /카카오 메시지 권한 다시 받기/);
  assert.match(debugPage, /import \{ KakaoMemoTestPanel \}/);
  assert.match(debugPage, /<KakaoMemoTestPanel \/>/);
});
