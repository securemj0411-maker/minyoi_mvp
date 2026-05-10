export type OperationalAlert = {
  key: string;
  severity: "critical" | "warning";
  mode: string;
  label: string;
  message: string;
  total: number;
  failed: number;
  failureRate: number;
};

type NotifyContext = {
  source: string;
  status: "healthy" | "degraded" | "unhealthy";
  previousStatus: "healthy" | "degraded" | "unhealthy" | null;
  reason: string;
  checkedAt: string;
  previousAlerts: OperationalAlert[];
  alerts: OperationalAlert[];
};

type NotifyResult = {
  enabled: boolean;
  sent: boolean;
  reason: string;
  event: "new_alert" | "recovered" | "none";
};

function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) return null;
  return { token, chatId };
}

function alertKeys(alerts: OperationalAlert[]) {
  return new Set(alerts.map((alert) => alert.key));
}

function newAlerts(previous: OperationalAlert[], current: OperationalAlert[]) {
  const previousKeys = alertKeys(previous);
  return current.filter((alert) => !previousKeys.has(alert.key));
}

function kstTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatAlertLine(alert: OperationalAlert) {
  const severity = alert.severity === "critical" ? "긴급" : "경고";
  return `- ${severity} ${alert.label}: ${Math.round(alert.failureRate * 100)}% 실패 (${alert.failed}/${alert.total})`;
}

function buildMessage(context: NotifyContext, event: NotifyResult["event"], alertsToSend: OperationalAlert[]) {
  if (event === "recovered") {
    return [
      "[미뇨이] 운영 알림 회복",
      `source: ${context.source}`,
      `status: ${context.previousStatus ?? "-"} -> ${context.status}`,
      `reason: ${context.reason}`,
      `checked: ${kstTime(context.checkedAt)}`,
    ].join("\n");
  }

  return [
    "[미뇨이] 운영 알림",
    `source: ${context.source}`,
    `status: ${context.previousStatus ?? "-"} -> ${context.status}`,
    `reason: ${context.reason}`,
    `checked: ${kstTime(context.checkedAt)}`,
    "",
    ...alertsToSend.map(formatAlertLine),
  ].join("\n");
}

async function sendTelegramMessage(message: string): Promise<Omit<NotifyResult, "event">> {
  const config = telegramConfig();
  if (!config) {
    return { enabled: false, sent: false, reason: "telegram_env_missing" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      return { enabled: true, sent: false, reason: `telegram_${res.status}` };
    }
    return { enabled: true, sent: true, reason: "sent" };
  } catch (err) {
    return {
      enabled: true,
      sent: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function notifyOperationalAlerts(context: NotifyContext): Promise<NotifyResult> {
  const freshAlerts = newAlerts(context.previousAlerts, context.alerts);
  const recovered = context.previousAlerts.length > 0 && context.alerts.length === 0;
  const event: NotifyResult["event"] = recovered ? "recovered" : freshAlerts.length > 0 ? "new_alert" : "none";
  if (event === "none") {
    const config = telegramConfig();
    return { enabled: Boolean(config), sent: false, reason: config ? "no_new_alert" : "telegram_env_missing", event };
  }

  const message = buildMessage(context, event, recovered ? [] : freshAlerts);
  const result = await sendTelegramMessage(message);
  return { ...result, event };
}

export async function sendOperationalTestAlert() {
  const message = [
    "[미뇨이] 운영 알림 테스트",
    "Telegram 연결이 정상입니다.",
    `checked: ${kstTime(new Date().toISOString())}`,
  ].join("\n");
  return sendTelegramMessage(message);
}
