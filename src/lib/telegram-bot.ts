// Wave 93a: Telegram bot 연동 helper (사용자 핫딜 알림 전용).
// 기존 TELEGRAM_BOT_TOKEN은 운영자 알림용 — 충돌 방지를 위해 HOTDEAL_ prefix.
// 봇 토큰은 @BotFather에서 발급. webhook secret으로 위변조 방지.

const API_BASE = "https://api.telegram.org";

export type TelegramMessageOptions = {
  parseMode?: "MarkdownV2" | "HTML";
  disableWebPagePreview?: boolean;
  replyMarkup?: Record<string, unknown>;
};

export function getBotToken(): string | null {
  return process.env.HOTDEAL_TELEGRAM_BOT_TOKEN ?? null;
}

export function getBotUsername(): string | null {
  return process.env.HOTDEAL_TELEGRAM_BOT_USERNAME ?? null;
}

export function getWebhookSecret(): string | null {
  return process.env.HOTDEAL_TELEGRAM_WEBHOOK_SECRET ?? null;
}

// MarkdownV2 escape — 모든 특수문자 \\ 처리.
export function escapeMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, (c) => `\\${c}`);
}

export async function telegramApi(method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const token = getBotToken();
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN missing" };
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json().catch(() => ({ ok: false, description: "non-json response" }))) as {
    ok: boolean;
    result?: unknown;
    description?: string;
  };
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  opts: TelegramMessageOptions = {},
): Promise<{ ok: boolean; description?: string }> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: opts.disableWebPagePreview ?? true,
  };
  if (opts.parseMode) payload.parse_mode = opts.parseMode;
  if (opts.replyMarkup) payload.reply_markup = opts.replyMarkup;
  return telegramApi("sendMessage", payload);
}

export function buildVerifyDeepLink(code: string): string | null {
  const username = getBotUsername();
  if (!username) return null;
  const clean = username.replace(/^@/, "");
  return `https://t.me/${clean}?start=verify_${code}`;
}

export function generateVerifyCode(): string {
  // 6자리 영숫자 (사용자가 bot에 직접 입력 안 해도 deep link면 자동 처리되지만 안전망).
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
