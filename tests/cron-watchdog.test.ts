import assert from "node:assert/strict";
import test from "node:test";

import { summarizeGuardSkipIncidentForTests } from "../src/lib/cron-watchdog";

const NOW = Date.parse("2026-06-05T22:30:00.000Z");

test("cron watchdog alerts when daangn worker is repeatedly guard-skipped", () => {
  const incident = summarizeGuardSkipIncidentForTests(
    {
      name: "daangn-worker",
      executionMode: "daangn_worker",
      alertAfterMinutes: 20,
    },
    [
      {
        started_at: "2026-06-05T22:29:00.000Z",
        status: "skipped_unhealthy",
        skip_reason: "source_health_unhealthy",
        detail: {
          reason: "blocked:http_403_access_denied",
          ageMs: 52 * 60 * 60 * 1000,
        },
      },
      {
        started_at: "2026-06-05T22:05:00.000Z",
        status: "skipped_unhealthy",
        skip_reason: "source_health_unhealthy",
        detail: {
          reason: "blocked:http_403_access_denied",
          ageMs: 52 * 60 * 60 * 1000,
        },
      },
    ],
    NOW,
  );

  assert.equal(incident?.worker, "daangn-worker");
  assert.equal(incident?.mode, "daangn_worker");
  assert.equal(incident?.alertAgeMinutes, 3120);
  assert.equal(incident?.sourceHealthAgeMinutes, 3120);
  assert.equal(incident?.sourceHealthReason, "blocked:http_403_access_denied");
});

test("cron watchdog does not alert after a guard-skipped worker recovers", () => {
  const incident = summarizeGuardSkipIncidentForTests(
    {
      name: "daangn-worker",
      executionMode: "daangn_worker",
      alertAfterMinutes: 20,
    },
    [
      {
        started_at: "2026-06-05T22:29:00.000Z",
        status: "success",
        skip_reason: null,
        detail: null,
      },
      {
        started_at: "2026-06-05T22:05:00.000Z",
        status: "skipped_unhealthy",
        skip_reason: "source_health_unhealthy",
        detail: {
          reason: "blocked:http_403_access_denied",
          ageMs: 52 * 60 * 60 * 1000,
        },
      },
    ],
    NOW,
  );

  assert.equal(incident, null);
});

test("cron watchdog ignores a fresh source health guard skip", () => {
  const incident = summarizeGuardSkipIncidentForTests(
    {
      name: "joongna-worker",
      executionMode: "joongna_worker",
      alertAfterMinutes: 15,
    },
    [
      {
        started_at: "2026-06-05T22:29:00.000Z",
        status: "skipped_unhealthy",
        skip_reason: "source_health_unhealthy",
        detail: {
          reason: "blocked:http_403_access_denied",
          ageMs: 5 * 60 * 1000,
        },
      },
    ],
    NOW,
  );

  assert.equal(incident, null);
});
