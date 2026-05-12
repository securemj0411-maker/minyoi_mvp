type Headers = Record<string, string>;

function sanitizeJsonString(input: string) {
  let output = "";
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code === 0x0000) continue;
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += input[i] + input[i + 1];
        i += 1;
      }
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue;
    output += input[i];
  }
  return output;
}

function sanitizeJsonValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return sanitizeJsonString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (value == null || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item, seen));
  if (typeof value !== "object") return undefined;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return null;
  seen.add(value);
  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const sanitizedItem = sanitizeJsonValue(item, seen);
    if (sanitizedItem !== undefined) sanitized[key] = sanitizedItem;
  }
  seen.delete(value);
  return sanitized;
}

export function jsonBody(value: unknown) {
  return JSON.stringify(sanitizeJsonValue(value));
}

export function serviceHeaders(prefer?: string): Headers {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

function restBase() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) throw new Error("SUPABASE_URL missing");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

export function tableUrl(table: string) {
  return `${restBase()}/${table}`;
}

export function rpcUrl(name: string) {
  return `${restBase()}/rpc/${name}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRestFailure(status: number, body: string) {
  // P1-10: 429(rate limit) / 503/504(gateway) 도 transient. 502도 cold start나 일시 장애로 발생.
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  if (status < 500 && status !== 409) return false;
  return /40P01|deadlock detected|40001|serialization_failure|55P03|lock_not_available/i.test(body);
}

function retryDelayMs(attempt: number, status: number, retryAfterHeader: string | null): number {
  // 429에 Retry-After 헤더가 있으면 우선 존중 (초 단위 또는 HTTP-date).
  if (status === 429 && retryAfterHeader) {
    const seconds = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5_000);
  }
  // 기본 backoff: 250 * attempt + jitter 0~100ms.
  return 250 * attempt + Math.floor(Math.random() * 100);
}

function describeRestTarget(path: string) {
  try {
    const url = new URL(path);
    return `${url.pathname}${url.search}`.slice(0, 320);
  } catch {
    return path.slice(0, 320);
  }
}

export async function restFetch(path: string, init: RequestInit = {}) {
  const method = init.method ?? "GET";
  const target = describeRestTarget(path);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(path, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(8_000),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        throw new Error(`Supabase REST timed out ${method} ${target}`);
      }
      if (attempt < maxAttempts) {
        await sleep(150 * attempt);
        continue;
      }
      throw new Error(`Supabase REST fetch failed ${method} ${target}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (res.ok) return res;
    const body = await res.text();
    if (attempt < maxAttempts && isTransientRestFailure(res.status, body)) {
      const retryAfter = res.headers.get("retry-after");
      await sleep(retryDelayMs(attempt, res.status, retryAfter));
      continue;
    }
    throw new Error(`Supabase REST failed ${res.status} ${method} ${target}: ${body}`);
  }
  throw new Error(`Supabase REST failed ${method} ${target} after retries`);
}
