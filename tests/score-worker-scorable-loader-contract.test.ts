import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/lib/tick-pipeline.ts", import.meta.url), "utf8");

test("score worker claims scorable pids before hydrating wide raw rows", () => {
  assert.match(source, /select=pid,source\$\{scorableBaseFilter\}/);
  assert.match(source, /buildDirtyScorableRowsByPidUrl/);
  assert.doesNotMatch(
    source,
    /select=\$\{columns\}\$\{scorableBaseFilter\}\$\{extraFilter\}&order=last_seen_at\.desc/,
  );
});
