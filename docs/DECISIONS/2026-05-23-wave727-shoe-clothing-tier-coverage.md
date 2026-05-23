## Wave 727 — 신발/의류 condition_tier DB 채움 % 측정

- 시간: 2026-05-23 KST
- 발견: Wave 723 audit Agent 2 보고 "신발 80% 등급 없이 노출" 검증 측정. 결과 거의 정확.

### 측정 결과

#### 전체 mvp_listing_parsed (raw 수집 후 파싱된 매물 전체)

| 카테고리 | 전체 | 등급 채움 | NULL | 채움 % |
|---|---:|---:|---:|---:|
| shoe | 21,661 | 6,456 | 15,205 | **29.8%** |
| clothing | 13,496 | 3,426 | 10,070 | **25.4%** |

#### mvp_candidate_pool (실제 사용자에게 노출되는 매물)

| 카테고리 | Pool 매물 | 등급 있음 | NULL | 채움 % |
|---|---:|---:|---:|---:|
| shoe | 488 | 170 | 318 | **34.8%** |
| clothing | 815 | 168 | 647 | **20.6%** |

### 입문자 시점 의미

- **신발 카드 10개 중 7개가 등급 뱃지 없이 노출.**
- **의류 카드 5개 중 4개가 등급 뱃지 없이 노출.**
- 사용자: "이 신발/옷 상태 좋은 건지 나쁜 건지 판단 불가" → 추천 신뢰도 직접 타격.

### 측정 명령 (재현 가능)

```sql
-- 전체
SELECT
  CASE WHEN comparable_key LIKE 'shoe|%' THEN 'shoe'
       WHEN comparable_key LIKE 'clothing|%' THEN 'clothing' END AS category,
  COUNT(*) AS total,
  COUNT(condition_tier) AS with_tier,
  ROUND(100.0 * COUNT(condition_tier) / NULLIF(COUNT(*), 0), 1) AS pct
FROM mvp_listing_parsed
WHERE comparable_key LIKE 'shoe|%' OR comparable_key LIKE 'clothing|%'
GROUP BY 1;

-- Pool 노출
SELECT ... FROM mvp_candidate_pool cp JOIN mvp_listing_parsed p ON p.pid = cp.pid ...;
```

### 위험

- 측정만 한 단계 — 코드/DB 변경 0건. 단 사용자가 fix 안 박으면 오픈 시 등급 없이 노출 그대로.

### 다음 (사용자 결정 필요)

3가지 옵션:

**A. Backfill 작업** — Wave 714 sweep job 재실행해서 NULL 채우기.
- 장점: 정직 정확도 유지. 사용자에게 더 많은 매물 노출.
- 단점: 시간 걸림 (15K+ shoe row + 10K+ clothing row sweep). 다른 세션이 `clothing-axes.ts` / `pack-reveal-modal.tsx` 진행 중이라 충돌 가능.

**B. Pool gate 에 `condition_tier IS NOT NULL` 추가** — 등급 없는 매물은 후보풀 진입 차단.
- 장점: 즉시 적용. 사용자가 보는 매물 100% 등급 있음.
- 단점: pool size 신발 488 → 170 (-65%), 의류 815 → 168 (-79%). 매물 풀 크게 줄어듦 → 입문자가 "왜 매물이 적지?" 인식 가능.

**C. UI 안내 박기 — 등급 없는 카드에 "등급 정보 준비 중" 라벨**
- 장점: 정직성 (memory 원칙). 매물 노출 그대로.
- 단점: 사용자 첫 인상 "이 사이트 미완성?" 인식 risk.

**추천: A + C 조합.** backfill 진행 (24-48h) + 그동안 UI 안내. 단 다른 세션 `pack-reveal-modal.tsx` 480줄 진행 중이므로 backfill 명령만 박고 UI 안내는 다른 세션 종료 후.

### 메모
- 다른 세션이 `launch-78 shoe-clothing-tier-label-mismatch` 진행 중 — D급/A급 라벨 mismatch fix. 이 작업이 pack-reveal-modal 에서 frontend 라벨 분기 fix. 즉 등급 있는 카드는 라벨 mismatch 잡힘. **하지만 등급 NULL 카드 자체는 별도 문제** (Wave 727).
