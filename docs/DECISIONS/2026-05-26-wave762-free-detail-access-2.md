# Wave 762 — Paywall 무료 상세보기 1회 → 2회

- 시간: 2026-05-26 KST
- 트리거: owner — "1번 무료 끝나고 paywall 어떻게 생각해?? 3번이면 피로도 ↑ 같은데 2회 추천?"

## 결정

`FREE_DETAIL_ACCESS_LIMIT` 1 → 2 로 변경.

## 근거 — 1회 vs 2회 vs 3회 비교

### 1회 (이전 정책) — 너무 야박

- 첫 매물 차익률 변동성 큼 → 첫 매물 별로면 즉시 이탈
- Trust build 부족 — "운빨 한 번 봤네" 의심 못 풀고 떠남
- 일반인 친화 X (메모리 "미뇨이 핵심 원칙 — 일반인 친화" 위배)
- 한 번에 결제 결정 일반인은 잘 못 함

### 3회 (owner 우려) — 피로도 + conversion 약화

- 3번째쯤이면 "이 정도 봤으면 됐다" 만족감 → motivation peak 지나감
- 매물 변동성으로 3건 중 1건은 차익 약한 매물 가능성 ↑ → 가치 인식 dilute
- "곧 paywall" 예상 → 미리 결제 결심 OR 떠남
- 무임승차 비용 3배 (AI 호출, DB 적재, 시세 비교)

### 2회 (선택) — sweet spot

- 1번째: hook ("오 이런 매물이 있구나")
- 2번째: validate ("패턴 맞네, 진짜야")
- 3번째 = paywall (motivation peak 시점에 결제)
- 미뇨이 정보량 두꺼움 (시세/차익/셀러 신뢰/비교 매물) → 2회면 학습 충분
- 690원 단가 → 결제 friction 낮음 → paywall 빨리 띄워도 OK
- 무임승차 비용 1.5x 만 증가 (3회 대비 manageable)

## 변경

### 핵심 상수 (limit)

- `src/lib/detail-access.ts` — `FREE_DETAIL_ACCESS_LIMIT = 1` → `2`
- `src/components/explore-client.tsx` — `DEFAULT_FREE_DETAIL_ACCESS_LIMIT = 1` → `2`

### UI 카피

- `src/components/app-nav.tsx` line 636 — "첫 상세 리포트 1회 무료" → "첫 상세 리포트 2회 무료"
- `src/lib/plan-config.ts` — Free plan cadence "첫 상세 1회 무료" → "첫 상세 2회 무료", features "첫 상세보기 1회 무료" → "첫 상세보기 2회 무료"

### 동적 처리 — hardcoded "1회" 제거

`src/components/explore-client.tsx` `directTradeCostLabel`:
```ts
// Before
if (freeRemaining > 0) return "무료 상세보기 1회";
// After
if (freeRemaining > 0) return `무료 상세보기 ${freeRemaining}회`;
```

매물 카드 cost label 이 정확한 잔여 노출. 2회 다 안 썼으면 "2회", 1회 썼으면 "1회".

## Migration 영향

- 기존 free 1/1 쓰고 paywall 본 사용자 → limit 2 가 되면서 1회 더 무료 받음 (rate limit count 1 < limit 2)
- DB 마이그레이션 불필요 (rate_limits row 자동 처리)
- 사용자 친화적 — "어 무료 1번 더 생겼네" 깜짝 회복 경험

## Follow-up

- Conversion 데이터 추적 — 2회 정책 시작 후 paywall hit → 결제 전환률 변화 모니터링
- 만약 conversion 떨어지면 A/B test 로 1회 vs 2회 vs 3회 비교 검토 (사용자 규모 충분해질 때)
- "첫 매물 quality 보장" (top 차익률 매물 sourcing) 은 별도 wave 에서 검토 (cherry-pick 의심 부담)
