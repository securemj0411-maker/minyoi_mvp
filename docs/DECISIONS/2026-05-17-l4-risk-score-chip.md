# 2026-05-17 Phase 0 L4 — 매물 카드 5축 잔여 위험 시각화 (RiskScoreBar)

## 컨텍스트

7-Layer ground truth 사업 보고서 L4 — "위험 차단 = retention의 단기 leverage가 시세 정확도보다 더 큼"
Retention 6 메커니즘 보고서 #4 — "보호받음 감정이 ROI보다 sticky"

미뇨이는 이미 강한 hard-block 인프라 보유:
- `POOL_BLOCK_FLAGS` (`pool-policy.mjs`) — 14개 flag로 풀 진입 차단
- AI L2 escrow queue — narrow smartphone needs_review 매물 처리
- `score_flags` (mvp_listing_parsed)

문제: **백엔드에서 차단만 되고 통과한 매물의 *잔여* risk가 사용자에게 안 보임**.
- 사용자가 "보호받음" 못 느낌
- 풀 통과해도 약한 신호 (예: ai_normal로 통과한 deep_discount, sellerReviewCount=0, descriptionPreview "iCloud") 잡힐 수 있음

## 결정 — 5축 잔여 위험 시각화

### 새 utility — `src/lib/risk-score.ts`

```ts
export type RiskAxis = "fraud" | "lock" | "battery" | "seller" | "photo";
```

5축 0~2점 (safe/caution/warn). 종합 total + hitCount + tone (safe/caution/danger) + label.

#### Fraud (가품)
- ai_escrow_held → 2 "AI 검수 보류"
- ai_escrow_pending/unavailable → 1
- 키워드: 타오바오/짝퉁/레플리카/공장직배송 → 2
- 시세 -50%+ AND confidence < 0.7 → 2
- 시세 -40%+ AND confidence < 0.8 → 1
- deep_discount_review + ai_normal → 1 (통과한 약한 신호)

#### Lock (잠금/할부)
- 키워드: iCloud/통신사 잠금/할부 잔여/애플케어 활성/렌탈 → 2
- self_unlocked_ambiguity flag → 1

#### Battery
- conditionClass === "low_batt" → 2
- 키워드: 배터리 저하/충전 안됨/효율 5~7N% → 2
- BATTERY_SENSITIVE_CATEGORIES (smartphone/earbuds/smartwatch/tablet/laptop) 인데 효율 미공개 → 1
- 효율 < 80% → 2, < 90% → 1

#### Seller
- 후기 0 → 2 "신규 판매자"
- 후기 < 3건 → 1
- 별점 < 3.5 (후기 5건+) → 2
- 별점 < 4.0 (후기 5건+) → 1

#### Photo
- 사진 ≤ 1장 → 2
- 사진 ≤ 2장 → 1
- description "사진 추가/더/요청" 안내 → 1

### Tone 결정

- total >= 4 OR hitCount >= 3 → **🚨 위험 N건** (rose)
- total >= 2 OR hitCount >= 1 → **⚠️ 주의 N건** (amber)
- 그 외 → **🛡️ 안전** (emerald)

### 새 component — `src/components/risk-score-bar.tsx`

- `<RiskScoreBar {...input} showDetail />` — chip + 5축 mini-bar + ? popover
- `<RiskScoreBar {...input} compact />` — chip 만 (좁은 영역)
- popover: 5축 별 reason + 분류 정책 설명

### 3 화면 wiring (UI 규칙)

| 화면 | mode | 입력 |
|---|---|---|
| admin-pool-browser | showDetail | 전체 (scoreFlags + description + 카테고리 + seller + imageCount) |
| pack-reveal-modal | showDetail | 일부 (description + condition + seller, scoreFlags/imageCount 없음) |
| user-reveal-dashboard | compact | 일부 (description + condition + seller) |

## API 변경 — `/api/admin/pool-listings`

새 필드 노출:
- `descriptionPreview` (mvp_listings)
- `sellerReviewRating`, `sellerReviewCount` (mvp_listings)
- `imageCount`, `freeShipping`, `numFaved`, `numComment` (mvp_listings)
- `scoreFlags` (mvp_listing_parsed)

## Trade-off

- pack-reveal/user-reveal는 `RevealCard` 타입에 scoreFlags/imageCount/categorySlug 없어 일부 축 비활성.
  → 후속 wave에서 `pack-open.ts`에 score_flags/image_count 추가하면 5축 풀 가동.
- Risk score는 잠재적으로 false positive 가능 (예: 키워드 매칭).
  → popover에 "0이라도 100% 안전 보장은 아님" 명시.
- "위험 N건"이 사용자 매수 의지 꺾을 수 있음.
  → 차별화 = "근거 있는 추천" — 사용자 신뢰가 매수 promotion 보다 retention factor 크다 (보고서 인용).

## Test

`npm run test:core`: 328/328 pass.
typecheck: 기존 wave141/145/148/151 fixture 에러는 별도 (riskHits/scoreFlags fixture 미보충). 본 변경 관련 새 에러 없음.

## Follow-up

- `pack-open.ts` RevealCard 에 `scoreFlags`, `imageCount`, `categorySlug` 추가 → pack-reveal/user-reveal도 5축 풀 가동
- 사용자 베타 모니터링: risk_score 표시 후 "보호받음" 신호 (NPS/retention) 측정
- A/B test 검토: risk_score 표시 vs 미표시 30일 retention 비교 (PMF 신호)

## Linked decisions

- `2026-05-17-master-plan-deferred-items.md` — AI Advisor + Pool alarm 보류
- (이후) `2026-05-17-life-appliance-sweep-readiness.md` — 생활가전 sweep
