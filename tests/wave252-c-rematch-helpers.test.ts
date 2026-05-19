// Wave 252.C (2026-05-20): rematch helpers unit test (dry-run mode).
//
// 실제 production DB hit 안 함 — fetch mock 으로 검증.
// 사용자 정책 (memory destructive_actions_require_explicit_confirm) 준수:
//   default dryRun=true 검증, explicit dryRun=false 시 PATCH 호출 검증.

import assert from "node:assert/strict";
import test from "node:test";

import {
  triggerRematchForListings,
  triggerRematchForParserVersions,
  triggerRematchForSkus,
} from "../src/lib/rematch-helpers";

type FetchCall = { url: string; method: string; body: string | null };

function installFetchMock(handler: (call: FetchCall) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const bodyRaw = init?.body;
    const body = typeof bodyRaw === "string" ? bodyRaw : null;
    const call: FetchCall = { url, method, body };
    calls.push(call);
    const r = handler(call);
    const status = r.status ?? 200;
    const headers = new Headers(r.headers ?? { "content-type": "application/json" });
    // 204 / null body 경우 Response 생성자 body=null 필수.
    const responseBody = status === 204 || r.body == null ? null : JSON.stringify(r.body);
    return new Response(responseBody, { status, headers });
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => { globalThis.fetch = originalFetch; },
  };
}

function setEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-service-key";
}

test("triggerRematchForSkus default dryRun=true 시 PATCH 호출 X — count 만 반환", async () => {
  setEnv();
  const mock = installFetchMock(({ method }) => {
    if (method === "GET") {
      return {
        body: [{ pid: 1001 }, { pid: 1002 }],
        headers: {
          "content-type": "application/json",
          "content-range": "0-1/42",
        },
      };
    }
    throw new Error(`unexpected ${method} call in dry-run`);
  });
  try {
    const result = await triggerRematchForSkus(["clothing-bape-tee"], "test-dry");
    assert.equal(result.dryRun, true);
    assert.equal(result.count, 42);
    assert.deepEqual(result.samplePids, [1001, 1002]);
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0].method, "GET");
    assert.ok(mock.calls[0].url.includes("mvp_raw_listings"));
    assert.ok(mock.calls[0].url.includes("sku_id=in.("));
  } finally {
    mock.restore();
  }
});

test("triggerRematchForSkus dryRun=false 시 PATCH 호출 detail_status + score_dirty set", async () => {
  setEnv();
  // Wave 253 fix A — PATCH 전 pid fetch (페이지네이션) + PATCH + detail_queue INSERT 의 흐름.
  let getCallIdx = 0;
  const mock = installFetchMock(({ method, url }) => {
    if (method === "GET") {
      // 첫 GET = count + sample (limit=10). 두번째 GET = page (limit=1000) for fetchPidsBySkuIds.
      getCallIdx += 1;
      if (getCallIdx === 1) {
        return {
          body: [{ pid: 2001 }],
          headers: { "content-range": "0-0/5" },
        };
      }
      // page fetch — 5 pid 모두 반환.
      return {
        body: [{ pid: 2001 }, { pid: 2002 }, { pid: 2003 }, { pid: 2004 }, { pid: 2005 }],
        headers: { "content-range": "0-4/5" },
      };
    }
    if (method === "PATCH") {
      return {
        status: 204,
        body: null,
        headers: { "content-range": "*/5" },
      };
    }
    if (method === "POST" && url.includes("mvp_detail_queue")) {
      // Wave 253 fix A — INSERT IGNORE 응답.
      return { status: 201, body: null };
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  try {
    const result = await triggerRematchForSkus(["clothing-bape-tee"], "test-apply", { dryRun: false });
    assert.equal(result.dryRun, false);
    assert.equal(result.count, 5);
    const patchCall = mock.calls.find((c) => c.method === "PATCH");
    assert.ok(patchCall, "PATCH 호출 발생");
    const body = JSON.parse(patchCall!.body!) as Record<string, unknown>;
    assert.equal(body.score_dirty, true);
    assert.equal(body.detail_status, "pending");
    // Wave 253 fix A — detail_queue INSERT IGNORE 검증.
    const queueCall = mock.calls.find((c) => c.method === "POST" && c.url.includes("mvp_detail_queue"));
    assert.ok(queueCall, "mvp_detail_queue INSERT 호출 발생");
    const queueRows = JSON.parse(queueCall!.body!) as Array<Record<string, unknown>>;
    assert.equal(queueRows.length, 5, "5 pid INSERT IGNORE");
    assert.equal(queueRows[0].status, "pending");
    assert.equal(queueRows[0].priority, 50);
    assert.equal(queueRows[0].locked_at, null);
  } finally {
    mock.restore();
  }
});

test("triggerRematchForSkus resetDetailStatus=false 시 score_dirty 만 set + detail_queue INSERT 안 함", async () => {
  setEnv();
  const mock = installFetchMock(({ method, url }) => {
    if (method === "GET") return { body: [], headers: { "content-range": "0-0/3" } };
    if (method === "PATCH") return { status: 204, body: null, headers: { "content-range": "*/3" } };
    if (method === "POST" && url.includes("mvp_detail_queue")) {
      throw new Error("resetDetailStatus=false 인데 detail_queue INSERT 호출됨");
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  try {
    await triggerRematchForSkus(["x"], "test", { dryRun: false, resetDetailStatus: false });
    const patchCall = mock.calls.find((c) => c.method === "PATCH");
    const body = JSON.parse(patchCall!.body!) as Record<string, unknown>;
    assert.equal(body.score_dirty, true);
    assert.equal(body.detail_status, undefined);
    // Wave 253 fix A — resetDetailStatus=false → detail_queue INSERT 호출 안 함.
    const queueCall = mock.calls.find((c) => c.method === "POST" && c.url.includes("mvp_detail_queue"));
    assert.equal(queueCall, undefined, "resetDetailStatus=false 시 detail_queue INSERT 안 함");
  } finally {
    mock.restore();
  }
});

test("triggerRematchForListings dryRun 시 PATCH 안 함", async () => {
  setEnv();
  const mock = installFetchMock(() => {
    throw new Error("dryRun=true 인데 fetch 호출됨");
  });
  try {
    const result = await triggerRematchForListings([100, 200, 300], "test-pid-dry");
    assert.equal(result.dryRun, true);
    assert.equal(result.count, 3);
    assert.deepEqual(result.samplePids, [100, 200, 300]);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("triggerRematchForListings 큰 batch 분할 PATCH (batchSize=2) + detail_queue INSERT", async () => {
  setEnv();
  const mock = installFetchMock(({ method, url }) => {
    if (method === "PATCH") return { status: 204, body: null };
    if (method === "POST" && url.includes("mvp_detail_queue")) {
      return { status: 201, body: null };
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  try {
    const result = await triggerRematchForListings([1, 2, 3, 4, 5], "split-test", { dryRun: false, batchSize: 2 });
    assert.equal(result.count, 5);
    // 5 pids / batch 2 = 3 batches (2 + 2 + 1)
    const patchCalls = mock.calls.filter((c) => c.method === "PATCH");
    assert.equal(patchCalls.length, 3);
    // Wave 253 fix A — detail_queue INSERT IGNORE (chunk=500 라 5건 1 call).
    const queueCalls = mock.calls.filter((c) => c.method === "POST" && c.url.includes("mvp_detail_queue"));
    assert.equal(queueCalls.length, 1, "detail_queue INSERT 1회 (5 pid 1 chunk)");
    const queueRows = JSON.parse(queueCalls[0].body!) as Array<Record<string, unknown>>;
    assert.equal(queueRows.length, 5);
    assert.deepEqual(queueRows.map((r) => r.pid), [1, 2, 3, 4, 5]);
    assert.equal(queueRows[0].status, "pending");
    assert.equal(queueRows[0].priority, 50);
  } finally {
    mock.restore();
  }
});

test("triggerRematchForListings dryRun=false + resetDetailStatus=false → PATCH 만, detail_queue INSERT 안 함", async () => {
  setEnv();
  const mock = installFetchMock(({ method, url }) => {
    if (method === "PATCH") return { status: 204, body: null };
    if (method === "POST" && url.includes("mvp_detail_queue")) {
      throw new Error("resetDetailStatus=false 인데 detail_queue INSERT 호출됨");
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  try {
    await triggerRematchForListings([10, 20, 30], "no-detail", { dryRun: false, resetDetailStatus: false });
    const queueCall = mock.calls.find((c) => c.method === "POST" && c.url.includes("mvp_detail_queue"));
    assert.equal(queueCall, undefined);
    // PATCH body 검증 — detail_status 없음.
    const patchCall = mock.calls.find((c) => c.method === "PATCH");
    const body = JSON.parse(patchCall!.body!) as Record<string, unknown>;
    assert.equal(body.score_dirty, true);
    assert.equal(body.detail_status, undefined);
  } finally {
    mock.restore();
  }
});

test("triggerRematchForListings detail_queue INSERT Prefer header + on_conflict 정확", async () => {
  setEnv();
  let queueHeaders: Headers | null = null;
  let queueUrl: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST" && url.includes("mvp_detail_queue")) {
      queueHeaders = new Headers((init?.headers as HeadersInit | undefined) ?? {});
      queueUrl = url;
      return new Response(null, { status: 201 });
    }
    if (method === "PATCH") return new Response(null, { status: 204 });
    throw new Error(`unexpected ${method} ${url}`);
  }) as typeof globalThis.fetch;
  try {
    await triggerRematchForListings([99], "header-test", { dryRun: false });
    assert.ok(queueHeaders, "detail_queue INSERT 호출됨");
    const prefer = (queueHeaders as Headers).get("prefer");
    assert.ok(prefer, "Prefer header 존재");
    assert.ok(prefer!.includes("resolution=ignore-duplicates"), "Prefer 에 ignore-duplicates");
    // Wave 253 fix A — on_conflict=pid URL param 필수.
    assert.ok(queueUrl, "INSERT URL 캡처");
    assert.ok(queueUrl!.includes("on_conflict=pid"), "URL 에 on_conflict=pid");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("triggerRematchForListings empty pids → no-op", async () => {
  setEnv();
  const mock = installFetchMock(() => {
    throw new Error("empty 인데 fetch 호출됨");
  });
  try {
    const result = await triggerRematchForListings([], "empty");
    assert.equal(result.count, 0);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("triggerRematchForSkus empty skuIds → no-op", async () => {
  setEnv();
  const mock = installFetchMock(() => {
    throw new Error("empty 인데 fetch 호출됨");
  });
  try {
    const result = await triggerRematchForSkus([], "empty");
    assert.equal(result.count, 0);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("triggerRematchForParserVersions dryRun 시 count + sample 만, PATCH 안 함", async () => {
  setEnv();
  const mock = installFetchMock(({ method, url }) => {
    if (method === "GET" && url.includes("mvp_listing_parsed")) {
      return {
        body: [{ pid: 9001 }, { pid: 9002 }],
        headers: { "content-range": "0-1/12345" },
      };
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  try {
    const result = await triggerRematchForParserVersions(
      ["wave216-clothing-v3", "wave92-fashion-mobility-v3"],
      "wave252-b-measure",
    );
    assert.equal(result.dryRun, true);
    assert.equal(result.count, 12345);
    assert.deepEqual(result.samplePids, [9001, 9002]);
    // dry-run 이면 mvp_listing_parsed GET 1 회만.
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});
