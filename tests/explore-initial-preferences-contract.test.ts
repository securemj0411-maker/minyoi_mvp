import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("ExploreClient loads the broad feed immediately without a preference gate", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /예산\/성향 질문 제거/);
  assert.match(explore, /void loadStats\(\);/);
  assert.match(explore, /void loadPool\(false\);/);
  assert.doesNotMatch(explore, /prefsInitialized|awaitingInitialPrefs|loadPreferences|savePreferences/);
  assert.doesNotMatch(explore, /params\.set\("budget"|params\.set\("preference"/);
});

test("Refresh modal does not show budget and preference summary controls", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /필터 없이 더 넓게 골라드려요/);
  assert.doesNotMatch(explore, /제한 없음/);
  assert.doesNotMatch(explore, /매물 성향/);
  assert.doesNotMatch(explore, /내 매물 취향 알려주세요/);
  assert.doesNotMatch(explore, /수정하고 새 30개 받기/);
});
