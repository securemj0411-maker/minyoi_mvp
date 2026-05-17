# Wave 196 — verdict chip 풍부화 (8개 새 chip)

## 사용자 결정

> "D가 이미 있는데 더 풍부하게 박으면 진짜 좋을듯?? ㄱㄱ 검토해보고"

→ 검토 완료 + 8개 새 chip 박음.

## 박은 것

### `src/lib/listing-verdicts.ts` 확장

#### 1. 카테고리 강한 긍정 (description regex 6개)

| chip | regex | tone |
|---|---|---|
| 🔋 배터리 100% | "배터리 100%" / "효율 100%" / "배터리 정품 100%" | good |
| 🛡️ AppleCare | "AppleCare" / "애플 케어" | good |
| 📦 풀구성 | "풀박스" / "풀구성" / "박스+케이블+충전" / "풀세트" | good |
| 🔒 미개봉 봉인 | "미개봉 상태" / "봉인" / "밀봉" / "새상품 박스" | good |
| 🆕 최근 구매 | "N개월 전 구매" / "이번 달 구매" / "최근 구매" | info |
| 🆔 시리얼 공개 | "시리얼 공개/첨부/사진" / "S/N 공개" | info |

→ 사용자 차별화: "근거 있는 추천" 강화. 매물 카드 첫인상 ↑.

#### 2. 데이터 부족 명시

| chip | 조건 | tone |
|---|---|---|
| 시세 sample 부족 (N건) | `marketSampleCount < 5` + 다른 신뢰 chip 안 박혔을 때 | warn |

→ Wave 183/187 (Liquidity 곡선 한계) 보완. 사용자 보호받음 ↑.

#### 3. 우수 셀러

| chip | 조건 | tone |
|---|---|---|
| 🏆 우수 셀러 (N건) | `sellerReviewRating >= 4.8 && sellerReviewCount >= 50` | good |

기존 "★4.8 셀러" (rating + 5건+) 보다 강한 신호.

### 우선순위 / 충돌 없음
- max 6 유지 (`MAX_VERDICTS`)
- 우선순위: 강한 부정 > 가격 매력 > **카테고리 강한 긍정 (새)** > 시장 활성 > 셀러 > 시세 신뢰 > quality > 배송/관심
- 새 chip 박혀도 max 6 cap — 가장 강한 신호만 살아남음
- 기존 chip 모두 그대로 (회귀 0)

### 비파괴 검토
- `listing-verdicts.ts` utility 확장만 — DB / API 변경 0
- 3 화면 (admin-pool, pack-reveal, user-reveal-dashboard) 자동 반영 — 같은 utility 재사용
- 데이터: 기존 `descriptionPreview` / `sellerReviewRating` / `sellerReviewCount` / `marketSampleCount` 활용 — 추가 fetch 0

## 효과 예상

매물 카드 1개에 박힐 수 있는 chip 예 (상위 6개만):
```
[시세보다 -23%] [🔋 배터리 100%] [📦 풀구성] [🛡️ AppleCare] [🔥 수요 매우높음] [평균 3.2일 회전]
```

→ 사용자가 매물 보자마자 "왜 좋은지" 6개 신호 즉시 인지. 미뇨이 차별화 = **"근거 있는 추천"** 강화.

## Test

`npm run test:core`: **383/383 pass**.

## Follow-up

1. **카테고리 SKU별 더 정밀한 regex** — 예: "베젤 깨끗" (iPhone), "케이스 마모 없음" (AirPods)
2. **셀러 풍부화 추가** — proshop / officialSeller / salesCount (현재 savedDetail 미박힘, RevealCard 확장 필요)
3. **chip 우선순위 사용자별** — Personalization 박힌 뒤 자본/위험 기반 정렬
4. **A/B test** — 8개 새 chip 표시 vs 미표시 → 매수 conversion 비교

## Linked

- `2026-05-17-listing-verdicts-utility.md` (원본 utility)
- `2026-05-17-verdicts-phase2-3screens.md` (3화면 wiring)
- `2026-05-17-preview-verdicts-phase3.md`
