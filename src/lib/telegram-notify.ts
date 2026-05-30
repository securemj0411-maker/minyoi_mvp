// Wave launch-96 / launch-96b (사용자 정정 — env 이름 일치):
//   기존 운영자 알림 = TELEGRAM_BOT_TOKEN + TELEGRAM_ALERT_CHAT_ID (operational-notifier.ts 와 동일).
//   사용자가 이미 박아둔 @minyoi_alert_bot env 그대로 활용.
// Wave 801 (2026-05-30): inline keyboard / answerCallbackQuery / editMessageText 옵션 추가.
//   텔레그램 inline button 승인 flow 지원.

const TELEGRAM_TIMEOUT_MS = 5_000;

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};
export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

export type NotifyAdminOptions = {
  replyMarkup?: InlineKeyboardMarkup;
  /** 메시지 ID 반환 받기. inline 버튼 후 editMessageText 박으려면 필요. */
  returnMessageId?: boolean;
};

export type NotifyAdminResult = {
  ok: boolean;
  reason?: string;
  messageId?: number;
};

export async function notifyAdminTelegram(
  message: string,
  opts: NotifyAdminOptions = {},
): Promise<NotifyAdminResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram-notify] env missing — skip", { hasToken: Boolean(token), hasChatId: Boolean(chatId) });
    return { ok: false, reason: "env_missing" };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    };
    if (opts.replyMarkup) payload.reply_markup = opts.replyMarkup;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[telegram-notify] send failed", { status: res.status, body: body.slice(0, 200) });
      return { ok: false, reason: `http_${res.status}` };
    }
    if (opts.returnMessageId) {
      const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: { message_id?: number } } | null;
      const messageId = json?.result?.message_id;
      return { ok: true, messageId: typeof messageId === "number" ? messageId : undefined };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[telegram-notify] threw", err instanceof Error ? err.message : String(err));
    return { ok: false, reason: "threw" };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Wave 801: callback_query 응답 — 토스트 알림 박음 (텔레그램 사용자 화면).
export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
  showAlert = false,
): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "env_missing" };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Wave 801: 처리 완료 후 원본 메시지 edit (버튼 사라지게 + 결과 표시).
export async function editAdminMessageText(
  chatId: number,
  messageId: number,
  newText: string,
): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "env_missing" };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[telegram-notify] edit failed", { status: res.status, body: body.slice(0, 200) });
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeoutId);
  }
}
