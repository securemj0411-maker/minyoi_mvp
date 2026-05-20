import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("/me hides already-revealed items once comment count crosses the pool gate", () => {
  const route = source("src/app/api/packs/me/route.ts");
  const dashboard = source("src/components/user-reveal-dashboard.tsx");

  assert.match(route, /const MAX_USER_VISIBLE_NUM_COMMENT = 8/);
  assert.match(route, /num_comment[\s\S]*pid=in/);
  assert.match(route, /isUserVisibleCommentBlocked\(item\.commentCount\)/);
  assert.match(route, /hideCommentBlockedReveal\(item, Number\(item\.commentCount\), "raw_num_comment"\)/);
  assert.match(route, /hideCommentBlockedReveal\(item, Number\(detail\.commentCount\), "detail_comment_count"\)/);
  assert.match(route, /mvp_pack_reveals"\)\}\?pid=eq\.\$\{item\.pid\}&hidden_at=is\.null/);
  assert.match(route, /hidden_reason: reason/);
  assert.match(route, /hidden_source: `packs_me_\$\{source\}`/);
  assert.match(route, /pool_eligible: false/);
  assert.match(route, /score_dirty: false/);
  assert.match(dashboard, /commentCount: number \| null/);
  assert.match(dashboard, /commentCount: fallbackItem\.commentCount/);
});

test("pack open re-checks high-comment candidates before reveal commit", () => {
  const packOpen = source("src/lib/pack-open.ts");

  assert.match(packOpen, /const MAX_PACK_OPEN_NUM_COMMENT = 8/);
  assert.match(packOpen, /num_comment/);
  assert.match(packOpen, /const rawCommentCount = meta\._raw\?\.num_comment \?\? null/);
  assert.match(packOpen, /isPackOpenCommentBlocked\(rawCommentCount\)/);
  assert.match(packOpen, /invalidateHighCommentCandidate\(candidate\.pid, Number\(rawCommentCount\), "raw_num_comment"\)/);
  assert.match(packOpen, /const COMMENT_COUNT_REFRESH_MS = 6 \* 60 \* 60 \* 1000/);
  assert.match(packOpen, /detail_enriched_at/);
  assert.match(packOpen, /const shouldLiveVerify = !isFresh \|\| hasStaleRawCommentCount\(meta\._raw\)/);
  assert.match(packOpen, /isPackOpenCommentBlocked\(detail\?\.commentCount/);
  assert.match(packOpen, /invalidateHighCommentCandidate\(candidate\.pid, Number\(detail\?\.commentCount\), "detail_comment_count"\)/);
  assert.match(packOpen, /patchRawCommentCount\(candidate\.pid, detail\.commentCount\)/);
  assert.match(packOpen, /pool_eligible: false/);
  assert.match(packOpen, /rpcInvalidate\(pid, `pack_open_\$\{source\}_\$\{reason\}`\)/);
});

test("old detail rows with missing comment count are re-enriched before future scoring", () => {
  const pipeline = source("src/lib/tick-pipeline.ts");

  assert.match(pipeline, /BUNTALK_COUNT_FIX_DEPLOYED_AT_MS/);
  assert.match(pipeline, /detailEnrichedAt < BUNTALK_COUNT_FIX_DEPLOYED_AT_MS/);
  assert.match(pipeline, /existing\.num_comment == null/);
  assert.match(pipeline, /detail_status,detail_enriched_at,detail_error,last_seen_at,last_changed_at,source_updated_at,listing_state,sale_status,num_comment/);
});

test("pool warmer updates comment count before refreshing verification time", () => {
  const pipeline = source("src/lib/tick-pipeline.ts");

  assert.match(pipeline, /const MAX_POOL_WARM_NUM_COMMENT = 8/);
  assert.match(pipeline, /patchPoolWarmDetailFacts\(row\.pid, detail\)/);
  assert.match(pipeline, /detail\.commentCount != null && detail\.commentCount >= MAX_POOL_WARM_NUM_COMMENT/);
  assert.match(pipeline, /num_comment_above_\$\{MAX_POOL_WARM_NUM_COMMENT\}_pool_warmer/);
  assert.match(pipeline, /detail_enriched_at: now/);
});
