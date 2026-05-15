// Wave 93a: Telegram bot webhook.
// 사용자가 deep link 클릭 → bot에서 /start verify_<CODE> 메시지 발송 → 여기로 들어옴.
// verify_code 매칭하면 chat_id 저장하고 사용자에게 환영 메시지.
//
// 보안: TELEGRAM_WEBHOOK_SECRET을 path parameter나 X-Telegram-Bot-Api-Secret-Token header로 검증.
// setWebhook 시 secret_token 등록 → bot이 알림마다 X-Telegram-Bot-Api-Secret-Token header 박음.

import { NextResponse } from "next/server";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { escapeMd, getWebhookSecret, sendTelegramMessage } from "@/lib/telegram-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    data?: string;
    message?: { chat: { id: number } };
  };
};

function verifySecret(req: Request): boolean {
  const expected = getWebhookSecret();
  if (!expected) return true; // dev: secret 없으면 통과 (운영 시 반드시 설정)
  return req.headers.get("x-telegram-bot-api-secret-token") === expected;
}

export async function POST(req: Request) {
  if (!verifySecret(req)) return NextResponse.json({ ok: false }, { status: 401 });

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const message = update.message;
  if (message?.text) {
    const text = message.text.trim();
    const chatId = message.chat.id;
    const telegramUserId = message.from?.id ?? null;
    const username = message.from?.username ?? null;

    // /start verify_<code> handler.
    const startMatch = text.match(/^\/start\s+verify_([A-Z0-9]{6})$/i);
    if (startMatch) {
      const code = startMatch[1].toUpperCase();
      await handleVerify(code, chatId, telegramUserId, username);
      return NextResponse.json({ ok: true });
    }

    if (/^\/start\b/.test(text)) {
      await sendTelegramMessage(chatId, "안녕하세요! 미뇨이 핫딜 알림 봇입니다.\n\n/me 대시보드에서 '🔥 핫딜 알림' 메뉴로 들어가 연결 코드를 받으세요.");
      return NextResponse.json({ ok: true });
    }

    if (/^\/(stop|pause)\b/.test(text)) {
      await pauseByChat(chatId, true);
      await sendTelegramMessage(chatId, "알림을 일시 중지했어요. 다시 받으려면 /resume.");
      return NextResponse.json({ ok: true });
    }

    if (/^\/resume\b/.test(text)) {
      await pauseByChat(chatId, false);
      await sendTelegramMessage(chatId, "알림을 다시 켰어요.");
      return NextResponse.json({ ok: true });
    }

    if (/^\/help\b/.test(text)) {
      await sendTelegramMessage(chatId, "명령어:\n/start \\- 봇 시작\n/pause \\- 알림 끔\n/resume \\- 알림 켬\n/help \\- 도움말", { parseMode: "MarkdownV2" });
      return NextResponse.json({ ok: true });
    }
  }

  // callback_query (inline button) — 다음 wave에서 활용.
  return NextResponse.json({ ok: true });
}

async function handleVerify(code: string, chatId: number, telegramUserId: number | null, username: string | null) {
  const now = new Date().toISOString();

  // 1. verify_code 매칭 row 찾기 (만료 전).
  const codeRes = await restFetch(
    `${tableUrl("mvp_telegram_bindings")}?select=user_ref&verify_code=eq.${encodeURIComponent(code)}&verify_code_expires_at=gte.${encodeURIComponent(now)}&limit=1`,
    { headers: serviceHeaders() },
  );
  const codeRows = (await codeRes.json().catch(() => [])) as Array<{ user_ref: string }>;
  const targetUserRef = codeRows[0]?.user_ref;
  if (!targetUserRef) {
    await sendTelegramMessage(chatId, "❌ 연결 코드가 만료되었거나 잘못됐어요.\n\n/me 대시보드에서 새 코드를 받아주세요.");
    return;
  }

  // 2. 어뷰즈 방어: 같은 chat_id 또는 telegram_user_id가 다른 user_ref에 이미 매핑돼있으면 거절.
  // (한 텔레그램 계정 = 한 미뇨이 계정. 가중치 어뷰즈 방지.)
  const dupParts: string[] = [`chat_id.eq.${chatId}`];
  if (telegramUserId !== null) dupParts.push(`telegram_user_id.eq.${telegramUserId}`);
  const dupRes = await restFetch(
    `${tableUrl("mvp_telegram_bindings")}?select=user_ref&or=(${dupParts.join(",")})&user_ref=neq.${encodeURIComponent(targetUserRef)}&limit=1`,
    { headers: serviceHeaders() },
  );
  const dupRows = (await dupRes.json().catch(() => [])) as Array<{ user_ref: string }>;
  if (dupRows.length > 0) {
    await sendTelegramMessage(
      chatId,
      "❌ 이 텔레그램 계정은 이미 다른 미뇨이 계정에 연결되어 있어요.\n\n먼저 그쪽 계정의 /me → 핫딜 알림에서 '연결 해제'를 눌러주세요.",
    );
    return;
  }

  // 3. PATCH로 chat_id, telegram_user_id 저장. UNIQUE 제약 위반 시 409로 떨어짐 (race condition 안전망).
  const patchRes = await restFetch(
    `${tableUrl("mvp_telegram_bindings")}?user_ref=eq.${encodeURIComponent(targetUserRef)}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({
        chat_id: chatId,
        telegram_user_id: telegramUserId,
        telegram_username: username,
        verified_at: now,
        verify_code: null,
        verify_code_expires_at: null,
        updated_at: now,
      }),
    },
  );
  if (!patchRes.ok) {
    await sendTelegramMessage(chatId, "❌ 연결 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    return;
  }
  await sendTelegramMessage(
    chatId,
    `✅ 연결 완료\\!\n\n앞으로 핫딜 매물이 나오면 여기로 알림이 와요\\. \n알림 받으면 정해진 시간 내에 미뇨이에서 매물을 확인하세요\\.\n\n중지: /pause`,
    { parseMode: "MarkdownV2" },
  );
}

async function pauseByChat(chatId: number, paused: boolean) {
  const now = new Date().toISOString();
  await restFetch(
    `${tableUrl("mvp_telegram_bindings")}?chat_id=eq.${chatId}`,
    {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ paused, updated_at: now }),
    },
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "telegram webhook (POST only)" });
}
