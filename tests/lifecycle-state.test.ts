import assert from "node:assert/strict";
import test from "node:test";

import {
  isTerminalListingState,
  searchListingStatePatch,
  sourceUpdatedAtFromSearchUpdateTime,
} from "../src/lib/tick-pipeline";
import {
  detectSoldOut,
  hasStrongSoldOutSignal,
  soldOutTextHits,
} from "../src/lib/sold-out";

test("search state patch keeps terminal sold state until lifecycle recheck", () => {
  const patch = searchListingStatePatch({
    listing_state: "sold_confirmed",
    missing_count: 2,
    last_missing_at: "2026-05-10T12:00:00.000Z",
  });

  assert.equal(patch.listing_state, "sold_confirmed");
  assert.equal(patch.missing_count, 2);
  assert.equal(patch.last_missing_at, "2026-05-10T12:00:00.000Z");
  assert.equal(patch.terminal_preserved, true);
});

test("search state patch keeps disappeared state until lifecycle recheck", () => {
  const patch = searchListingStatePatch({
    listing_state: "disappeared",
    missing_count: 3,
    last_missing_at: "2026-05-10T12:00:00.000Z",
  });

  assert.equal(patch.listing_state, "disappeared");
  assert.equal(patch.missing_count, 3);
  assert.equal(patch.terminal_preserved, true);
});

test("search state patch restores missing suspect to active on search sighting", () => {
  const patch = searchListingStatePatch({
    listing_state: "missing_suspect",
    missing_count: 1,
    last_missing_at: "2026-05-10T12:00:00.000Z",
  });

  assert.equal(patch.listing_state, "active");
  assert.equal(patch.missing_count, 0);
  assert.equal(patch.last_missing_at, null);
  assert.equal(patch.terminal_preserved, false);
});

test("terminal listing state helper only treats final states as terminal", () => {
  assert.equal(isTerminalListingState("sold_confirmed"), true);
  assert.equal(isTerminalListingState("disappeared"), true);
  assert.equal(isTerminalListingState("archived"), true);
  assert.equal(isTerminalListingState("active"), false);
  assert.equal(isTerminalListingState("missing_suspect"), false);
  assert.equal(isTerminalListingState(null), false);
});

test("search update_time parses to source_updated_at candidate", () => {
  assert.equal(
    sourceUpdatedAtFromSearchUpdateTime(1_778_490_000),
    "2026-05-11T09:00:00.000Z",
  );
  assert.equal(
    sourceUpdatedAtFromSearchUpdateTime(1_778_490_000_000),
    "2026-05-11T09:00:00.000Z",
  );
  assert.equal(sourceUpdatedAtFromSearchUpdateTime(1), null);
});

test("sold-out detector treats manual title sold wording as strong signal", () => {
  const signals = detectSoldOut({
    saleStatus: "SELLING",
    description: "본문에는 별도 상태값이 없습니다.",
    imageUrlTemplate: "https://example.com/{cnt}.jpg",
    thumbnailUrl: "https://example.com/1.jpg",
  } as never, 130_000, { title: "에어팟 4세대 노캔 X 판매완료" });

  assert.deepEqual(signals, ["text_traded"]);
  assert.equal(hasStrongSoldOutSignal(signals), true);
});

test("sold-out text helper ignores conditional deletion wording", () => {
  assert.deepEqual(soldOutTextHits("판매완료시 삭제합니다"), []);
});
