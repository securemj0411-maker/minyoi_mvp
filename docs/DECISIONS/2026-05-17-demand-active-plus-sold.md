# 2026-05-17 수요 chip 정책 변경 — sold + active 합산

## 사용자 지적

> "왜 다른거 수요 안나옴??
> 번개장터에 많이 올라오는걸로 그냥 수요라고 생각하면 되는거아님??"

## 원인

이전 정책:
- `sold_sample_count` 만 사용
- threshold: 30/10/3 (매우높음/높음/보통)

문제:
- bunjang sold detection 안정성 부족 — 일부 SKU 만 sold 잡힘
- 예: `airpods_2_lightning` active 29 / sold 0 → 수요 chip 안 보임 (active 많은데도)
- 사용자 직관: "매물 많이 올라오는 = 수요" 와 안 맞음

## 박은 변경 (commit `a75d746`)

### API (/api/preview-pool)
- `select` 에 `active_sample_count` 추가
- `demandByKey` = `sold + active` 합산 (latest date 모든 condition_class)
- 코드 코멘트: "사용자 정책 '번개에 많이 올라오는 = 수요'"

### verdicts threshold
| 등급 | 이전 (sold만) | 새 (sold+active) |
|---|---|---|
| 매우높음 | 30+ | **50+** |
| 높음 | 10+ | **20+** |
| 보통 | 3+ | **8+** |

active 포함하면 N 자연 커지므로 threshold 도 올림.

## 예시 비교

| SKU | sold | active | 이전 chip | 새 chip |
|---|---|---|---|---|
| airpods_4_anc | 17 | 76 | 수요 보통 (17 sold) | **🔥 수요 매우높음** (93) |
| airpods_2_lightning | 0 | 29 | (없음) | **수요 높음** (29) |
| 다이슨 V12 | 0 | 2 | (없음) | (없음 — 8 미달) |

## Trade-off

- active 매물 많은 SKU = 시장 활성 = 수요 맞음 (일반적)
- 예외: 안 팔리는 매물이 active 로 쌓이는 경우 — 진짜 수요 아님
- 검증: sold 안정성 부족하니까 sold+active 가 best balance
- 사용자 명시 동의

## Test

288/288 pass.
