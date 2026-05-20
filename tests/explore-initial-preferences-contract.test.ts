import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("ExploreClient gates initial pool and stats fetches until preferences are initialized", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /const \[prefsInitialized, setPrefsInitialized\] = useState\(false\)/);
  assert.match(explore, /setPrefsInitialized\(true\)/);
  assert.match(explore, /if \(!prefsInitialized \|\| awaitingInitialPrefs\) return;\n\s+void loadStats\(\);/);
  assert.match(explore, /if \(!prefsInitialized \|\| awaitingInitialPrefs\) return;\n\s+void loadPool\(false\);/);
});

test("ExploreClient preference save relies on the guarded auto fetch instead of double-loading", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /Wave 403: 직접 loadPool 하지 않음/);
  assert.doesNotMatch(explore, /loadPool\(false,\s*newPrefs\)/);
});
