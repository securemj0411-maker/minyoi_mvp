import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

for (const routePath of [
  "src/app/api/packs/pool/analysis/route.ts",
  "src/app/api/packs/reveals/detail/route.ts",
]) {
  test(`${routePath} does not let optional sku listing flow block detail analysis`, () => {
    const route = source(routePath);

    assert.match(route, /OPTIONAL_ANALYSIS_TIMEOUT_MS = 1_500/);
    assert.match(route, /function withOptionalAnalysisTimeout/);
    assert.match(route, /function loadSkuListingFlowFast/);
    assert.match(route, /loadSkuListingFlowFast\(raw\?\.sku_id \?\? null\)/);
    assert.doesNotMatch(route, /loadSkuListingFlow\(raw\?\.sku_id \?\? null\)/);
  });
}
