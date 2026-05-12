import { jsonBody, restFetch, rpcUrl, serviceHeaders } from "@/lib/supabase-rest";

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

export function clientIpKey(req: Request): string {
  const headers = req.headers;
  const ip =
    firstForwardedIp(headers.get("x-forwarded-for")) ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-vercel-forwarded-for") ??
    "unknown";
  return ip.slice(0, 80);
}

export type RateLimitInput = {
  bucketKey: string;
  maxRequests: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  currentCount: number;
  resetAt: string;
  retryAfterSeconds: number;
};

type RateLimitRow = {
  allowed?: boolean;
  current_count?: number;
  reset_at?: string;
};

function isEnabled() {
  return process.env.RATE_LIMIT_ENABLED === "1";
}

function failOpen(reason: string): RateLimitResult {
  if (reason) console.warn("rate_limit fail_open", reason);
  return {
    allowed: true,
    currentCount: 0,
    resetAt: new Date().toISOString(),
    retryAfterSeconds: 0,
  };
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  if (!isEnabled()) return failOpen("");

  const bucketKey = input.bucketKey.trim().slice(0, 200);
  const maxRequests = Math.max(1, Math.floor(input.maxRequests));
  const windowSeconds = Math.max(1, Math.floor(input.windowSeconds));

  if (!bucketKey) return failOpen("empty_bucket_key");

  try {
    const res = await restFetch(rpcUrl("check_mvp_rate_limit"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({
        p_bucket_key: bucketKey,
        p_max_requests: maxRequests,
        p_window_seconds: windowSeconds,
      }),
    });
    const rows = (await res.json()) as RateLimitRow[];
    const row = rows[0] ?? {};
    const allowed = Boolean(row.allowed);
    const currentCount = Math.max(0, Number(row.current_count ?? 0));
    const resetAt = row.reset_at ?? new Date(Date.now() + windowSeconds * 1000).toISOString();
    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000));
    return { allowed, currentCount, resetAt, retryAfterSeconds };
  } catch (err) {
    return failOpen(err instanceof Error ? err.message : String(err));
  }
}
