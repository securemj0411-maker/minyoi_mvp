# Wave 90 — Source 다양화 + 시세 근거 디버그 도구 + 검증 메모 일괄 검토

## 컨텍스트

- 시간: 2026-05-15 KST
- 발견 (wave89 측정):
  - 풀 산출량 측정: 1000 raw → ~111 통과 (11.1%), 카테고리 게이트까지 보면 ~7%
  - 70.8%가 `profit_below_band`로 떨어짐 — **시장 본질** (셀러 대다수가 시세 ±5만원에 올림)
  - 5.3%는 정당한 의심 매물 reject (extreme/deep/condition/risk/weak)
  - 약 11%만 우리가 catch up 가능 (not_scored_yet 9% + needs_review 2%)
  - 1000명 사용자 × 1팩 (4 카드)/일 = 4000 슬롯 필요 vs 현재 풀 산출 ~500/일 = **8배 부족**

- 사용자 결정 (대화):
  1. 비즈니스 모델 변경 X — 일반인 친화 AI 사이트 원칙 유지 (premium 전용 / 알림 매칭 pivot 거부)
  2. 풀 부족은 **source 다양화로 풀 사이즈 키우는 방향**으로 해결
  3. 차익 게이트 ₩20k → ₩10k 낮춤 (배송비 net 1만이면 OK)
  4. 시계 sweep 유지 (자본 천장 risk 있지만 일단 둠)
  5. 진짜 돈 되는 카테고리로 **좁히기** — 셀러 시세 인식 약한 곳 위주
  6. 매물 검증할 때 시세 근거 디버깅 도구 필요 — "이 시세가 어디서 왔는지" 확인 가능하게

- 측정 (wave89 전체 root 측정 + Tier 1 supply check):
  - 25개 Bunjang root 전수 sample (page 0 × 100건)
  - Tier 1 4개 카테고리 매물대 in-flow 측정:
    - 990 예술/희귀/수집품: 14,714건/일 in-flow (포켓몬 띠부씰/한정카드/지포라이터)
    - 910 스타굿즈: 28,223건/일 (피규어/굿즈/아크릴)
    - 800 생활/주방용품: 5,071건/일 (스타벅스 텀블러 한정 등)
    - 610 가전제품: 3,859건/일 (이사·처분 매물, 셀러 시세 약)

## Phase 1A 변경 (즉시 적용)

### 1. 차익 게이트 ₩20k → ₩10k

- 파일: [src/lib/pool-policy.mjs](src/lib/pool-policy.mjs)
- 함수: `bandFromProfit(profitMin, profitMax)`
- 변경: band1 threshold `20_000` → `10_000`
- 효과: 배송비/수수료 제외 net 1만 차익 매물도 풀 진입. 풀 산출량 증가 + 일반인 친화 (저자본 진입자).

### 2. 카테고리 sweep 3개 추가

- 파일: [src/lib/pipeline-config.ts](src/lib/pipeline-config.ts) `DEFAULT_CATEGORY_SWEEPS`
- 추가:
  - `990` 예술/희귀/수집품
  - `910` 스타굿즈
  - `800` 생활/주방용품
- 효과: 매물 raw 흡수 시작. 단 catalog narrow SKU 추가 wave 후속 — 그전엔 ruleMatch fail로 풀 진입 X (안전).

## Phase 1B 변경 (시세 근거 디버그 도구)

### 3. `/api/listings/[pid]/market-source` API route

- 파일: [src/app/api/listings/[pid]/market-source/route.ts](src/app/api/listings/[pid]/market-source/route.ts)
- 권한: 사용자 본인이 reveal 받은 매물만 조회 (`mvp_pack_reveals` 체크)
- 응답:
  - `ourListing`: pid, name, price, skuId, skuName, skuMedian, comparableKey, parseConfidence, needsReview, 번장링크
  - `marketDailyStats`: blendedMedian/activeMedian/p25/p75/active/sold/disappeared/confidence/computed_at (mvp_market_price_daily)
  - `comparableSource`: "comparable_key" / "sku_id" / "none" (어떻게 비교 매물 fetch했는지)
  - `comparables`: 같은 comparable_key의 raw_listings 최대 30개 (pid, name, price, thumbnail, sale_status, listing_state, last_seen_at, source_query, 번장URL)
  - `liveStats`: 실시간 active 매물 기준 통계 (min/p25/median/p75/max/mean/count)
- 이유: 사용자가 검증 시 "이 시세가 어디서 왔는지" 즉시 확인 가능. comparable_key 매핑 정확도 + market_price_daily 집계 vs 실시간 매물 비교.

### 4. `MarketSourceDebug` 컴포넌트 + pack-reveal-modal 마운트

- 파일: [src/components/market-source-debug.tsx](src/components/market-source-debug.tsx) (신규)
- 마운트: [src/components/pack-reveal-modal.tsx:457](src/components/pack-reveal-modal.tsx#L457) (SkuListingFlowMini 직후)
- UI:
  - 토글 가능한 `<details>`-like 패널 — 클릭 시 API fetch + expand
  - SKU + comparable_key + parseConfidence + needs_review 뱃지
  - market_price_daily 집계 (8개 필드)
  - 실시간 통계 (현재 active 매물 기준 median 등)
  - 비교 매물 list — 가격 낮은 순, 우리 매물보다 싼 매물은 rose 강조 + "우리보다 -₩X" 표시
  - 각 매물 클릭 → 번장 새 탭 열림
  - 우리 매물 직접 번장 링크 (큰 emerald 버튼)

### 5. 검증 메모 입력 label/placeholder 확장

- 파일: [src/components/pack-reveal-modal.tsx](src/components/pack-reveal-modal.tsx) 라인 463~482
- 변경:
  - label: "⚠️ 추천 상품이 이상해요 — 신고" → "💬 검증 메모 · 추천 평가"
  - 안내문: "어떤 점이 이상한지" → "매물 검증 결과 / 의심점 / 추천 품질 평가 자유 기록. 나중에 일괄 검토용."
  - placeholder: 신고 예시만 → 검증 메모 예시 추가 ("시세 비교 OK / 단품 의심 / 가격 비교 틀린 듯 / 이거 좋은 추천 ..." 등)
- 인프라: 기존 `mvp_reveal_feedback.note` 컬럼 그대로 활용. schema 변경 0.
- 이유: 사용자가 매물별 자유 코멘트 + 검증 메모 빠르게 남길 수 있게. 평가 빠른 버튼 추가 X (wave80 결정 따라 단순 form 유지).

### 6. 배치 검토 도구 `npm run review:user-feedback`

- 파일: [scripts/review-user-feedback.mjs](scripts/review-user-feedback.mjs) (신규)
- 명령:
  ```bash
  npm run review:user-feedback
  npm run review:user-feedback -- --since=2026-05-15
  npm run review:user-feedback -- --limit=200 --user=<userRef>
  ```
- 동작:
  1. `mvp_reveal_feedback` fetch (note ≠ '' 필터)
  2. 각 pid에 listing + parsed + raw + market_price_daily join
  3. markdown report + JSON 출력 → `reports/user-feedback-review-latest.{md,json}`
- 출력 내용: 사용자 코멘트 + 매입가 + 시세 + SKU + comparable_key + parse confidence + sale_status + market_price_daily 집계
- 이유: 사용자가 매물별로 코멘트 다 남기면, AI agent가 한 번에 모든 코멘트 + 매물 정보를 join한 보고서를 읽고 일괄 검증/검토 가능. 매물 단위로 일일이 보고 안 해도 됨.

## 검증

- `npx tsc --noEmit` — clean
- `npm run test:core` — 139/139 pass
- `npm run review:user-feedback` — 동작 미검증 (DB에 note 있는 row 필요). 사용자가 코멘트 작성 후 실행 가능.

## 위험

- Phase 1A 차익 게이트 ₩10k 낮추기:
  - 풀 산출량 ↑ but 풀 size growth가 invalidated rate에 어떻게 영향 미치는지 측정 필요 (24~48시간 후 측정)
  - 차익 1만 매물은 "셀러 시세 인식 약함"이 아니라 "셀러가 조금 양보"인 경우가 多 — 진짜 차익 확실성은 검증 필요
- Phase 1A sweep 3개 추가:
  - catalog narrow SKU 없으면 raw 흡수만 + 풀 진입 X (안전). 단 raw_listings 테이블 size growth ↑ — disk usage 모니터링 필요
- 시세 근거 API:
  - 사용자 본인 reveal 매물만 조회 가능 — `mvp_pack_reveals` 권한 체크. 다른 사용자 데이터 노출 위험 X.
  - 30건 limit으로 페이지 부담 적음
- 검증 메모 UI:
  - feedback type 자동 'bad_pick' 저장 (기존 handleSaveNote 동작) — 사용자가 좋은 평가 남겨도 'bad_pick' 분류됨. 후속 wave에서 type 분기 검토 가능.

## 다음

1. **사용자 PC방 작업**: 다양한 매물 reveal 받아서 시세 근거 디버그 패널로 검증 + 매물별 코멘트 작성
2. **사용자 돌아온 후**: `npm run review:user-feedback` 실행 → AI agent (나)가 보고서 읽고 일괄 검증 / 패턴 분석
3. **Phase 1B catalog 작업** (wave 91~93): 990/910/800 narrow SKU 추가
   - 990: 포켓몬 띠부씰 시즌별, 한정 카드 (포켓몬/유희왕/원피스), 지포라이터 한정 시리즈
   - 910: 한정 굿즈 (산리오 시즌, 인기 IP 콜라보, 인기 아이돌 굿즈), 인기 아크릴 시리즈
   - 800: 스타벅스 시즌 텀블러 (서머/할로윈/크리스마스/벚꽃), 디저트/캐릭터 콜라보
4. **24~48시간 후 측정**: ₩10k 게이트 적용 효과 — 풀 산출 변화, invalidated rate 변화
5. **사용자 검증 결과 반영**: 코멘트 패턴 분석해 catalog/parser/시세 알고리즘 개선 wave 결정

## 참고 데이터

- wave89 측정 보고서: [reports/wave89-all-roots-sample-latest.json](reports/wave89-all-roots-sample-latest.json) (25 Bunjang root × 100건)
- 기존 sweep 측정: [reports/wave89-existing-sweep-sample-latest.json](reports/wave89-existing-sweep-sample-latest.json) (10개 기존 + 신규 후보 통합)
- Tier 1 supply check: stdout만 (스크립트 `scripts/wave89-tier1-supply-check.mjs`)
