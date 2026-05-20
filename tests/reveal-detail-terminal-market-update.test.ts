import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packOpenSource = readFileSync(new URL("../src/lib/pack-open.ts", import.meta.url), "utf8");

test("reveal detail terminal detection refreshes market inputs", () => {
  assert.match(packOpenSource, /last_seen_at:\s*now/);
  assert.match(packOpenSource, /enqueue_mvp_market_key_invalidation/);
  assert.match(packOpenSource, /mvp_listing_observations/);
  assert.match(packOpenSource, /event_type:\s*"state_changed"/);
  assert.match(packOpenSource, /source:\s*"reveal_detail"/);
});
