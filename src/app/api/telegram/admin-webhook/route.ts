// Wave 801 (2026-05-30): 운영자 텔레그램 봇 webhook — inline button 승인/거절 처리.
//
// Flow:
//   1. 입금 신청 (manual-deposit/route.ts) → notifyAdminTelegram + inline_keyboard 박음
//   2. 운영자가 봇 메시지에서 [✅ 승인] / [❌ 거절] 누름
//   3. 텔레그램 → 이 endpoint 로 callback_query 보냄
//   4. 4 layer 검증:
//      L1. X-Telegram-Bot-Api-Secret-Token header == ADMIN_TELEGRAM_WEBHOOK_SECRET
//      L2. callback_query.from.id == ADMIN_TELEGRAM_USER_ID
//      L3. HMAC + expiry 검증 (verifyTelegramCallback)
//      L4. DB status == "pending" (double-click / replay 방지)
//   5. 통과 시 grantManualDeposit / rejectManualDeposit 호출
//   6. answerCallbackQuery (운영자 토스트) + editMessageText (메시지 갱신)
//
// 운영자가 박을 env:
//   ADMIN_TELEGRAM_WEBHOOK_SECRET = 임의 strong secret (16+ char)
//   ADMIN_TELEGRAM_USER_ID = 운영자 텔레그램 user.id (숫자)
//   TELEGRAM_CALLBACK_TOKEN_SECRET = HMAC key (별도 권장, fallback 으로 ADMIN_ACTION_TOKEN_SECRET 사용)
//
// setWebhook 한 번:
//   POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
//   {url: "https://minyoi-mvp.vercel.app/api/telegram/admin-webhook",
//    secret_token: "<ADMIN_TELEGRAM_WEBHOOK_SECRET>",
//    allowed_updates: ["callback_query"]}

import { NextResponse } from "next/server";

import { grantManualDeposit, rejectManualDeposit, type ManualDepositRequest } from "@/lib/manual-deposit-grant";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { answerCallbackQuery, editAdminMessageText } from "@/lib/telegram-notify";
import { parseCallbackData, verifyTelegramCallback } from "@/lib/telegram-callback-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CallbackQuery = {
  id: string;
  from: { id: number; username?: string; first_name?: string };
  data?: string;
  message?: { chat: { id: number }; message_id: number; text?: string };
};

type TelegramUpdate = {
  update_id: number;
  callback_query?: CallbackQuery;
};

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function verifySecret(req: Request): boolean {
  const expected = process.env.ADMIN_TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error("[admin-webhook] ADMIN_TELEGRAM_WEBHOOK_SECRET missing in production — reject");
      return false;
    }
    return true; // dev only
  }
  return req.headers.get("x-telegram-bot-api-secret-token") === expected;
}

function verifyAdminUserId(callback: CallbackQuery): boolean {
  const expectedRaw = process.env.ADMIN_TELEGRAM_USER_ID;
  if (!expectedRaw) {
    if (process.env.NODE_ENV === "production") {
      console.error("[admin-webhook] ADMIN_TELEGRAM_USER_ID missing in production — reject");
      return false;
    }
    return true; // dev only
  }
  const expected = Number(expectedRaw);
  if (!Number.isFinite(expected)) return false;
  return callback.from.id === expected;
}

async function fetchRequest(id: number): Promise<ManualDepositRequest | null> {
  const res = await restFetch(
    `${tableUrl("mvp_manual_deposit_requests")}?select=*&id=eq.${id}&limit=1`,
    { headers: serviceHeaders() },
  );
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => [])) as ManualDepositRequest[];
  return rows[0] ?? null;
}

export async function POST(req: Request) {
  if (!verifySecret(req)) {
    return NextResponse.json({ ok: false, error: "secret_invalid" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const callback = update.callback_query;
  if (!callback) {
    // message / 기타 update 는 noop (운영자 봇 = inline button 전용).
    return NextResponse.json({ ok: true });
  }

  // L2: admin user id 매칭
  if (!verifyAdminUserId(callback)) {
    console.warn("[admin-webhook] non-admin callback rejected", { from: callback.from.id });
    await answerCallbackQuery(callback.id, "❌ 권한 없음", true).catch(() => {});
    return NextResponse.json({ ok: false, error: "not_admin" }, { status: 403 });
  }

  // L3: HMAC + expiry
  const parsed = parseCallbackData(callback.data);
  if (!parsed) {
    await answerCallbackQuery(callback.id, "❌ 잘못된 버튼", true).catch(() => {});
    return NextResponse.json({ ok: false, error: "invalid_callback_data" }, { status: 400 });
  }
  const verdict = verifyTelegramCallback(parsed, nowSec());
  if (!verdict.ok) {
    const reasonText = verdict.reason === "expired" ? "❌ 만료된 버튼 (관리자 페이지에서 처리해주세요)" : "❌ 보안 검증 실패";
    await answerCallbackQuery(callback.id, reasonText, true).catch(() => {});
    return NextResponse.json({ ok: false, error: verdict.reason }, { status: 403 });
  }

  // L4: DB status == "pending"
  const request = await fetchRequest(parsed.id);
  if (!request) {
    await answerCallbackQuery(callback.id, `❌ 신청 #${parsed.id} 없음`, true).catch(() => {});
    return NextResponse.json({ ok: false, error: "not_found" });
  }
  if (request.status !== "pending") {
    await answerCallbackQuery(callback.id, `이미 처리됨 (${request.status})`, true).catch(() => {});
    if (callback.message) {
      await editAdminMessageText(
        callback.message.chat.id,
        callback.message.message_id,
        `${callback.message.text ?? ""}\n\n_(이미 ${request.status} 처리됨)_`,
      ).catch(() => {});
    }
    return NextResponse.json({ ok: true, alreadyHandled: true });
  }

  await answerCallbackQuery(callback.id, "크레딧 수동입금 처리는 종료됐어요.", true).catch(() => {});
  if (callback.message) {
    await editAdminMessageText(
      callback.message.chat.id,
      callback.message.message_id,
      `${callback.message.text ?? ""}\n\n_레거시 크레딧 수동입금 버튼은 비활성화됐어요. 멤버십 승인 메뉴를 이용해주세요._`,
    ).catch(() => {});
  }
  return NextResponse.json({
    ok: false,
    error: "legacy_credit_manual_deposit_disabled",
  }, { status: 410 });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "admin telegram webhook (POST only)" });
}
