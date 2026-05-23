// Wave launch-96: 운영자 텔레그램 알림 helper.
//   env: TELEGRAM_BOT_TOKEN (BotFather 발급) + TELEGRAM_ADMIN_CHAT_ID (운영자 chat).
//   둘 다 없으면 silent skip (개발 환경 / 미설정 운영 환경 안전).

const TELEGRAM_TIMEOUT_MS = 5_000;

export async function notifyAdminTelegram(message: string): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram-notify] env missing — skip", { hasToken: Boolean(token), hasChatId: Boolean(chatId) });
    return { ok: false, reason: "env_missing" };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[telegram-notify] send failed", { status: res.status, body: body.slice(0, 200) });
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[telegram-notify] threw", err instanceof Error ? err.message : String(err));
    return { ok: false, reason: "threw" };
  } finally {
    clearTimeout(timeoutId);
  }
}
