// Wave 1228: 선공개 300명 선착순 슬롯 — 시간 램프 기반 합성 희소성 카운터.
//   실 가입수가 아니라 의도된 FOMO(START→TARGET 램프 + wobble). /plans 신청 페이지가 쓰던 로직.
//   비회원 메인 랜딩도 동일 숫자를 쓰도록 단일 소스로 추출(드리프트 방지).

export const SLOT_CAPACITY = 300;
const SLOT_START_FILLED = 172;
const SLOT_TARGET_FILLED = 230;
const SLOT_RAMP_START_MS = Date.parse("2026-06-04T15:00:00.000Z");
const SLOT_RAMP_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const SLOT_WOBBLE_PATTERN = [0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0];

export type SlotSnapshot = {
  capacity: number;
  filled: number;
};

export function loadSlotSnapshot(now = Date.now()): SlotSnapshot {
  const elapsedMs = Math.max(0, now - SLOT_RAMP_START_MS);
  const progress = Math.min(1, elapsedMs / SLOT_RAMP_DURATION_MS);
  const baseFilled = Math.floor(
    SLOT_START_FILLED + (SLOT_TARGET_FILLED - SLOT_START_FILLED) * progress,
  );
  const bucket = Math.floor(elapsedMs / (6 * 60 * 60 * 1000));
  const wobble =
    progress >= 1
      ? 0
      : (SLOT_WOBBLE_PATTERN[bucket % SLOT_WOBBLE_PATTERN.length] ?? 0);
  const filled = Math.max(
    SLOT_START_FILLED,
    Math.min(SLOT_TARGET_FILLED, baseFilled + wobble),
  );

  return {
    capacity: SLOT_CAPACITY,
    filled,
  };
}
