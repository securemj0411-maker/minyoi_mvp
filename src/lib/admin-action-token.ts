import { createHmac, timingSafeEqual } from "node:crypto";

export type AdminActionDecision = "approve" | "reject";
export type AdminActionScope = "manual_deposit" | "membership_application" | "feedback";

export const ADMIN_ACTION_HEADER = "x-minyoi-admin-action";
const TOKEN_VERSION = "v1";

function actionSecret(): string {
  const configured =
    process.env.ADMIN_ACTION_TOKEN_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "" : "local-dev-admin-action-token-secret";
}

function actionPayload(scope: AdminActionScope, id: number, decision: AdminActionDecision): string {
  return `${TOKEN_VERSION}:${scope}:${id}:${decision}`;
}

export function signAdminAction(scope: AdminActionScope, id: number, decision: AdminActionDecision): string {
  const secret = actionSecret();
  if (!secret) return "";
  return createHmac("sha256", secret)
    .update(actionPayload(scope, id, decision))
    .digest("base64url");
}

export function verifyAdminActionToken(
  scope: AdminActionScope,
  id: number,
  decision: AdminActionDecision,
  token: string | null,
): boolean {
  if (!token) return false;
  const expected = signAdminAction(scope, id, decision);
  if (!expected) return false;

  const expectedBytes = Buffer.from(expected);
  const tokenBytes = Buffer.from(token);
  if (expectedBytes.length !== tokenBytes.length) return false;
  return timingSafeEqual(expectedBytes, tokenBytes);
}

export function hasAdminActionHeader(headers: Headers): boolean {
  return headers.get(ADMIN_ACTION_HEADER) === "1";
}
