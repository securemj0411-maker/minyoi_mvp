// Compliance Wave 2: seller_uid를 SHA-256 hash로 변환해 저장한다.
// 원본 raw uid는 개인 식별 가능 정보 (개보법 적용 범위) — DB 영구 보유 시 위험.
// dedup 동작은 보존 (같은 raw uid → 같은 hash → 같은 dedup key).
// salt 미사용 — 일관성/멱등성/back-fill atomic 보장 우선.
//
// 접두어 `sha256:`는 (1) 이미 hash된 값 재hash 방지 (idempotent),
// (2) 향후 algorithm 교체 시 식별 prefix로 활용.

import { createHash } from "node:crypto";

export const SELLER_UID_HASH_PREFIX = "sha256:";

export function hashSellerUid(rawUid: string | null | undefined): string | null {
  if (rawUid == null) return null;
  const trimmed = String(rawUid).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(SELLER_UID_HASH_PREFIX)) return trimmed;
  const digest = createHash("sha256").update(trimmed).digest("hex");
  return `${SELLER_UID_HASH_PREFIX}${digest}`;
}
