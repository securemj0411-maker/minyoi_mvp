# launch-82 — 시세 그래프(MarketHistoryChart) 작동 검토

## 사용자 지시

> "시세 누적 중 — 아직 history 없어요 (매물 처음 등록) ... 이거 지금 잘 작동중이지>>??? 충분한 데이터 며칠 쌓이면 잘 보이는 구조지??? 혹시 모르니 일단 검토 해보면 좋겠음"

launch-77 에서 상세페이지에 복원한 그래프의 누적 흐름 + 빈 상태 처리 + 호환성 점검.

## 흐름 정리

```
mvp_listings (매물 풀)
  ↓ (tick cron — 매 분)
tick-pipeline.marketStatsStage()  ← market-worker cron (매시 12분)
  ↓ upsert PK=(date, comparable_key, condition_class)
mvp_market_price_daily
  ↑ /api/market/history?ck=...&days=30&cc=...
MarketHistoryChart (SVG inline)
```

## ✅ 정상 작동 확인

1. **cron schedule 정상** — `vercel.json` 의 `/api/cron/market-worker` schedule `12 * * * *`. tick-pipeline `marketStatsStage` 가 stage_pipeline 안에서 호출됨.
2. **데이터 누적 진행 중** — 5/16~5/23 매일 row 생성 (5/22 = 8,431 rows, 5/23 = 1,391 rows — 진행 중).
3. **사용자 매물 (pid 7000939590067, RRL 필드치노) ck 확인** — `clothing|polo_rrl_pants|pants|b_grade` 가 5/20, 5/22, 5/23 3일치 시세 누적 → 그래프 표시 OK.
4. **빈 상태 UX** — `market-history-chart.tsx` line 139~165:
   - 0개 → "시세 누적 중 — 아직 history 없어요 (매물 처음 등록)"
   - 1개 → "시세 누적 1일째 — 내일부터 추이 그래프 자동 표시"
   - 2개+ → SVG 그래프 표시 (threshold 3→2 낮춰져 있음, 5/17 fix)
5. **fallback chain** — `conditionFallbackChain(cc)` 정상. strict=1 모드는 reference (다나와) 매물에만 적용.
6. **rate limit** — IP 기반 30 req/60s. abuse 차단.
7. **confidence badge** — high (≥20 sample) / medium (≥8) / low. 사용자에게 신뢰도 명시.

## ⚠️ 발견된 문제

### 문제 1 — 신발/의류 chart 가용성 매우 낮음

DB sweep (5/23, days_recorded ≥ 2 매물 비율):

| 카테고리 | 매물 ck | 가용 (2일+) | **%** |
|---|---|---|---|
| 신발 | 12,561 | 1,334 | **10.6%** 🚨 |
| 의류 | 2,526 | 580 | **23.0%** 🚨 |
| 노트북 | 918 | 664 | 72.3% ✓ |
| 태블릿 | 655 | 514 | 78.5% ✓ |
| 이어폰 | 43 | 40 | 93.0% ✓ |

**원인**: 신발/의류는 SKU 다양성이 매우 많음 (12.5k vs 920 노트북) + Wave 715 narrow split 으로 ck 더 좁아짐 → 같은 ck 매물 매일 누적 안 됨. **사용자 신발/의류 매물 클릭 시 80~90%가 "시세 누적 중" 빈 상태**.

### 문제 2 — 신발/의류 tier 별 시세 분리 안 됨 (launch-78 후속)

`mvp_market_price_daily` 의 PK = `(date, comparable_key, condition_class)` — **옛 conditionClass only**.

사용자 RRL 필드치노 (`condition_tier=D`) 그래프 호출 시:
- chart `conditionClass` prop = `"clean"` (DB에 그렇게 저장됨)
- → `cc=clean` query → conditionClass=clean 매물 시세 ₩210,000 표시
- 진짜 D급 시세 (~0.6x = ₩126,000 예상) 신호 column 자체에 없음

launch-78 에서 비교군 라벨/필터는 tier 분리했지만 **시세 그래프 axis 는 미적용**. Wave 714 Stage 5 보류 사항.

### 문제 3 — `MarketHistoryChart` props 에 `conditionTier` 전달 X

`conditionClass` prop만 받음. 신발/의류 매물도 옛 conditionClass 로 query. 문제 2 와 연동.

## 권고

| 항목 | 조치 | 비고 |
|---|---|---|
| 빈 상태 UX | 변경 X (정상 동작) | — |
| cron 누적 | 변경 X (정상 동작) | — |
| 신발/의류 가용성 ↑ | Wave 715 narrow split 영향 평가 후 결정 | broad SKU 도 병행 누적 검토 |
| **tier 별 시세 분리** | **Wave 714 Stage 5 우선순위 ↑** | DB schema 변경 + tick-pipeline 재작성 + reparse 큼 |
| chart props tier 전달 | Stage 5 와 함께 | dependency |

## 즉시 조치 — 신발/의류 빈 상태 메시지 친화화 (선택)

현재 메시지: "시세 누적 중 — 아직 history 없어요 (매물 처음 등록)"

신발/의류 한정으로 더 친절한 카피 가능:
- "이 모델 시세는 아직 누적 중이에요"
- "비슷한 매물이 더 쌓이면 자동으로 그래프가 보여요"

하지만 추후 wave 에서 일괄 정리 권장 (이번 wave 는 audit 목적).

## 미해결 / 후속 wave

1. **Wave 714 Stage 5** — `mvp_market_price_daily` 에 `condition_tier` column 추가 + tier 별 시세 누적 + chart tier-aware. 가장 큰 impact.
2. **신발/의류 가용성 sweep** — 어떤 ck 들이 가용성 낮은지 분포 + 매물 분포 측정. broad SKU 병행 누적 정책 검토.
3. **chart props `conditionTier`** 추가 (Stage 5 같이).

## 검증 데이터

- 사용자 RRL 필드치노 ck history (5/20, 5/22, 5/23) ✓ 그래프 표시 예상
- 전체 카테고리 가용성 측정 완료 (위 표)
- cron schedule + writer 위치 확인 (`tick-pipeline.ts:3882`)

Owner: caulee1227@gmail.com / 2026-05-23
