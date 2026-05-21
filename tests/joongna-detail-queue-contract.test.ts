import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ingestSource = readFileSync(new URL("../src/lib/joongna-ingest.ts", import.meta.url), "utf8");
const workerRouteSource = readFileSync(new URL("../src/app/api/cron/joongna-worker/route.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260521183000_wave502_joongna_detail_queue.sql", import.meta.url),
  "utf8",
);

test("joongna search discovery is persisted through a dedicated detail queue", () => {
  assert.match(migrationSource, /create table if not exists public\.mvp_joongna_detail_queue/i);
  assert.match(migrationSource, /product_url text not null/i);
  assert.match(migrationSource, /unique index if not exists mvp_joongna_detail_queue_product_url_key/i);
  assert.match(migrationSource, /enable row level security/i);
  assert.match(migrationSource, /grant select, insert, update, delete on public\.mvp_joongna_detail_queue to service_role/i);
  assert.match(migrationSource, /claim_mvp_joongna_detail_queue/i);
  assert.match(migrationSource, /for update skip locked/i);
});

test("joongna ingest falls back when the detail queue is unavailable", () => {
  assert.match(ingestSource, /JOONGNA_DETAIL_QUEUE_TABLE\s*=\s*"mvp_joongna_detail_queue"/);
  assert.match(ingestSource, /joongnaDetailQueueAvailable/);
  assert.match(ingestSource, /JOONGNA_DETAIL_QUEUE_ENABLED\s*===\s*"0"/);
  assert.match(ingestSource, /falling back to direct ingest/);
  assert.match(ingestSource, /queueMode\s*=\s*false/);
});

test("joongna ingest enqueues discovered URLs and claims details separately", () => {
  assert.match(ingestSource, /enqueueJoongnaDetailQueue/);
  assert.match(ingestSource, /claimJoongnaDetailQueue/);
  assert.match(ingestSource, /resolution=ignore-duplicates,return=minimal/);
  assert.match(ingestSource, /claim_mvp_joongna_detail_queue/);
  assert.match(ingestSource, /markJoongnaDetailQueueDone/);
  assert.match(ingestSource, /markJoongnaDetailQueueFailed/);
  assert.match(ingestSource, /detailQueueClaimed/);
  assert.match(ingestSource, /queue_no_pending_details/);
});

test("joongna worker logs detail queue counters", () => {
  assert.match(workerRouteSource, /queueMode: result\.queueMode/);
  assert.match(workerRouteSource, /detailQueueEnqueued: result\.detailQueueEnqueued/);
  assert.match(workerRouteSource, /detailQueueClaimed: result\.detailQueueClaimed/);
  assert.match(workerRouteSource, /detailQueueDone: result\.detailQueueDone/);
  assert.match(workerRouteSource, /detailQueueFailed: result\.detailQueueFailed/);
});
