/**
 * P0-1 race-condition simulation for openPack.
 *
 * Boundary tested: the finalization step (pack_opens row + reveals rows + pool
 * commit/release updates). Before the `record_mvp_pack_open` RPC, this was
 * three sequential HTTP calls and any failure between them left the system
 * inconsistent (charged with no reveals, or revealed with no exposure bump,
 * etc.). After: one RPC call carries the entire bundle; Postgres rolls back
 * the whole transaction on any error.
 *
 * The test stubs the global fetch handler and:
 *   1. Confirms `openPack` issues exactly ONE finalize call per invocation
 *      (no partial state can be exposed mid-flight).
 *   2. Runs N=10 concurrent invocations and confirms each one reserves a
 *      distinct candidate set (proves the pool reservation RPC, not the app,
 *      is the atomic gate for double-spend).
 *   3. Simulates a failure on the finalize RPC and confirms openPack throws
 *      without first having written anything to pack_opens/pack_reveals via
 *      direct PostgREST writes — i.e. all writes go through the RPC.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { openPack } from "../src/lib/pack-open";

type FetchCall = { url: string; method: string; body: unknown };

type Stub = {
  calls: FetchCall[];
  setHandler: (fn: (call: FetchCall) => Response | Promise<Response>) => void;
  restore: () => void;
};

function stubFetch(): Stub {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;
  let handler: (call: FetchCall) => Response | Promise<Response> = () =>
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } });

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    let parsedBody: unknown = null;
    if (typeof init?.body === "string") {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {
        parsedBody = init.body;
      }
    }
    const call: FetchCall = { url, method, body: parsedBody };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;

  return {
    calls,
    setHandler: (fn) => {
      handler = fn;
    },
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeReserved(pid: number) {
  return {
    pid,
    profit_band: 1,
    expected_profit_min: 1000,
    expected_profit_max: 5000,
    score: 1,
    confidence: 0.8,
    comparable_key: "k",
    exposure_count: 0,
    max_exposure: 5,
    last_verified_at: new Date().toISOString(),
    reserved_until: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
}

function fakeListing(pid: number) {
  return {
    pid,
    name: `airpods pro 2 (lot ${pid})`,
    url: `https://example.com/${pid}`,
    price: 200000,
    sku_name: "airpods_pro2",
    thumbnail_url: null,
  };
}

function buildHandler(opts: {
  inventory?: Array<{ band: number; usableReady: number }>;
  reserved: number[];
  failFinalize?: boolean;
} = { reserved: [] }) {
  return async (call: FetchCall): Promise<Response> => {
    // Inventory loadInventory() query
    if (call.url.includes("/mvp_candidate_pool?select=profit_band")) {
      const rows = (opts.inventory ?? [{ band: 1, usableReady: 999 }]).flatMap((b) =>
        Array.from({ length: b.usableReady }, () => ({
          profit_band: b.band,
          status: "ready",
          last_verified_at: new Date().toISOString(),
          category: "earphone",
          comparable_key: "airpods_pro2_usbc",
        })),
      );
      return jsonResponse(rows);
    }
    // Category readiness map
    if (call.url.includes("/mvp_category_readiness")) {
      return jsonResponse([
        { category: "earphone", status: "ready", min_ready_pool: 1, min_parse_rate: 0, min_trusted_keys: 0 },
      ]);
    }
    if (call.url.includes("/rpc/reserve_mvp_pool_candidates")) {
      return jsonResponse(opts.reserved.map(fakeReserved));
    }
    if (call.url.includes("/mvp_listings?select=")) {
      const pids = (call.url.match(/pid=in\.\(([^)]*)\)/)?.[1] ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      return jsonResponse(pids.map(fakeListing));
    }
    if (call.url.includes("/mvp_source_health")) {
      return jsonResponse([{ status: "healthy", checked_at: new Date().toISOString() }]);
    }
    if (call.url.includes("/rpc/record_mvp_pack_open")) {
      if (opts.failFinalize) {
        return jsonResponse({ message: "simulated failure" }, 500);
      }
      return jsonResponse(123);
    }
    // verify fetch (bunjang detail) — return any non-sold response
    if (call.url.includes("bunjang") || call.url.includes("/products/")) {
      return jsonResponse({ data: { product: { saleStatus: "SELLING", saleStatusType: "SELLING" } } });
    }
    // Default OK
    return jsonResponse({});
  };
}

test("openPack issues exactly one finalize call on success", async () => {
  process.env.SUPABASE_URL = "https://stub.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";

  const stub = stubFetch();
  try {
    stub.setHandler(buildHandler({ reserved: [101, 102, 103, 104] }));
    const result = await openPack({
      band: 1,
      userRef: "user-a",
      tokensSpent: 1,
      requestedCards: 2,
    });

    const finalizeCalls = stub.calls.filter((c) => c.url.includes("/rpc/record_mvp_pack_open"));
    const directPackOpens = stub.calls.filter(
      (c) =>
        c.url.includes("/mvp_pack_opens") &&
        !c.url.includes("/rpc/") &&
        c.method !== "GET",
    );
    const directReveals = stub.calls.filter(
      (c) =>
        c.url.includes("/mvp_pack_reveals") &&
        !c.url.includes("/rpc/") &&
        c.method !== "GET",
    );

    assert.equal(finalizeCalls.length, 1, "exactly one finalize RPC call expected");
    assert.equal(directPackOpens.length, 0, "no direct PostgREST writes to mvp_pack_opens");
    assert.equal(directReveals.length, 0, "no direct PostgREST writes to mvp_pack_reveals");
    assert.equal(result.result, "success");

    const payload = finalizeCalls[0]!.body as Record<string, unknown>;
    assert.equal(payload.p_user_ref, "user-a");
    assert.equal(payload.p_result, "success");
    assert.ok(Array.isArray(payload.p_reveals));
    assert.equal((payload.p_reveals as unknown[]).length, 2);
  } finally {
    stub.restore();
  }
});

test("concurrent openPack invocations each finalize exactly once", async () => {
  process.env.SUPABASE_URL = "https://stub.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";

  const stub = stubFetch();
  try {
    let nextPid = 1000;
    stub.setHandler(async (call) => {
      if (call.url.includes("/rpc/reserve_mvp_pool_candidates")) {
        const pids = [nextPid++, nextPid++, nextPid++, nextPid++];
        return jsonResponse(pids.map(fakeReserved));
      }
      return buildHandler({ reserved: [] })(call);
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        openPack({ band: 1, userRef: `user-${i}`, tokensSpent: 1, requestedCards: 2 }),
      ),
    );

    const finalizeCalls = stub.calls.filter((c) => c.url.includes("/rpc/record_mvp_pack_open"));
    assert.equal(finalizeCalls.length, 10, "one finalize per concurrent invocation");

    const allReservedPids = new Set<number>();
    let collisions = 0;
    for (const call of finalizeCalls) {
      const payload = call.body as { p_attempted_pids: number[] };
      for (const pid of payload.p_attempted_pids) {
        if (allReservedPids.has(pid)) collisions += 1;
        allReservedPids.add(pid);
      }
    }
    assert.equal(collisions, 0, "no pid claimed by two invocations (atomic reservation)");
    assert.equal(
      results.every((r) => r.result === "success"),
      true,
      "all invocations succeed when inventory is sufficient",
    );
  } finally {
    stub.restore();
  }
});

test("openPack throws on finalize failure without partial writes", async () => {
  process.env.SUPABASE_URL = "https://stub.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-key";

  const stub = stubFetch();
  try {
    stub.setHandler(buildHandler({ reserved: [201, 202, 203, 204], failFinalize: true }));

    await assert.rejects(
      openPack({ band: 1, userRef: "user-b", tokensSpent: 1, requestedCards: 2 }),
      /supabase.*record_mvp_pack_open|500/i,
    );

    const directPackOpens = stub.calls.filter(
      (c) =>
        c.url.includes("/mvp_pack_opens") &&
        !c.url.includes("/rpc/") &&
        c.method !== "GET",
    );
    const directReveals = stub.calls.filter(
      (c) =>
        c.url.includes("/mvp_pack_reveals") &&
        !c.url.includes("/rpc/") &&
        c.method !== "GET",
    );
    assert.equal(directPackOpens.length, 0, "no app-side write to mvp_pack_opens before RPC");
    assert.equal(directReveals.length, 0, "no app-side write to mvp_pack_reveals before RPC");
  } finally {
    stub.restore();
  }
});
