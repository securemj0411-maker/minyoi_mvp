// Wave 801 (2026-05-30): 텔레그램 inline button callback HMAC token.
//   admin-action-token 의 강화판 — expiry 시간 추가 (replay 방지).
//   text URL token 과 별개 (다른 secret + payload 구조).
//
// Payload: v1:<scope>:<id>:<decision>:<expSec>
// expSec = Unix epoch seconds (만료 시각).
// HMAC-SHA256(secret, payload) → base64url.
//
// Callback data 64 byte 한도 (텔레그램 사양):
//   "v1|md|<id>|approve|<expSec>|<sig8>" 식으로 짧게 박음.
//   sig8 = HMAC 전체 (43 char base64url) 의 앞 12 chars (96 bit, brute-force 안전 마진).
//
// 검증 시: 만료 검사 + scope/id/decision/expSec 재서명 + timing-safe compare.

import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramCallbackDecision = "approve" | "reject";
export type TelegramCallbackScope = "md"; // manual_deposit (확장 시 추가)

const TOKEN_VERSION = "v1";
const SIG_PREFIX_LEN = 12; // 96 bit — 텔레그램 callback 64 byte 한도 안에 박힘

function callbackSecret(): string {
  // 기존 ADMIN_ACTION_TOKEN_SECRET 재활용 가능 — 단 별도 박는 게 권장 (key 분리).
  const configured =
    process.env.TELEGRAM_CALLBACK_TOKEN_SECRET ??
    process.env.ADMIN_ACTION_TOKEN_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "" : "local-dev-telegram-callback-secret";
}

function payload(scope: TelegramCallbackScope, id: number, decision: TelegramCallbackDecision, expSec: number): string {
  return `${TOKEN_VERSION}:${scope}:${id}:${decision}:${expSec}`;
}

export function signTelegramCallback(
  scope: TelegramCallbackScope,
  id: number,
  decision: TelegramCallbackDecision,
  expSec: number,
): string {
  const secret = callbackSecret();
  if (!secret) return "";
  return createHmac("sha256", secret)
    .update(payload(scope, id, decision, expSec))
    .digest("base64url")
    .slice(0, SIG_PREFIX_LEN);
}

export function buildCallbackData(
  scope: TelegramCallbackScope,
  id: number,
  decision: TelegramCallbackDecision,
  ttlSec: number,
  nowSec: number,
): string {
  const expSec = nowSec + ttlSec;
  const sig = signTelegramCallback(scope, id, decision, expSec);
  return `${TOKEN_VERSION}|${scope}|${id}|${decision}|${expSec}|${sig}`;
}

export type ParsedCallback = {
  scope: TelegramCallbackScope;
  id: number;
  decision: TelegramCallbackDecision;
  expSec: number;
  sig: string;
};

export function parseCallbackData(data: string | undefined): ParsedCallback | null {
  if (!data) return null;
  const parts = data.split("|");
  if (parts.length !== 6) return null;
  const [version, scope, idRaw, decision, expRaw, sig] = parts;
  if (version !== TOKEN_VERSION) return null;
  if (scope !== "md") return null;
  if (decision !== "approve" && decision !== "reject") return null;
  const id = Number(idRaw);
  const expSec = Number(expRaw);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(expSec) || expSec <= 0) return null;
  return { scope: scope as TelegramCallbackScope, id, decision, expSec, sig };
}

export type VerifyResult = { ok: true } | { ok: false; reason: "expired" | "invalid_sig" | "invalid_payload" };

export function verifyTelegramCallback(parsed: ParsedCallback, nowSec: number): VerifyResult {
  if (parsed.expSec < nowSec) return { ok: false, reason: "expired" };
  const expected = signTelegramCallback(parsed.scope, parsed.id, parsed.decision, parsed.expSec);
  if (!expected) return { ok: false, reason: "invalid_payload" };
  const expectedBytes = Buffer.from(expected);
  const sigBytes = Buffer.from(parsed.sig);
  if (expectedBytes.length !== sigBytes.length) return { ok: false, reason: "invalid_sig" };
  if (!timingSafeEqual(expectedBytes, sigBytes)) return { ok: false, reason: "invalid_sig" };
  return { ok: true };
}
