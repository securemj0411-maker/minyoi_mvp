# Wave 189 (2026-05-18) reveal 카드 실시간 시세 차이 + 추천 무효 badge

> **상태**: 표면 fix (Layer D 부분). DB schema 미변경. 진짜 근본 (Layer A+B+C+E) 은 별 wave.

## 사용자 보고

> "아이패드미니6 64기가: 매입 550,000원 · 시세 340,000원 · +67,785원 +12%"
> "근본적인 해결 맞음?? 다음엔 다신 이런일 없게 할수있는거 맞음?"
> "애초에 차익은 이전에 기록한건데 시세가 바뀌어서 다시 크론? 같은게 없어서 저런거임 아니면 뭐임?"

→ 사용자 추측 ✓ 정답. reveal snapshot 의 `expected_profit_min/max` 가 reveal 시점 값. 시세 매일 갱신 (Wave 184 market-worker) 되어도 reveal row 의 차익 안 갱신.

## 결정

근본 fix (4~5 layer — schema 분리 / 자동 재계산 cron / 무효화 status / UI 분리 / pool 갱신) 은 비용 큼 + collateral 위험 (B/C/E). 사용자 결정 "안전한 거 먼저".

**본 wave = 안전한 step 만**:
- ✅ API 가 화면 표시 시 실시간 시세 차이 계산
- ✅ UI 가 "추천 무효" badge 분기
- ❌ DB write 안 함 (snapshot 그대로 historical 보존)
- ❌ pool/reveal 의 expected_profit 자동 cron X (별 wave)

## 변경

### 1. `src/app/api/packs/me/route.ts`

`RevealItem` 타입에 2 필드 추가:
```ts
marketGapKrw: number | null;  // marketBasis.medianPrice - price
marketStale: boolean;          // true = 현재 시세 < 매입가
```

`reveals.map` 안에서 `marketBasisForCandidate` 한 번만 호출 (중복 제거), 결과로 `marketGapKrw` 계산:
```ts
const computedMarketBasis = comparableKey ? marketBasisForCandidate(...) : null;
const priceNum = Number(raw?.price ?? 0);
const medianPrice = computedMarketBasis?.medianPrice ?? null;
const marketGapKrw = medianPrice != null && priceNum > 0 ? medianPrice - priceNum : null;
const marketStale = marketGapKrw != null && marketGapKrw < 0;
```

### 2. `src/components/user-reveal-dashboard.tsx`

`RevealItem` 타입에 동일 2 필드 추가. PACK_REVEALS_UPDATED handler 에도 박음 (optimistic add — fresh reveal 직후라 stale 아님 가정 `marketStale: false`).

카드 차익 표시 위치 (line 936 부근) 분기:
```tsx
{item.marketStale && item.marketGapKrw != null ? (
  <>
    <span className="bg-rose-100 text-rose-800">{item.marketGapKrw.toLocaleString("ko-KR")}원</span>
    <span className="bg-rose-200">⚠️ 시세 갱신 — 추천 무효</span>
  </>
) : (
  // 기존 emerald 차익 badge + amber % badge
)}
```

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 변경 파일 에러 0
```

### 사용자 화면 예상 변화

기존 (iPad mini 6 케이스):
```
+67,785원  +12%  ← stale snapshot 표시
```

Wave 189 후:
```
-210,000원  ⚠️ 시세 갱신 — 추천 무효  ← 실시간 표시
```

## 안전성 분석 (whack-a-mole 검증)

| 변경 | 위험 | 영향 |
|---|---|---|
| API 새 필드 2개 추가 | ✅ 안전 | 기존 caller 영향 X (optional consume) |
| UI 분기 | ✅ 안전 | visual only. logic/sort 영향 X |
| marketBasisForCandidate 중복 제거 | ✅ 동일 결과 | 같은 인자, 함수 idempotent |
| DB write | ❌ 없음 | snapshot historical 보존 |
| 다른 컴포넌트 (pack-reveal-modal, admin-pool-browser) | ✅ 영향 X | 같은 API 안 씀 또는 자체 fetch |

→ **whack-a-mole 위험 0.** API 1곳 + UI 1곳. 다른 시스템 (시세 cron / pool builder / pack-open) 안 건드림.

## 미해결 (별 wave 후보)

| Wave | 내용 | 우선순위 |
|---|---|---|
| 190? | Layer A: `mvp_pack_reveals` schema 분리 (`snapshot_*` + `current_*`) | medium |
| 191? | Layer B: 자동 재계산 cron (market-worker 후 trigger) | medium |
| 192? | Layer C: 자동 무효화 status (`market_invalidated_at`) | low (정책 결정 필요) |
| 193? | Layer E: pool entry 의 expected_profit 도 시세 갱신 시 재계산 | medium (whack-a-mole 차단 핵심) |
| 188 (보류) | catalog → search query 자동 매핑 | catalog 다른 세션 안정 후 |
| 187-followup | niche SKU search cadence (i3 macbook reparse) | low |

## Lesson

1. **표면 vs 근본 분리** — Wave 189 = "사용자 화면 즉시 fix" 표면. 근본 (DB 자동 sync) 은 Layer A+B+C+E 별 wave. 단계적 진행이 안전.
2. **사용자 추측이 정확** — "재계산 cron 같은게 없어서 저런거임?" 정답. AI 진단 의존 X.
3. **UI 분기로 1차 방어 + 시간 벌기** — DB 변경 안 하고 UI 만으로 사용자 frustration 즉시 해소. 근본 fix 천천히 박을 시간 확보.
4. **whack-a-mole 검증 필수** — 변경 전 "다른 시스템 영향" 항목 별로 표 평가. 본 wave 는 위험 0.
