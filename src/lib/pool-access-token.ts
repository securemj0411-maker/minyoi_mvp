import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const TOKEN_VERSION = 1;

function base64url(buf: Buffer) {
  return buf.toString("base64url");
}

function tokenSecret() {
  const secret =
    process.env.POOL_ACCESS_TOKEN_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("POOL_ACCESS_TOKEN_SECRET is required in production");
    }
    return "local-dev-pool-access-token-secret";
  }
  return secret;
}

function key() {
  return createHash("sha256").update(tokenSecret()).digest();
}

export function createPoolAccessToken(pid: number) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const payload = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, pid, iat: Date.now() }), "utf8");
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [base64url(iv), base64url(tag), base64url(encrypted)].join(".");
}

export function decodePoolAccessToken(token: string): number | null {
  try {
    const [ivRaw, tagRaw, encryptedRaw] = token.split(".");
    if (!ivRaw || !tagRaw || !encryptedRaw) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as { v?: number; pid?: number };
    const pid = Number(parsed.pid);
    if (parsed.v !== TOKEN_VERSION || !Number.isFinite(pid) || pid <= 0) return null;
    return pid;
  } catch {
    return null;
  }
}

export function syntheticPidForPoolToken(token: string) {
  const hash = createHash("sha256").update(token).digest();
  return (hash.readUInt32BE(0) % 2_000_000_000) + 1;
}
