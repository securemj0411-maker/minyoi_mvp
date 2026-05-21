import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const joongnaIngestSource = readFileSync(new URL("../src/lib/joongna-ingest.ts", import.meta.url), "utf8");
const joongnaWorkerRouteSource = readFileSync(new URL("../src/app/api/cron/joongna-worker/route.ts", import.meta.url), "utf8");

test("joongna ingest stops before route timeout and reports partial runs", () => {
  assert.match(joongnaIngestSource, /JOONGNA_INGEST_DEADLINE_SAFETY_MS\s*=\s*20_000/);
  assert.match(joongnaIngestSource, /deadlineMs\?: number \| null/);
  assert.match(joongnaIngestSource, /shouldStopForJoongnaDeadline/);
  assert.match(joongnaIngestSource, /budgetStopped\s*=\s*true/);
  assert.match(joongnaIngestSource, /budgetStopped,/);
});

test("joongna cron route passes an explicit worker budget", () => {
  assert.match(joongnaWorkerRouteSource, /JOONGNA_WORKER_BUDGET_MS/);
  assert.match(joongnaWorkerRouteSource, /75_000/);
  assert.match(joongnaWorkerRouteSource, /deadlineMs: Date\.now\(\) \+ budgetMs/);
  assert.match(joongnaWorkerRouteSource, /budgetStopped: result\.budgetStopped/);
});
