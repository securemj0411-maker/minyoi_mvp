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
import { restFetch, jsonBody, rpcUrl, serviceHeaders } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Wave 735: 3초 이내 응답 — Vercel default 10s 충분. maxDuration 5s 명시.
export const maxDuration = 5;

const COOLDOWN_HOURS = 24;
// Wave 736 (2026-05-24 사용자 정정): 정책 = 카톡 공유 후 친구 도달 시 보상.
// Wave 765c (2026-05-26 사용자 BM 결정): 3 → 2 — 균형 (인센티브 + BM 안전).
//   가격: 1크레딧 ≈ 495원 (popular 기준). 2크레딧 = 990원. 30일 max = 29,700원/유저.
const BONUS_AMOUNT = 2;

type ClaimShareBonusRow = {
  ok: boolean;
  granted: boolean;
  user_ref: string | null;
  balance: number | null;
  error: string | null;
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

  // 1. Authorization 검증. production 에서 admin key 가 없으면 보상 지급 자체를 막는다.
  const adminKey = process.env.KAKAO_ADMIN_KEY;
  if (!adminKey && process.env.NODE_ENV === "production") {
    console.error("[kakao-share-webhook] KAKAO_ADMIN_KEY missing in production");
    return NextResponse.json({ ok: false, error: "auth_unconfigured" });
  }
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

  // 4. 24h cooldown + 보상 지급 (DB RPC 안에서 원자 처리)
  try {
    const headers = serviceHeaders();
    const claimRes = await restFetch(
      rpcUrl("claim_mvp_kakao_share_bonus"),
      {
        method: "POST",
        headers,
        body: jsonBody({
          p_auth_user_id: userId,
          p_amount: BONUS_AMOUNT,
          p_chat_type: chatType,
          p_hash_chat_id: hashChatId,
          p_cooldown_hours: COOLDOWN_HOURS,
        }),
      },
    );
    if (!claimRes.ok) {
      const text = await claimRes.text().catch(() => "");
      console.error("[kakao-share-webhook] claim rpc failed", { status: claimRes.status, body: text.slice(0, 200) });
      return NextResponse.json({ ok: false, error: "claim_failed" });
    }
    const rows = (await claimRes.json()) as ClaimShareBonusRow[];
    const claim = rows[0];

    if (!claim?.ok || !claim.granted) {
      if (claim?.error === "cooldown") {
        console.log("[kakao-share-webhook] cooldown skipped", {
          userId,
          lastShareBonusAt: claim.last_share_bonus_at,
        });
      } else {
        console.warn("[kakao-share-webhook] claim skipped", { userId, error: claim?.error ?? "empty_response" });
      }
      return NextResponse.json({ ok: false, error: claim?.error ?? "claim_skipped" });
    }

    console.log("[kakao-share-webhook] bonus granted", {
      userId,
      chatType,
      newBalance: claim.balance,
      userRef: claim.user_ref,
    });
    return NextResponse.json({ ok: true, balance: claim.balance });
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
