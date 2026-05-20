export const PORTONE_STORE_ID =
  process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "store-670b9708-35fd-4e46-9cd0-48b5c0e56f6a";

export const PORTONE_CHANNEL_KEY =
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? "channel-key-69134205-c63b-46d9-b389-aff785c8dfe3";

export function createPortOnePaymentId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 14)
      : Math.random().toString(36).slice(2, 16);
  return `mnyo${Date.now().toString(36)}${random}`.slice(0, 40);
}
