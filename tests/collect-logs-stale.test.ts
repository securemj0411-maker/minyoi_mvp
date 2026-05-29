import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  markStaleCollectRuns,
  resetCollectRunStaleMarkerForTests,
} from "../src/lib/collect-logs";

const originalFetch = globalThis.fetch;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalLocalCooldown = process.env.COLLECT_RUN_STALE_MARK_LOCAL_COOLDOWN_MS;
const originalLeaseSeconds = process.env.COLLECT_RUN_STALE_MARK_LEASE_SECONDS;

function setupEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.COLLECT_RUN_STALE_MARK_LOCAL_COOLDOWN_MS = "0";
  process.env.COLLECT_RUN_STALE_MARK_LEASE_SECONDS = "60";
  resetCollectRunStaleMarkerForTests();
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalSupabaseUrl == null) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalServiceKey == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  if (originalLocalCooldown == null) delete process.env.COLLECT_RUN_STALE_MARK_LOCAL_COOLDOWN_MS;
  else process.env.COLLECT_RUN_STALE_MARK_LOCAL_COOLDOWN_MS = originalLocalCooldown;
  if (originalLeaseSeconds == null) delete process.env.COLLECT_RUN_STALE_MARK_LEASE_SECONDS;
  else process.env.COLLECT_RUN_STALE_MARK_LEASE_SECONDS = originalLeaseSeconds;
  resetCollectRunStaleMarkerForTests();
});

test("stale collect run marker skips the expensive patch when lease is held", async () => {
  setupEnv();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    assert.match(url, /\/rest\/v1\/rpc\/try_acquire_mvp_cron_lock$/);
    return new Response(JSON.stringify([{ acquired: false }]), { status: 200 });
  }) as typeof fetch;

  const marked = await markStaleCollectRuns(3);

  assert.equal(marked, 0);
  assert.equal(calls.length, 1);
});

test("stale collect run marker patches stale runs after acquiring the DB lease", async () => {
  setupEnv();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/rpc/try_acquire_mvp_cron_lock")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      assert.equal(body.p_mode, "collect_runs_stale_marker");
      return new Response(JSON.stringify([{ acquired: true }]), { status: 200 });
    }
    assert.match(url, /\/rest\/v1\/mvp_collect_runs\?/);
    assert.equal(init?.method, "PATCH");
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    assert.equal(body.status, "failed");
    return new Response(JSON.stringify([{ id: "run-1" }, { id: "run-2" }]), { status: 200 });
  }) as typeof fetch;

  const marked = await markStaleCollectRuns(3);

  assert.equal(marked, 2);
  assert.equal(calls.length, 2);
});

test("stale collect run marker falls open when the lease RPC is unavailable", async () => {
  setupEnv();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/rpc/try_acquire_mvp_cron_lock")) {
      return new Response("temporary rpc failure", { status: 503 });
    }
    assert.match(url, /\/rest\/v1\/mvp_collect_runs\?/);
    return new Response(JSON.stringify([{ id: "run-1" }]), { status: 200 });
  }) as typeof fetch;

  const marked = await markStaleCollectRuns(3);

  assert.equal(marked, 1);
  assert.equal(calls.length, 2);
});
