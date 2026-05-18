import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("/me terminal history control stays below the product feed", () => {
  const dashboard = source("src/components/user-reveal-dashboard.tsx");
  const feedIndex = dashboard.indexOf("visibleItems.map((item)");
  const terminalControlIndex = dashboard.indexOf("Wave 303");
  const paginationIndex = dashboard.indexOf("!loading && totalPages > 1");

  assert.ok(feedIndex >= 0);
  assert.ok(terminalControlIndex > feedIndex);
  assert.ok(paginationIndex > terminalControlIndex);
  assert.match(dashboard, /판매완료 기록/);
  assert.match(dashboard, /기록 접기/);
  assert.doesNotMatch(dashboard, /기록으로 남겨뒀어요/);
  assert.doesNotMatch(dashboard, /bg-amber-500 text-white hover:bg-amber-600/);
});
