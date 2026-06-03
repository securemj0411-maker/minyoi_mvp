import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("explore detail analysis keeps velocity data for reopened items", () => {
  const explore = source("src/components/explore-client.tsx");

  assert.match(explore, /velocityBasis\?: RevealCard\["velocityBasis"\]/);
  assert.match(explore, /marketBasis\?: RevealCard\["marketBasis"\] \| null/);
  assert.match(explore, /velocityBasis: item\.velocityBasis \?\? null/);
  assert.match(explore, /velocityBasis: card\.velocityBasis \?\? null/);
  assert.match(explore, /velocityBasis: data\.analysis!\.velocityBasis \?\? item\.velocityBasis \?\? null/);
  assert.match(explore, /skuListingFlow: data\.analysis!\.skuListingFlow \?\? item\.skuListingFlow \?\? null/);
  assert.match(explore, /optionBaseAssumed: data\.analysis!\.optionBaseAssumed \?\? item\.optionBaseAssumed \?\? null/);
});

test("market velocity selection prefers usable rows over latest sparse rows", () => {
  const packOpen = source("src/lib/pack-open.ts");

  assert.match(packOpen, /function shouldReplaceVelocityRow/);
  assert.match(packOpen, /existingUsable !== candidateUsable/);
  assert.match(packOpen, /return candidateUsable/);
  assert.match(packOpen, /function setBetterVelocityRow/);
  assert.match(packOpen, /setBetterVelocityRow\(target, row\.comparable_key, row\)/);
  assert.doesNotMatch(packOpen, /else if \(!target\.has\(row\.comparable_key\)\)/);
});
