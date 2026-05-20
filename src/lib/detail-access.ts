import type { User } from "@supabase/supabase-js";
import { consumeDailyQuota, getUserPlanState, refundDailyQuota } from "@/lib/user-plan";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const DETAIL_ACCESS_WINDOW_SECONDS = 24 * 60 * 60;

type RateLimitRow = {
  window_started_at?: string | null;
  request_count?: number | null;
};

type RateLimitRpcRow = {
  allowed?: boolean;
  current_count?: number;
  reset_at?: string;
};

export type DetailAccessResult =
  | {
      ok: true;
      planKey: string;
      dailyUsed: number;
      dailyLimit: number;
      alreadyOpened: boolean;
      resetAt: string | null;
    }
  | {
      ok: false;
      status: 402 | 429 | 500;
      error: "no_plan" | "daily_limit_reached" | "detail_access_failed";
      message: string;
      planKey: string;
      dailyUsed: number;
      dailyLimit: number;
      resetAt: string | null;
    };

function detailAccessBucket(userRef: string, pid: number) {
  return `detail-access:${userRef}:${pid}`.slice(0, 200);
}

function currentWindowStart(windowSeconds: number) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new Date(Math.floor(nowSeconds / windowSeconds) * windowSeconds * 1000);
}

function secondsUntilReset(windowSeconds: number) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(1, windowSeconds - (nowSeconds % windowSeconds));
}

async function hasOpenedPidToday(bucketKey: string): Promise<boolean> {
  const rows = await restFetch(
    `${tableUrl("mvp_rate_limits")}?select=window_started_at,request_count&bucket_key=eq.${encodeURIComponent(bucketKey)}&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<RateLimitRow[]>);
  const row = rows[0];
  if (!row) return false;
  const count = Math.max(0, Number(row.request_count ?? 0));
  if (count <= 0) return false;
  const started = row.window_started_at ? new Date(row.window_started_at).getTime() : NaN;
  return Number.isFinite(started) && started === currentWindowStart(DETAIL_ACCESS_WINDOW_SECONDS).getTime();
}

async function markOpenedPidToday(bucketKey: string): Promise<{ firstOpen: boolean; resetAt: string | null }> {
  const res = await restFetch(rpcUrl("check_mvp_rate_limit"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_bucket_key: bucketKey,
      p_max_requests: 1,
      p_window_seconds: DETAIL_ACCESS_WINDOW_SECONDS,
    }),
  });
  const rows = (await res.json()) as RateLimitRpcRow[];
  const row = rows[0] ?? {};
  return {
    firstOpen: Boolean(row.allowed),
    resetAt: row.reset_at ?? null,
  };
}

export async function consumeDetailAccess(input: {
  user: User;
  userRef: string;
  pid: number;
}): Promise<DetailAccessResult> {
  const state = await getUserPlanState(input.user, input.userRef);
  const dailyLimit = state.plan.dailyOpenLimit;
  const resetAt = new Date(Date.now() + secondsUntilReset(DETAIL_ACCESS_WINDOW_SECONDS) * 1000).toISOString();

  if (dailyLimit < 0) {
    return {
      ok: true,
      planKey: state.plan.key,
      dailyUsed: state.dailyUsed,
      dailyLimit,
      alreadyOpened: false,
      resetAt: null,
    };
  }

  const bucketKey = detailAccessBucket(input.userRef, input.pid);
  if (await hasOpenedPidToday(bucketKey)) {
    return {
      ok: true,
      planKey: state.plan.key,
      dailyUsed: state.dailyUsed,
      dailyLimit,
      alreadyOpened: true,
      resetAt,
    };
  }

  const consume = await consumeDailyQuota({
    user: input.user,
    userRef: input.userRef,
    limit: dailyLimit,
  });

  if (!consume.ok) {
    const noPlan = dailyLimit === 0 || consume.message === "no_plan";
    return {
      ok: false,
      status: noPlan ? 402 : 429,
      error: noPlan ? "no_plan" : "daily_limit_reached",
      message: noPlan
        ? "Plus 충전 후 상세보기를 열 수 있어요."
        : `오늘 무료 상세보기 ${consume.limit.toLocaleString("ko-KR")}회를 모두 사용했어요. Plus로 바로 더 볼 수 있어요.`,
      planKey: state.plan.key,
      dailyUsed: consume.used,
      dailyLimit: consume.limit,
      resetAt,
    };
  }

  try {
    const mark = await markOpenedPidToday(bucketKey);
    if (!mark.firstOpen) {
      await refundDailyQuota(input.user, input.userRef);
      return {
        ok: true,
        planKey: state.plan.key,
        dailyUsed: Math.max(0, consume.used - 1),
        dailyLimit: consume.limit,
        alreadyOpened: true,
        resetAt: mark.resetAt ?? resetAt,
      };
    }
    return {
      ok: true,
      planKey: state.plan.key,
      dailyUsed: consume.used,
      dailyLimit: consume.limit,
      alreadyOpened: false,
      resetAt: mark.resetAt ?? resetAt,
    };
  } catch (err) {
    await refundDailyQuota(input.user, input.userRef);
    console.error("[detail-access] mark failed", {
      err: err instanceof Error ? err.message : String(err),
      userRef: input.userRef,
      pid: input.pid,
    });
    return {
      ok: false,
      status: 500,
      error: "detail_access_failed",
      message: "상세보기 권한을 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
      planKey: state.plan.key,
      dailyUsed: Math.max(0, consume.used - 1),
      dailyLimit: consume.limit,
      resetAt,
    };
  }
}
