import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tickPipelineSource = readFileSync(new URL("../src/lib/tick-pipeline.ts", import.meta.url), "utf8");
const joongnaIngestSource = readFileSync(new URL("../src/lib/joongna-ingest.ts", import.meta.url), "utf8");

test("market invalidation worker claims a larger prioritized window safely", () => {
  assert.match(tickPipelineSource, /DEFAULT_MARKET_INVALIDATION_CLAIM_LIMIT\s*=\s*500/);
  assert.match(tickPipelineSource, /DEFAULT_MARKET_INVALIDATION_PRIORITY_WINDOW\s*=\s*3000/);
  assert.match(tickPipelineSource, /MARKET_INVALIDATION_READ_PAGE_SIZE\s*=\s*1000/);
  assert.match(tickPipelineSource, /PIPELINE_MARKET_INVALIDATION_CLAIM_LIMIT/);
  assert.match(tickPipelineSource, /PIPELINE_MARKET_INVALIDATION_PRIORITY_WINDOW/);
  assert.match(tickPipelineSource, /offset=\$\{offset\}/);
  assert.match(tickPipelineSource, /MARKET_INVALIDATION_FAST_LANE_PREFIXES\s*=\s*new Set\(\["shoe", "clothing"\]\)/);
  assert.match(tickPipelineSource, /affected_source === "joongna"/);
  assert.match(tickPipelineSource, /loadAffectedSourcesForInvalidations/);
  assert.match(tickPipelineSource, /MARKET_INVALIDATION_PATCH_CHUNK_SIZE\s*=\s*100/);
});

test("joongna ingest directly enqueues parsed market invalidations", () => {
  assert.match(joongnaIngestSource, /enqueue_mvp_market_key_invalidation/);
  assert.match(joongnaIngestSource, /p_reason:\s*"joongna_active_snapshot"/);
  assert.match(joongnaIngestSource, /prefix === "shoe" \|\| prefix === "clothing"\)\s*return 96/);
  assert.match(joongnaIngestSource, /marketInvalidationsQueued/);
  assert.match(joongnaIngestSource, /!parsed\.needsReview && parsed\.comparableKey/);
});

test("score claim RPC stays opt-in after production timeout finding", () => {
  assert.match(tickPipelineSource, /PIPELINE_SCORE_CLAIM_RPC_ENABLED/);
  assert.match(tickPipelineSource, /function scoreClaimRpcEnabled/);
  assert.match(tickPipelineSource, /if \(!scoreClaimRpcEnabled\(\)\) return null/);
});
