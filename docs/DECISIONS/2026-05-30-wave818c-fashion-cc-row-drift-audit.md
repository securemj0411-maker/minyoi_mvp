# Wave 818c (audit only) — fashion 시세 row dual-policy drift 발견

날짜: 2026-05-30
상태: audit only — destructive cleanup 은 owner confirm 후 별도 wave
관련: Wave 803g (fashion cc="" + tier 정책), Wave 814-818 (tier-aware lookup), Wave 818b revert

## 발견

Wave 818/818b 검증 query 중 발견:

`comparable_key = "clothing|polo_knit_sweater|knit|b_grade"` 의 mvp_market_price_daily 2026-05-30 row:

| computed_at | condition_tier | condition_class | active_sample | blended_median |
|------------|---------------|-----------------|---------------|----------------|
| 14:43:11 | B | "" | 7 | 78,660원 |
| 10:13:25 | B | clean | 4 | 87,400원 |
| 10:13:25 | B | normal | 5 | 82,800원 |
| 10:13:25 | B | worn | 0 | null |

같은 날, 같은 (date, comparable_key, condition_tier=B) 안에 cc="" 새 정책 row 와 cc 별 옛 정책 row 가 **동시 존재**.

PK = (date, comparable_key, condition_class, condition_tier) — cc 가 달라서 충돌 안 됨 → 옛 row 누적된 채 새 row 추가.

## 원인

Wave 803g (2026-05-30) 박은 후 sweep 가 fashion 매물을 `cc=""` 로 박기 시작. 하지만 **옛 cc 별 row purge 안 함** → 두 정책 row 동시 존재.

lookup 시 fashion 매물 (B tier) 가 `${tier}|` composite key + 옛 단일 cc key fallback (Wave 803i) 박혀있어서, `B|""` 와 `B|clean`/`B|normal` 양쪽 다 잡힐 수 있음.

## 영향 측정

**mvp_market_price_daily** (fashion cc != "" 옛 row):
| category | rows | distinct keys | cc values | tier values |
|----------|------|---------------|-----------|-------------|
| clothing | 1,467 | 456 | clean/mint/normal/unopened/worn | A/B/C/D/S/UNKNOWN |
| shoe | 2,728 | 773 | clean/mint/normal/unopened/worn | (빈)/A/B/C/D/S/UNKNOWN |

**mvp_market_price_daily_per_source** (fashion cc != "" 옛 row):
| category | rows | distinct keys |
|----------|------|---------------|
| clothing | 1,856 | 439 |
| shoe | 3,493 | 750 |

**합계: 9,544 rows.**

## 해결 방향 (destructive — owner confirm 필요)

```sql
DELETE FROM mvp_market_price_daily
WHERE category IN ('shoe', 'clothing')
  AND condition_class != ''
  AND condition_class IS NOT NULL;

DELETE FROM mvp_market_price_daily_per_source
WHERE category IN ('shoe', 'clothing')
  AND condition_class != ''
  AND condition_class IS NOT NULL;
```

### 사라지는 데이터
- 9,544 rows (fashion 옛 cc 별 row)
- historical 시세 trend 일부 깨짐 (cc 별 row 가 cc="" 로 통합되기 전 historical 데이터)

### 보존되는 데이터
- cc="" 박힌 Wave 803g 새 정책 row 다 그대로
- non-fashion (shoe/clothing 아닌) row 다 그대로

### Lookup 효과
- fashion 매물 (B tier) → `B|""` row 만 잡힘. 옛 fallback (`B|clean` 등) 차단.
- strict tier 매칭 동작 — 시세 vs 비교매물 모순 해소 (옛 row drift 제거).

### Risk
- **PITR 없음** (memory: "미뇨이 PITR 미박힘 → 시점 복원 불가").
- 시세 historical 한 번 잃으면 못 돌림.
- 9,544 rows 가 production 시세 lookup 의 fashion 영역 기반 — UX 영향 즉시 (`/lookup`, `/me`, `/explore` fashion 매물 시세).

## Owner confirm 요청 항목

1. 9,544 rows DELETE 박을지?
2. 박는다면 sweep 다음 cycle 에서 cc="" 새 row 가 누적되기까지 갭 (~수 시간) 동안 fashion 시세 부분 unavailable 박는 게 OK 인가?
3. (option C) DELETE 박지 말고 lookup 쪽에서 cc != "" fashion row 무시 — 코드만 변경, DB 무손상. UX 동일 효과 + revertable.

## 다른 root cause 후보 — score_dirty sweep sample sparsity

`loadScorableRows` 는 `score_dirty=eq.true` 매물만 sweep → 619 active B-tier 중 7 만 시세 sample 박힘 (1%).

이건 별도 Wave audit 필요 (sweep 알고리즘 변경 = owner 결정 임계점).

## 사용자 짧은 요약 (자율 진행 X)

폴로 니트 B-tier 사례 검증 중 발견 — 시세 78.6K vs 비교매물 42K 모순의 root cause 둘 다 owner 결정 영역.

(1) **dual row drift** — fashion 새/옛 cc 정책 row 9,544개 동시 존재. DELETE 필요 (PITR 없음).

(2) **sweep score_dirty sparsity** — sweep 가 dirty 매물만 처리해서 sample 부족 (619 중 7).

박을지 명시 confirm 필요.
