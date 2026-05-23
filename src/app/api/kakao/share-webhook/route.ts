// Wave 734 (2026-05-24): 카카오톡 공유 webhook — 친구에게 메시지 성공 전달 시 카카오가 호출.
//   Kakao Developers Console → 앱 → 웹훅 → 카카오톡 공유 웹훅 → 등록 (GET / URL).
//   serverCallbackArgs 는 코드에서 박음 (별도 Console 등록 불필요).
//
// Wave 735 (2026-05-24): 공식 docs 기반 보강.
//   - GET + POST 둘 다 handle (Kakao 가 둘 다 지원)
//   - Authorization header 검증 (admin key — KAKAO_ADMIN_KEY env)
//   - CHAT_TYPE === "MemoChat" 차단 (본인 나에게 보내기 — 매크로 방어)
//   - 3초 이내 200 응답 보장
//
// Kakao 가 webhook 에 보내는 payload (GET = query, POST = JSON body):
//   - CHAT_TYPE: "MemoChat" | "DirectChat" | "MultiChat" | "OpenDirectChat" | "OpenMultiChat"
//   - HASH_CHAT_ID: 채팅방 hash
//   - TEMPLATE_ID: 메시지 템플릿 ID (사용 시)
//   - <serverCallbackArgs keys>: 우리가 박은 user_id
//
// 매크로 차단 layer:
//   1. CHAT_TYPE === "MemoChat" → 차단 (본인 셀프 메시지 X)
//   2. 24h cooldown (last_share_bonus_at)
//   3. Authorization header (admin key) 검증 — 위조 webhook 차단

import { NextRequest, NextResponse } from "next/server";
import { restFetch, jsonBody, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Wave 735: 3초 이내 응답 — Vercel default 10s 충분. maxDuration 5s 명시.
export const maxDuration = 5;

const COOLDOWN_HOURS = 24;
// Wave 736 (2026-05-24 사용자 정정): 정책 = 카톡 공유 후 친구 도달 시 3 크레딧 (1 아님).
//   기존 share-bonus 의 BONUS_AMOUNT=1 도 같이 정정.
const BONUS_AMOUNT = 3;

type CreditsRow = {
  user_ref: string;
  balance: number;
  last_share_bonus_at: string | null;
};

type WebhookPayload = {
  user_id?: string;
  CHAT_TYPE?: string;
  HASH_CHAT_ID?: string;
  TEMPLATE_ID?: string;
};

/**
 * GET + POST 공통 처리.
 */
async function handleWebhook(req: NextRequest, payload: WebhookPayload): Promise<NextResponse> {
  const userId = payload.user_id ?? null;
  const chatType = payload.CHAT_TYPE ?? null;
  const hashChatId = payload.HASH_CHAT_ID ?? null;

  console.log("[kakao-share-webhook] received", {
    userId,
    chatType,
    hashChatId,
    method: req.method,
    authHeader: req.headers.get("authorization")?.slice(0, 20) ?? null,
    userAgent: req.headers.get("user-agent"),
  });

  // 1. Authorization 검증 (admin key 있을 때만 — env 없으면 skip)
  const adminKey = process.env.KAKAO_ADMIN_KEY;
  if (adminKey) {
    const authHeader = req.headers.get("authorization") ?? "";
    const expected = `KakaoAK ${adminKey}`;
    if (authHeader !== expected) {
      console.warn("[kakao-share-webhook] auth mismatch", {
        gotPrefix: authHeader.slice(0, 20),
      });
      // 200 반환 — 카카오가 retry 안 하게. 단 보상 X.
      return NextResponse.json({ ok: false, error: "auth_failed" });
    }
  }

  // 2. user_id 없으면 차단
  if (!userId) {
    console.warn("[kakao-share-webhook] no user_id in args");
    return NextResponse.json({ ok: false, error: "no_user_id" });
  }

  // 3. MemoChat 차단 — 본인 나에게 보내기는 매크로 risk
  if (chatType === "MemoChat") {
    console.log("[kakao-share-webhook] MemoChat skipped (self-share)", { userId });
    return NextResponse.json({ ok: false, error: "memo_chat_excluded" });
  }

  // 4. 24h cooldown + 보상 지급
  try {
    const headers = serviceHeaders();
    const res = await restFetch(
      `${tableUrl("mvp_user_credits")}?select=user_ref,balance,last_share_bonus_at&auth_user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers },
    );
    if (!res.ok) {
      console.error("[kakao-share-webhook] user fetch failed", { status: res.status });
      return NextResponse.json({ ok: false, error: "user_fetch_failed" });
    }
    const rows = (await res.json()) as CreditsRow[];
    const current = rows[0];
    if (!current) {
      console.warn("[kakao-share-webhook] user not found", { userId });
      return NextResponse.json({ ok: false, error: "user_not_found" });
    }

    if (current.last_share_bonus_at) {
      const last = Date.parse(current.last_share_bonus_at);
      const hoursSince = (Date.now() - last) / (60 * 60 * 1000);
      if (Number.isFinite(hoursSince) && hoursSince < COOLDOWN_HOURS) {
        console.log("[kakao-share-webhook] cooldown skipped", {
          userId,
          hoursSince: hoursSince.toFixed(1),
        });
        return NextResponse.json({ ok: false, error: "cooldown" });
      }
    }

    const newBalance = current.balance + BONUS_AMOUNT;
    const now = new Date().toISOString();

    const upsertRes = await restFetch(
      `${tableUrl("mvp_user_credits")}?user_ref=eq.${encodeURIComponent(current.user_ref)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: jsonBody({
          balance: newBalance,
          last_share_bonus_at: now,
          updated_at: now,
        }),
      },
    );
    if (!upsertRes.ok) {
      console.error("[kakao-share-webhook] credit update failed", { status: upsertRes.status });
      return NextResponse.json({ ok: false, error: "update_failed" });
    }

    // ledger 기록 (audit)
    try {
      await restFetch(`${tableUrl("mvp_credit_ledger")}`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: jsonBody([{
          user_ref: current.user_ref,
          auth_user_id: userId,
          event_type: "kakao_share_webhook",
          amount: BONUS_AMOUNT,
          balance_after: newBalance,
          metadata: {
            source: "kakao_webhook",
            chat_type: chatType,
            hash_chat_id: hashChatId,
          },
          created_at: now,
        }]),
      });
    } catch (err) {
      console.warn("[kakao-share-webhook] ledger insert threw", err instanceof Error ? err.message : String(err));
    }

    console.log("[kakao-share-webhook] bonus granted", {
      userId,
      chatType,
      newBalance,
      previousBalance: current.balance,
    });
    return NextResponse.json({ ok: true, balance: newBalance });
  } catch (err) {
    console.error("[kakao-share-webhook] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, error: "internal_error" });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const payload: WebhookPayload = {
    user_id: url.searchParams.get("user_id") ?? undefined,
    CHAT_TYPE: url.searchParams.get("CHAT_TYPE") ?? undefined,
    HASH_CHAT_ID: url.searchParams.get("HASH_CHAT_ID") ?? undefined,
    TEMPLATE_ID: url.searchParams.get("TEMPLATE_ID") ?? undefined,
  };
  return handleWebhook(req, payload);
}

export async function POST(req: NextRequest) {
  let body: WebhookPayload = {};
  try {
    body = await req.json();
  } catch {
    // body 없거나 invalid — 빈 객체
  }
  return handleWebhook(req, body);
}
