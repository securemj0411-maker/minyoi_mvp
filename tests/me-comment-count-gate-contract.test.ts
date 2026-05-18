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
  assert.match(route, /num_comment&pid=in/);
  assert.match(route, /isUserVisibleCommentBlocked\(item\.commentCount\)/);
  assert.match(route, /hideCommentBlockedReveal\(userRef, item, Number\(item\.commentCount\), "raw_num_comment"\)/);
  assert.match(route, /hideCommentBlockedReveal\(userRef, item, Number\(detail\.commentCount\), "detail_comment_count"\)/);
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
  assert.match(packOpen, /isPackOpenCommentBlocked\(meta\._raw\?\.num_comment/);
  assert.match(packOpen, /invalidateHighCommentCandidate\(candidate\.pid, Number\(meta\._raw\?\.num_comment\), "raw_num_comment"\)/);
  assert.match(packOpen, /isPackOpenCommentBlocked\(detail\?\.commentCount/);
  assert.match(packOpen, /invalidateHighCommentCandidate\(candidate\.pid, Number\(detail\?\.commentCount\), "detail_comment_count"\)/);
  assert.match(packOpen, /pool_eligible: false/);
  assert.match(packOpen, /rpcInvalidate\(pid, `pack_open_\$\{source\}_\$\{reason\}`\)/);
});
