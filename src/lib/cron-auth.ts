import type { NextRequest } from "next/server";

type CronAuthResult = {
  authOk: boolean;
  authReason:
    | "authorized"
    | "dev_not_configured"
    | "missing_cron_secret"
    | "missing_authorization"
    | "invalid_bearer";
};

function bearerCandidates(secret: string): Set<string> {
  const trimmed = secret.trim();
  const withoutBearer = trimmed.replace(/^Bearer\s+/i, "").trim();
  const candidates = new Set<string>();

  if (trimmed) {
    candidates.add(trimmed.toLowerCase().startsWith("bearer ") ? trimmed : `Bearer ${trimmed}`);
    candidates.add(`Bearer ${trimmed}`);
  }
  if (withoutBearer) {
    candidates.add(`Bearer ${withoutBearer}`);
  }

  return candidates;
}

export function checkCronAuth(req: NextRequest): CronAuthResult {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    const allowDevNoSecret =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_UNAUTHENTICATED_CRON === "1";
    return allowDevNoSecret
      ? { authOk: true, authReason: "dev_not_configured" }
      : { authOk: false, authReason: "missing_cron_secret" };
  }

  const auth = req.headers.get("authorization");
  if (!auth) return { authOk: false, authReason: "missing_authorization" };

  const authOk = bearerCandidates(secret).has(auth.trim());
  return {
    authOk,
    authReason: authOk ? "authorized" : "invalid_bearer",
  };
}
