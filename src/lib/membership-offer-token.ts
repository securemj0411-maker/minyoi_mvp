import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";

function offerSecret(): string {
  const configured =
    process.env.ADMIN_ACTION_TOKEN_SECRET ??
    process.env.CRON_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? ""
    : "local-dev-membership-offer-token-secret";
}

function payload(parts: {
  authUserId: string;
  intent: string;
  baseProductKey: string;
  offerProductKey: string;
  expiresAt: string;
}) {
  return [
    TOKEN_VERSION,
    parts.authUserId,
    parts.intent,
    parts.baseProductKey,
    parts.offerProductKey,
    parts.expiresAt,
  ].join(":");
}

export function signMembershipOffer(parts: {
  authUserId: string;
  intent: string;
  baseProductKey: string;
  offerProductKey: string;
  expiresAt: string;
}) {
  const secret = offerSecret();
  if (!secret) return "";
  const signature = createHmac("sha256", secret)
    .update(payload(parts))
    .digest("base64url");
  return Buffer.from(JSON.stringify({ ...parts, signature })).toString(
    "base64url",
  );
}

export function verifyMembershipOfferToken(
  token: string | null | undefined,
  expected: {
    authUserId: string;
    intent: string;
    offerProductKey: string;
    allowedBaseProductKeys: string[];
  },
) {
  if (!token) return false;
  let decoded: {
    authUserId?: string;
    intent?: string;
    baseProductKey?: string;
    offerProductKey?: string;
    expiresAt?: string;
    signature?: string;
  };
  try {
    decoded = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (
    decoded.authUserId !== expected.authUserId ||
    decoded.intent !== expected.intent ||
    decoded.offerProductKey !== expected.offerProductKey ||
    !decoded.baseProductKey ||
    !expected.allowedBaseProductKeys.includes(decoded.baseProductKey) ||
    !decoded.expiresAt ||
    !decoded.signature
  ) {
    return false;
  }
  const expiresAtMs = Date.parse(decoded.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;
  const expectedToken = signMembershipOffer({
    authUserId: decoded.authUserId,
    intent: decoded.intent,
    baseProductKey: decoded.baseProductKey,
    offerProductKey: decoded.offerProductKey,
    expiresAt: decoded.expiresAt,
  });
  if (!expectedToken) return false;
  const expectedDecoded = JSON.parse(
    Buffer.from(expectedToken, "base64url").toString("utf8"),
  ) as { signature: string };
  const expectedBytes = Buffer.from(expectedDecoded.signature);
  const actualBytes = Buffer.from(decoded.signature);
  if (expectedBytes.length !== actualBytes.length) return false;
  return timingSafeEqual(expectedBytes, actualBytes);
}
