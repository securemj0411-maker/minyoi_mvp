# Wave 485 — Gucci broad residual splits

## Context

Wave 484 이후 active fashion current-diff 상위에 `bag-gucci-broad` 잔여가 남았다.
샘플은 `GG Marmont`, `Ophidia top handle`, `Ophidia tote` 계열이었다.

## Decisions

- `bag-gucci-gg-marmont-small-shoulder` 를 추가했다.
  - 단, `스몰`/`small`/`443497` 같은 명시 신호를 요구한다.
  - `버킷백`, `토트`, `카메라`, `미니`, `지갑`, `탑핸들` 등은 차단했다.
  - `구찌 마몽 버킷백 핑크`, `구찌 마몽 GG 마틀라세 벨벳 퍼플 크로스백 숄더백` 처럼 스몰 신호가 없거나 다른 형태인 샘플은 narrow lane으로 승격하지 않았다.
- `bag-gucci-ophidia-top-handle` 와 `bag-gucci-ophidia-tote` 를 추가했다.
  - 오피디아 탑핸들/토트는 서로 `mustNotContain` 으로 분리했다.
- DB는 안전한 6건만 재분류하고 `score_dirty=true` 로 마킹했다.
  - `bag-gucci-gg-marmont-small-shoulder`: `294655201`, `395133648`, `409186808`, `409187080`
  - `bag-gucci-ophidia-top-handle`: `399395654`
  - `bag-gucci-ophidia-tote`: `400392299`

## Verification

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` — pass 184/184
- `npx tsx --test tests/core-rules.test.ts` — pass 101/101
- Active `bag-gucci-*` DB row recheck: 165 rows, current-diff 0

## Deferred

- GG Marmont bucket / non-small velvet shoulder variants are still too sparse/ambiguous for a trusted lane.
  They remain broad for now instead of contaminating the small-shoulder comparable group.
