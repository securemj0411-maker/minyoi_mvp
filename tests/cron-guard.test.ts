import assert from "node:assert/strict";
import test from "node:test";

import {
  acquireCronGuard,
  acquireCronGuardWithSourceHealth,
  getCronGuardSnapshot,
  resetCronGuardForTests,
  setCronGuardSourceHealthLoaderForTests,
} from "../src/lib/cron-guard";

test("cron guard skips overlapping same worker runs", () => {
  resetCronGuardForTests();
  const first = acquireCronGuard("tick");
  assert.equal(first.allowed, true);

  const second = acquireCronGuard("tick");
  assert.equal(second.allowed, false);
  if (!second.allowed) {
    assert.equal(second.reason, "same_worker_running");
  }

  if (first.allowed) first.release();
});

test("cron guard exposes recent skip counters without logging a run", () => {
  resetCronGuardForTests();
  const first = acquireCronGuard("tick");
  assert.equal(first.allowed, true);

  const second = acquireCronGuard("tick");
  assert.equal(second.allowed, false);

  const snapshot = getCronGuardSnapshot();
  assert.equal(snapshot.totalSkipsLastHour, 1);
  assert.equal(snapshot.skipCounters[0]?.mode, "tick");
  assert.equal(snapshot.skipCounters[0]?.reason, "same_worker_running");
  assert.equal(snapshot.skipCounters[0]?.count, 1);
  assert.equal(snapshot.recentSkips[0]?.mode, "tick");

  if (first.allowed) first.release();
});

test("cron guard cooldown skips rapid retry after release", () => {
  resetCronGuardForTests();
  const first = acquireCronGuard("detail_worker");
  assert.equal(first.allowed, true);
  if (first.allowed) first.release();

  const second = acquireCronGuard("detail_worker");
  assert.equal(second.allowed, false);
  if (!second.allowed) {
    assert.equal(second.reason, "cooldown");
  }
});

test("cron guard force query bypasses cooldown", () => {
  resetCronGuardForTests();
  const first = acquireCronGuard("market_worker");
  assert.equal(first.allowed, true);
  if (first.allowed) first.release();

  const forced = acquireCronGuard("market_worker", {
    nextUrl: { searchParams: new URLSearchParams("force=1") },
  });
  assert.equal(forced.allowed, true);
  if (forced.allowed) forced.release();
});

test("terminal lifecycle recheck has an independent guard lane", () => {
  resetCronGuardForTests();
  const lifecycle = acquireCronGuard("lifecycle_worker");
  assert.equal(lifecycle.allowed, true);

  const terminal = acquireCronGuard("lifecycle_terminal_recheck");
  assert.equal(terminal.allowed, true);

  const secondTerminal = acquireCronGuard("lifecycle_terminal_recheck");
  assert.equal(secondTerminal.allowed, false);
  if (!secondTerminal.allowed) {
    assert.equal(secondTerminal.reason, "same_worker_running");
  }

  if (terminal.allowed) terminal.release();
  if (lifecycle.allowed) lifecycle.release();
});

test("cron guard skips heavy workers when source health is unhealthy", async () => {
  resetCronGuardForTests();
  setCronGuardSourceHealthLoaderForTests(async () => ({
    status: "unhealthy",
    checked_at: new Date().toISOString(),
    reason: "tick_failure_rate_high",
  }));

  const guard = await acquireCronGuardWithSourceHealth("deep_crawl");
  assert.equal(guard.allowed, false);
  if (!guard.allowed) {
    assert.equal(guard.reason, "source_health_unhealthy");
    assert.equal(guard.detail?.sourceHealth, "unhealthy");
  }

  const snapshot = getCronGuardSnapshot();
  assert.equal(snapshot.skipCounters[0]?.reason, "source_health_unhealthy");
});

test("terminal lifecycle recheck skips when source health is unhealthy", async () => {
  resetCronGuardForTests();
  setCronGuardSourceHealthLoaderForTests(async () => ({
    status: "unhealthy",
    checked_at: new Date().toISOString(),
    reason: "tick_failure_rate_high",
  }));

  const guard = await acquireCronGuardWithSourceHealth("lifecycle_terminal_recheck");
  assert.equal(guard.allowed, false);
  if (!guard.allowed) {
    assert.equal(guard.reason, "source_health_unhealthy");
  }
});

test("cron guard lets market worker probe when source health is stale", async () => {
  resetCronGuardForTests();
  setCronGuardSourceHealthLoaderForTests(async () => ({
    status: "unhealthy",
    checked_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    reason: "tick_failure_rate_high",
  }));

  const guard = await acquireCronGuardWithSourceHealth("market_worker");
  assert.equal(guard.allowed, true);
  if (guard.allowed) guard.release();
});
