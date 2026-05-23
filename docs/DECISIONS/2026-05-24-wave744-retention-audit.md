# Wave 744 — raw_listings retention audit (Task #44)

**날짜**: 2026-05-24

## 배경
Task #44 (raw_listings 90일 명시 vs 7-10일 실측) audit.

## 측정 결과 (age bucket)

| age | cnt | active | terminal |
|-----|-----|--------|----------|
| 1d | 28,971 | 28,141 | 830 |
| 3d | 50,607 | 48,783 | 1,784 |
| 7d | 140,169 | 137,118 | 3,032 |
| 14d | 117,631 | 106,467 | 11,107 |
| **30d** | **1,205** | 951 | 254 |
| 60d+ | 0 | 0 | 0 |

## 진단
"30일 이상 매물 1,205건만"의 의문 → 원인 발견:

**운영 시작**: 2026-05-09 14:06 UTC
**측정 시점**: 2026-05-24 (15일 후)

→ 데이터 누적 15일치만. 30일+ 매물 자체 없음 (운영 15일밖에 안 됨).

## Retention TTL 정상 작동 확인
`prune_raw_listings_active_text` (90일) / `prune_raw_listings_dead_text` (30일) RPC는 **text-only prune** (description_preview / raw_json 비움). 매물 row 자체 hard delete 없음.

→ 90일 retention 명시 정확. 단 누적 데이터 부족으로 90일까지 검증 불가.

## Action
- Task #44 closed: false alarm. 14-15일 이후 데이터 누적되면 자연 검증.
- 2026-08-09 (90일+) 시점에 재측정 권장 (90일 retention 정상 작동 확인).

## 부수 발견
- 14d → 30d 급격한 감소 (117K → 1.2K) — 운영 시작 시점 (5/9-5/11) 매물만 잔존
- 6/8 이후 (운영 30일) 까지는 retention 측정 의미 없음
