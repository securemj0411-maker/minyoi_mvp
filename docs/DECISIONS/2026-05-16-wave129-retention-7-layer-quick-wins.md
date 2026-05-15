# Wave 129 — 사업 보고서 7-Layer retention quick wins (L1+L3+L4+L5+L6)

> 사용자 보고서 검토 후 빠른 처리 5건 일괄. retention impact 큰 거 우선 — UI 강조 + decay + threshold 명시.

## 1. L6 — 회전 기간 hero 강조 (가장 큰 retention impact)
- 보고서 인용: "회전 기간이 떡상점수보다 더 retention-critical한 지표. 사용자가 가장 두려워하는 게 안 팔리는 거."
- 변경: **[mvp/src/components/pack-reveal-modal.tsx](mvp/src/components/pack-reveal-modal.tsx)** `VelocityBasisMini`:
  - 작은 chip → 큰 글씨 (3xl font) + 색상 강조
  - 빠른 회전 (≤2일) → 🟢 emerald + "⚡ 빠른 회전" badge
  - 느린 회전 (>7일) → 🟡 amber + "⚠️ 느린 회전" badge
  - "최근 7일 X건 판매됨" 명시

## 2. L4 — 위험 매물 차단 카운터 (retention killer)
- 보고서 인용: "이번 주 위험 매물 12건 차단됨 알림이 떡상점수보다 강한 retention driver. 내 50만원 잃을 뻔한 거 막아줬다는 감정."
- 신규: **[mvp/src/app/api/public/safety-stats/route.ts](mvp/src/app/api/public/safety-stats/route.ts)** API
  - 가품/잠금 keyword 매물
  - 통신사 약정/할부 잔여
  - 가격 dummy (10M+ + 셀러 거부 패턴)
  - pool invalidate
- 신규: **[mvp/src/components/safety-stats-badge.tsx](mvp/src/components/safety-stats-badge.tsx)**
  - "🛡️ 회원님 보호 — 이번 주 X건 차단" hero badge
  - 상세 클릭 → breakdown (4 카테고리)
- 적용: `/me` recommend view 상단에 노출

현재 production 측정: 7일 차단 ~328건 (가품 19 + 통신사 5 + 가격 dummy 304) + pool invalidate 1,604

## 3. L3 — Multi-source breakdown 사용자 노출
- 보고서 인용: "시세 자체보다 시세의 출처를 보여주는 게 retention factor."
- 변경: **[mvp/src/components/pack-reveal-modal.tsx](mvp/src/components/pack-reveal-modal.tsx)** `MarketBasisMini` hero block:
  - 거래완료 X건 + 판매중 X건 + 만료 X건 별도 표시
  - 신뢰도 🟢 높음 / 🟡 보통 / 🔴 낮음 명시
  - "출처: 번개장터 + 다나와 reference" 명시

## 4. L5 — Exponential decay (시세 시간 가중)
- 보고서 인용: "30일 데이터 단순 평균 X. 최근 7일 weight 3x."
- 변경: **[mvp/src/lib/market-math.ts](mvp/src/lib/market-math.ts)** 추가:
  - `exponentialDecayWeight(ageDays)`: `3 * exp(-ageDays/10)` — 최근 7일 ~1.5x, 30일 0.15x
  - `weightedMedian(items)`: weight 누적 50% 기준
  - `decayWeightedMedian(rows)`: observedAt/ageDays 기반 자동 weight
- 적용 대기: `mvp_market_price_daily` 산정 로직에 wire-up 별도 wave (DB schema 변경 X, 함수만 추가)

## 5. L1 — parse_confidence threshold 명시
- 보고서: "AI normalization confidence < 0.85면 매물 풀에서 제외."
- 우리 정책 (LAUNCH_PLAN 12b precision-first): 0.85 너무 strict, 0.65~0.85 medium tier 운영.
- 변경: **[mvp/src/lib/candidate-pool-builder.ts](mvp/src/lib/candidate-pool-builder.ts)** const 명시:
  ```typescript
  PARSE_CONFIDENCE_HIGH = 0.85    // 사용자 ready pool
  PARSE_CONFIDENCE_MEDIUM = 0.65  // AI L2 review 대상
  PARSE_CONFIDENCE_LOW = 0.55     // 학습만, 노출 X
  ```

## 6. 검증
- 139/139 test pass ✓
- 빌드 영향 0 (UI 추가만, 기존 로직 변경 X)

## 7. 거론 금지
- L2 (condition별 시세 별도 트래킹) — 큰 작업 (DB schema + 시세 산정 로직), 별도 wave.
- L5 launch event reset — 별도 wave (event table 신규 필요).
- L7 user feedback loop — 사용자 보류 결정.
- decay 함수는 만들었지만 시세 산정에 wire-up 안 됨 — 다음 wave에서 mvp_market_price_daily 산정 시 적용.
