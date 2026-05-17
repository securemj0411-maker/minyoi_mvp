# 2026-05-17 listing-verdicts: 매물 카드 chip 공통 utility

## 사용자 vision

> "단순히 그냥 시세추천보단 근거 있잖아? 왜 그런지 이런거 태그로 보여주는걸 강점으로 밀어야될듯"

핵심: **미뇨이 차별화 = 근거 있는 추천**. chip 으로 매물별 "왜 좋은지" 명시.

## 박은 변경 (commit `8ec12e6`)

### 새 utility `src/lib/listing-verdicts.ts`
- `buildVerdicts(input: VerdictInput): Verdict[]` 함수
- raw 데이터 입력 → chip 라벨 결정
- 3 화면 (pack-reveal / admin-pool / preview-masked) 공통 — drift 차단
- `VERDICT_TONE_CLASS` tailwind class 공통

### 새 chip 4종

| chip | 조건 | tone |
|---|---|---|
| **시세보다 -N%** | (median - price) / median ≥ 0.15 (good ≥0.3) | good/info |
| **🔥 수요 매우높음** | sold_sample_count ≥ 30 | good |
| **수요 높음** | sold_sample_count ≥ 10 | good |
| **수요 보통** | sold_sample_count ≥ 3 | info |
| **🆕 방금 등록** | last_seen 1h 이내 | good |
| **댓글 없음** | num_comment === 0 | info |
| **시세 sample N건** (강화) | confidence high + sample count 명시 | good |

### 기존 chip 9종 통합
- 사용감 주의 / 신규 판매자 (warn — 위험)
- 평균 N일 회전 / 매물 활발 (시장)
- 시세 신뢰 높음/낮음
- ★N.N 셀러 (rating + review count 5+)
- 상태 좋음 / 무료배송 / ❤️ N

### 우선순위
1. 강한 부정 (사용감 주의 / 신규 판매자)
2. 가격 매력 (시세보다 -N%)
3. 시장 활성 (수요 / 회전 / 매물 활발)
4. 신선도 (방금 등록)
5. 셀러 신뢰
6. 시세 신뢰
7. 매물 quality / 무료배송 / 관심도

### max 4 → 6
- 새 chip 4 + 기존 9 = 13 가능
- max 6 으로 늘려 핵심 신호 가림 차단

### pack-reveal-modal
- `verdictsForCard()` → `buildVerdicts()` 호출
- `VerdictBadgesMini` → `VERDICT_TONE_CLASS` import

## Phase 2 (보류)

- **admin-pool-browser, user-reveal-dashboard 적용** — raw 데이터 fetch 추가 필요 (sellerReview / velocity / flow 등)
- **chip 별 popover 상세 근거** — "시세 신뢰 높음" hover → "comparable 18건 / IQR 12%"
- **preview-masked 메인 페이지도 buildVerdicts 통합** — 현재 hardcode chip 4종을 utility 호출로

## Test

288/288 pass.
