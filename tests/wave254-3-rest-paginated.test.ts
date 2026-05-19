// Wave 254.3 (2026-05-20): restFetchPaginated shared helper unit test.
//
// 사용자 명시 정책 (memory feedback_log_findings_even_before_fix):
//   PATCH/GET/POST 모두 cover. 1000-row cap 자동 chunk + offset pagination + retry on transient.
//   Wave 253 fix 통합: Prefer: resolution=ignore-duplicates + on_conflict URL param.
//
// 실제 production DB hit X — fetch mock 으로 검증.

import assert from "node:assert/strict";
import test from "node:test";

import {
  POSTGREST_DEFAULT_PAGE,
  insertIgnoreRows,
  patchAllByPids,
  restFetchAll,
} from "../src/lib/rest-paginated";

type FetchCall = { url: string; method: string; body: string | null; headers: Record<string, string> };

function installFetchMock(
  handler: (call: FetchCall) => { status?: number; body?: unknown; headers?: Record<string, string> },
) {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const bodyRaw = init?.body;
    const body = typeof bodyRaw === "string" ? bodyRaw : null;
    const hdrRaw = (init?.headers ?? {}) as HeadersInit;
    const hdrMap: Record<string, string> = {};
    const hdrIter = new Headers(hdrRaw);
    hdrIter.forEach((value, key) => {
      hdrMap[key.toLowerCase()] = value;
    });
    const call: FetchCall = { url, method, body, headers: hdrMap };
    calls.push(call);
    const r = handler(call);
    const status = r.status ?? 200;
    const headers = new Headers(r.headers ?? { "content-type": "application/json" });
    const responseBody = status === 204 || r.body == null ? null : JSON.stringify(r.body);
    return new Response(responseBody, { status, headers });
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function setEnv() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-service-key";
}

test("restFetchAll page 1000 cap 자동 chunk — 2500 row 3 page", async () => {
  setEnv();
  // 1000 / 1000 / 500 → 마지막 page 가 1000 미만이면 break.
  const mock = installFetchMock(({ url }) => {
    const u = new URL(url);
    const offset = Number(u.searchParams.get("offset") ?? "0");
    if (offset === 0) return { body: Array.from({ length: 1000 }, (_, i) => ({ pid: i })) };
    if (offset === 1000) return { body: Array.from({ length: 1000 }, (_, i) => ({ pid: 1000 + i })) };
    if (offset === 2000) return { body: Array.from({ length: 500 }, (_, i) => ({ pid: 2000 + i })) };
    return { body: [] };
  });
  try {
    const rows = await restFetchAll<{ pid: number }>("https://example.supabase.co/rest/v1/mvp_raw_listings?select=pid");
    assert.equal(rows.length, 2500);
    assert.equal(mock.calls.length, 3);
    // 모든 page url 에 order=pid.asc 박혀있어야 함 (page consistency).
    for (const c of mock.calls) {
      assert.ok(c.url.includes("order=pid.asc"), `order param missing: ${c.url}`);
    }
    // 첫/마지막 pid 검증.
    assert.equal(rows[0].pid, 0);
    assert.equal(rows[2499].pid, 2499);
  } finally {
    mock.restore();
  }
});

test("restFetchAll base URL 에 limit/offset 이 있으면 strip", async () => {
  setEnv();
  const mock = installFetchMock(({ url }) => {
    const u = new URL(url);
    const limit = Number(u.searchParams.get("limit") ?? "0");
    const offset = Number(u.searchParams.get("offset") ?? "0");
    // restFetchAll 가 박은 limit/offset 외 다른 limit 없어야.
    assert.equal(limit > 0 && limit <= POSTGREST_DEFAULT_PAGE, true);
    if (offset === 0) return { body: Array.from({ length: 5 }, (_, i) => ({ pid: i })) };
    return { body: [] };
  });
  try {
    // base URL 에 limit=5 + offset=10 박혀있어도 helper 가 strip 해야.
    const rows = await restFetchAll<{ pid: number }>(
      "https://example.supabase.co/rest/v1/mvp_raw_listings?select=pid&limit=5&offset=10",
    );
    assert.equal(rows.length, 5);
  } finally {
    mock.restore();
  }
});

test("restFetchAll maxRows 도달 시 early break", async () => {
  setEnv();
  let pageCount = 0;
  const mock = installFetchMock(() => {
    pageCount += 1;
    // 1000 row × 무한히 ... 정상이면 1 page 후 maxRows=500 도달 break.
    return { body: Array.from({ length: 500 }, (_, i) => ({ pid: i })) };
  });
  try {
    const rows = await restFetchAll<{ pid: number }>(
      "https://example.supabase.co/rest/v1/mvp_raw_listings?select=pid",
      { maxRows: 500 },
    );
    assert.equal(rows.length, 500);
    assert.equal(pageCount, 1, "maxRows 도달 후 추가 page fetch 안 함");
  } finally {
    mock.restore();
  }
});

test("restFetchAll empty result 즉시 break", async () => {
  setEnv();
  const mock = installFetchMock(() => ({ body: [] }));
  try {
    const rows = await restFetchAll<{ pid: number }>(
      "https://example.supabase.co/rest/v1/mvp_raw_listings?select=pid",
    );
    assert.equal(rows.length, 0);
    assert.equal(mock.calls.length, 1, "empty 응답 후 추가 page fetch 안 함");
  } finally {
    mock.restore();
  }
});

test("restFetchAll custom orderBy", async () => {
  setEnv();
  const mock = installFetchMock(() => ({ body: [] }));
  try {
    await restFetchAll<{ pid: number }>(
      "https://example.supabase.co/rest/v1/mvp_listing_parsed?select=pid",
      { orderBy: "comparable_key.asc" },
    );
    assert.ok(mock.calls[0].url.includes("order=comparable_key.asc"));
  } finally {
    mock.restore();
  }
});

test("patchAllByPids 1500 pid 자동 chunk 2개 PATCH 호출", async () => {
  setEnv();
  const mock = installFetchMock(({ method }) => {
    if (method === "PATCH") return { status: 204, body: null };
    throw new Error(`unexpected ${method}`);
  });
  try {
    const pids = Array.from({ length: 1500 }, (_, i) => i + 1);
    const affected = await patchAllByPids("mvp_raw_listings", pids, {
      payload: { score_dirty: true },
      chunkSize: 1000,
    });
    assert.equal(affected, 1500);
    const patchCalls = mock.calls.filter((c) => c.method === "PATCH");
    assert.equal(patchCalls.length, 2, "1500/1000 = 2 chunks");
    // 첫 PATCH = pid 1..1000, 두번째 = pid 1001..1500.
    assert.ok(patchCalls[0].url.includes("pid=in.(1,2"));
    assert.ok(patchCalls[1].url.includes("pid=in.(1001,1002"));
    // body 동일.
    const body0 = JSON.parse(patchCalls[0].body!) as Record<string, unknown>;
    assert.equal(body0.score_dirty, true);
  } finally {
    mock.restore();
  }
});

test("patchAllByPids empty pids → no-op", async () => {
  setEnv();
  const mock = installFetchMock(() => {
    throw new Error("empty pids 인데 fetch 호출됨");
  });
  try {
    const affected = await patchAllByPids("mvp_raw_listings", [], {
      payload: { score_dirty: true },
    });
    assert.equal(affected, 0);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("patchAllByPids preferReturn override", async () => {
  setEnv();
  const mock = installFetchMock(() => ({ status: 204, body: null }));
  try {
    await patchAllByPids("mvp_raw_listings", [1, 2, 3], {
      payload: { score_dirty: true },
      preferReturn: "return=minimal,count=exact",
    });
    const patchCall = mock.calls[0];
    assert.equal(patchCall.headers["prefer"], "return=minimal,count=exact");
  } finally {
    mock.restore();
  }
});

test("insertIgnoreRows Prefer header + on_conflict URL param 박힘", async () => {
  setEnv();
  const mock = installFetchMock(({ method, url }) => {
    if (method === "POST" && url.includes("mvp_detail_queue")) {
      return { status: 201, body: null };
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  try {
    const rows = [
      { pid: 1, status: "pending" },
      { pid: 2, status: "pending" },
    ];
    const n = await insertIgnoreRows("mvp_detail_queue", rows, {
      onConflict: "pid",
    });
    assert.equal(n, 2);
    const post = mock.calls[0];
    // Wave 253 fix — Prefer: resolution=ignore-duplicates 박힘.
    assert.ok(
      (post.headers["prefer"] ?? "").includes("resolution=ignore-duplicates"),
      `Prefer 에 ignore-duplicates 없음: ${post.headers["prefer"]}`,
    );
    // Wave 253 fix — on_conflict=pid URL param 박힘.
    assert.ok(post.url.includes("on_conflict=pid"), `on_conflict 없음: ${post.url}`);
  } finally {
    mock.restore();
  }
});

test("insertIgnoreRows rowDefaults 모든 chunk row 에 박힘", async () => {
  setEnv();
  let postBody: unknown = null;
  const mock = installFetchMock(({ method, body }) => {
    if (method === "POST") {
      postBody = body == null ? null : JSON.parse(body);
      return { status: 201, body: null };
    }
    throw new Error(`unexpected ${method}`);
  });
  try {
    await insertIgnoreRows(
      "mvp_detail_queue",
      [{ pid: 100 }, { pid: 200 }],
      {
        onConflict: "pid",
        rowDefaults: { status: "pending", priority: 50 },
      },
    );
    assert.ok(Array.isArray(postBody));
    const arr = postBody as Array<Record<string, unknown>>;
    assert.equal(arr.length, 2);
    assert.equal(arr[0].status, "pending");
    assert.equal(arr[0].priority, 50);
    assert.equal(arr[0].pid, 100);
    assert.equal(arr[1].pid, 200);
  } finally {
    mock.restore();
  }
});

test("insertIgnoreRows empty rows → no-op", async () => {
  setEnv();
  const mock = installFetchMock(() => {
    throw new Error("empty rows 인데 fetch 호출됨");
  });
  try {
    const n = await insertIgnoreRows("mvp_detail_queue", [], { onConflict: "pid" });
    assert.equal(n, 0);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("insertIgnoreRows 1200 rows chunkSize=500 → 3 chunk", async () => {
  setEnv();
  const mock = installFetchMock(() => ({ status: 201, body: null }));
  try {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ pid: i + 1 }));
    const n = await insertIgnoreRows("mvp_detail_queue", rows, {
      onConflict: "pid",
      chunkSize: 500,
    });
    assert.equal(n, 1200);
    assert.equal(mock.calls.length, 3, "1200/500 = 3 chunks");
  } finally {
    mock.restore();
  }
});

test("restFetchAll retry 재사용 — restFetch 의 transient backoff 자동", async () => {
  setEnv();
  // restFetch 의 내장 retry — 503 transient. 첫 호출 503, 두번째 200.
  let attempt = 0;
  const mock = installFetchMock(() => {
    attempt += 1;
    if (attempt === 1) return { status: 503, body: "service unavailable" };
    return { body: [{ pid: 1 }] };
  });
  try {
    const rows = await restFetchAll<{ pid: number }>(
      "https://example.supabase.co/rest/v1/mvp_raw_listings?select=pid",
    );
    assert.equal(rows.length, 1);
    // restFetch 내장 retry 가 transient 503 재시도 → 총 2 attempt.
    assert.equal(attempt, 2);
  } finally {
    mock.restore();
  }
});
