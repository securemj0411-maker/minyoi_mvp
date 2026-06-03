import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pipelineConfigSource = readFileSync(new URL("../src/lib/pipeline-config.ts", import.meta.url), "utf8");
const tickPipelineSource = readFileSync(new URL("../src/lib/tick-pipeline.ts", import.meta.url), "utf8");

test("recovery worker has its own bounded limit under the 60s route budget", () => {
  assert.match(pipelineConfigSource, /recoveryLimit:\s*number/);
  assert.match(pipelineConfigSource, /PIPELINE_RECOVERY_LIMIT",\s*100,\s*10,\s*250/);
  assert.match(tickPipelineSource, /const recoveryLimit = config\.recoveryLimit/);
  assert.doesNotMatch(tickPipelineSource, /Math\.min\(Math\.max\(config\.tickScoreLimit \* 2,\s*250\),\s*500\)/);
});
