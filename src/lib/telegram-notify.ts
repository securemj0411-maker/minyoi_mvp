// Wave launch-96 / launch-96b (사용자 정정 — env 이름 일치):
//   기존 운영자 알림 = TELEGRAM_BOT_TOKEN + TELEGRAM_ALERT_CHAT_ID (operational-notifier.ts 와 동일).
//   사용자가 이미 박아둔 @minyoi_alert_bot env 그대로 활용.

const TELEGRAM_TIMEOUT_MS = 5_000;

export async function notifyAdminTelegram(message: string): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
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
