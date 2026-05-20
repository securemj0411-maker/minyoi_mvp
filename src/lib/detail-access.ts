import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/auth-users";
import { getUserCreditsReadOnly, spendUserCredits } from "@/lib/user-credits";
import { jsonBody, restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const FREE_DETAIL_ACCESS_LIMIT = 3;
const DETAIL_ACCESS_UNLOCK_WINDOW_SECONDS = 10 * 365 * 24 * 60 * 60;

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
      accessType: "admin" | "already_opened" | "free" | "credit";
      alreadyOpened: boolean;
      creditSpent: number;
      creditBalance: number | null;
      freeUsed: number;
      freeLimit: number;
    }
  | {
      ok: false;
      status: 402 | 500;
      error: "insufficient_credits" | "detail_access_failed";
      message: string;
      creditBalance: number;
      freeUsed: number;
      freeLimit: number;
    };

function detailAccessBucket(userRef: string, pid: number) {
  return `detail-access:${userRef}:${pid}`.slice(0, 200);
}

function freeDetailAccessBucket(userRef: string) {
  return `detail-access-free:${userRef}`.slice(0, 200);
}

async function loadRateLimitCount(bucketKey: string): Promise<number> {
  const rows = await restFetch(
    `${tableUrl("mvp_rate_limits")}?select=window_started_at,request_count&bucket_key=eq.${encodeURIComponent(bucketKey)}&limit=1`,
    { headers: serviceHeaders() },
  ).then((res) => res.json() as Promise<RateLimitRow[]>);
  const row = rows[0];
  return Math.max(0, Number(row?.request_count ?? 0));
}

async function markOpenedPid(bucketKey: string): Promise<{ firstOpen: boolean }> {
  const res = await restFetch(rpcUrl("check_mvp_rate_limit"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_bucket_key: bucketKey,
      p_max_requests: 1,
      p_window_seconds: DETAIL_ACCESS_UNLOCK_WINDOW_SECONDS,
    }),
  });
  const rows = (await res.json()) as RateLimitRpcRow[];
  const row = rows[0] ?? {};
  return {
    firstOpen: Boolean(row.allowed),
  };
}

async function forgetOpenedPid(bucketKey: string): Promise<void> {
  await restFetch(`${tableUrl("mvp_rate_limits")}?bucket_key=eq.${encodeURIComponent(bucketKey)}`, {
    method: "DELETE",
    headers: serviceHeaders(),
  });
}

async function consumeFreeDetailAccess(userRef: string): Promise<{ ok: boolean; used: number }> {
  const bucketKey = freeDetailAccessBucket(userRef);
  const used = await loadRateLimitCount(bucketKey);
  if (used >= FREE_DETAIL_ACCESS_LIMIT) {
    return { ok: false, used };
  }

  const res = await restFetch(rpcUrl("check_mvp_rate_limit"), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody({
      p_bucket_key: bucketKey,
      p_max_requests: FREE_DETAIL_ACCESS_LIMIT,
      p_window_seconds: DETAIL_ACCESS_UNLOCK_WINDOW_SECONDS,
    }),
  });
  const rows = (await res.json()) as RateLimitRpcRow[];
  const row = rows[0] ?? {};
  return {
    ok: Boolean(row.allowed),
    used: Math.max(0, Number(row.current_count ?? used)),
  };
}

async function readCreditBalance(user: User, userRef: string): Promise<number> {
  const credits = await getUserCreditsReadOnly(user, userRef);
  return Math.max(0, Number(credits?.tokens ?? 0));
}

export async function hasDetailAccess(input: {
  user: User;
  userRef: string;
  pid: number;
}): Promise<boolean> {
  if (isAdminUser(input.user)) return true;
  return (await loadRateLimitCount(detailAccessBucket(input.userRef, input.pid))) > 0;
}

export async function consumeDetailAccess(input: {
  user: User;
  userRef: string;
  pid: number;
}): Promise<DetailAccessResult> {
  const freeUsedBefore = await loadRateLimitCount(freeDetailAccessBucket(input.userRef));

  if (isAdminUser(input.user)) {
    return {
      ok: true,
      accessType: "admin",
      alreadyOpened: false,
      creditSpent: 0,
      creditBalance: null,
      freeUsed: freeUsedBefore,
      freeLimit: FREE_DETAIL_ACCESS_LIMIT,
    };
  }

  const bucketKey = detailAccessBucket(input.userRef, input.pid);
  if ((await loadRateLimitCount(bucketKey)) > 0) {
    const creditBalance = await readCreditBalance(input.user, input.userRef);
    return {
      ok: true,
      accessType: "already_opened",
      alreadyOpened: true,
      creditSpent: 0,
      creditBalance,
      freeUsed: freeUsedBefore,
      freeLimit: FREE_DETAIL_ACCESS_LIMIT,
    };
  }

  const mark = await markOpenedPid(bucketKey);
  if (!mark.firstOpen) {
    const creditBalance = await readCreditBalance(input.user, input.userRef);
    return {
      ok: true,
      accessType: "already_opened",
      alreadyOpened: true,
      creditSpent: 0,
      creditBalance,
      freeUsed: freeUsedBefore,
      freeLimit: FREE_DETAIL_ACCESS_LIMIT,
    };
  }

  try {
    const freeAccess = await consumeFreeDetailAccess(input.userRef);
    if (freeAccess.ok) {
      const creditBalance = await readCreditBalance(input.user, input.userRef);
      return {
        ok: true,
        accessType: "free",
        alreadyOpened: false,
        creditSpent: 0,
        creditBalance,
        freeUsed: freeAccess.used,
        freeLimit: FREE_DETAIL_ACCESS_LIMIT,
      };
    }

    const spend = await spendUserCredits({
      user: input.user,
      userRef: input.userRef,
      amount: 1,
      metadata: {
        source: "detail_access",
        pid: input.pid,
        free_detail_access_used: freeAccess.used,
        free_detail_access_limit: FREE_DETAIL_ACCESS_LIMIT,
      },
    });

    if (!spend.ok) {
      await forgetOpenedPid(bucketKey);
      return {
        ok: false,
        status: 402,
        error: "insufficient_credits",
        message: "크레딧이 부족해요. 충전하면 상세보기를 계속 열 수 있어요.",
        creditBalance: Math.max(0, Number(spend.tokens ?? 0)),
        freeUsed: freeAccess.used,
        freeLimit: FREE_DETAIL_ACCESS_LIMIT,
      };
    }

    return {
      ok: true,
      accessType: "credit",
      alreadyOpened: false,
      creditSpent: 1,
      creditBalance: spend.tokens,
      freeUsed: freeAccess.used,
      freeLimit: FREE_DETAIL_ACCESS_LIMIT,
    };
  } catch (err) {
    await forgetOpenedPid(bucketKey).catch(() => undefined);
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
      creditBalance: await readCreditBalance(input.user, input.userRef).catch(() => 0),
      freeUsed: freeUsedBefore,
      freeLimit: FREE_DETAIL_ACCESS_LIMIT,
    };
  }
}
