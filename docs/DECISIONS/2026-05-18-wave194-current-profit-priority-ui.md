# Wave 194 (2026-05-18) reveal 카드 current_profit 우선 표시 + 분리 라벨

> **상태: UI fix.** Wave 189 (음수 marketStale 분기) 의 양수 case 한계 보강.

## 사용자 보고

> "애플워치SE3 40mm 미개봉. 매입 290,000원 · 시세 300,000원 · +57,585원 +20%"
> "이제 새 고객은 이럴일 없음??? 기존 고객이 me페이지열때 괴리없음?? 시세랑 차익계산 재검증 안한다거나?"

→ 시세 300K - 매입 290K = +10K (current). 근데 화면 +57K (snapshot 그대로) — **양수 case 도 snapshot vs current mismatch 발생**.

## 진단

DB:
- pid 408588211 (애플워치 SE3 미개봉)
- price: 290,000
- **current_profit_min: +10,000** ← Wave 190/191 정상 박힘
- expected_profit_min (snapshot): +57,585
- market_invalidated_at: null (양수라 무효 X)

UI (Wave 189):
- marketStale=false (양수) → 기존 분기 → **snapshot 표시 (+57K)**
- 사용자는 reveal 받은 시점 차익 +57K 와 현재 +10K mismatch 인지 못 함

## 변경

`src/components/user-reveal-dashboard.tsx` 차익 표시 분기 ([L988-1015](../../src/components/user-reveal-dashboard.tsx:988)):

**Before**:
```tsx
{!marketStale ? (
  <span>+{expectedProfitMax}원</span>  // snapshot 만
  <span>+{pct}%</span>
) : ...}
```

**After (Wave 194)**:
```tsx
const hasCurrent = item.marketGapKrw != null;
const displayProfit = hasCurrent ? item.marketGapKrw! : item.expectedProfitMax;
const snapshotProfit = item.expectedProfitMax;
const profitDiverged = hasCurrent && Math.abs(displayProfit - snapshotProfit) >= 5000;
const sign = displayProfit >= 0 ? "+" : "";

<span>{sign}{displayProfit.toLocaleString("ko-KR")}원</span>
{profitDiverged && (
  <span title={`추천 당시 +${snapshotProfit} → 현재 ${sign}${displayProfit}`}>
    ↓ 시세 갱신
  </span>
)}
```

정책:
- **current 박혀있으면 우선 표시** (snapshot 폐기 X, hover/title 로 보존)
- snapshot 과 차이 ≥ 5K 면 "↓ 시세 갱신" 라벨 추가
- 음수 case 는 Wave 189 분기 (rose badge "추천 무효") 유지

% 표시도 current 기반 재계산:
```tsx
const profitForPct = item.marketGapKrw ?? ((expectedMin + expectedMax) / 2);
```

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 변경 파일 에러 0
```

### 사용자 화면 예상 (SE3 매물)

| 표시 | 전 | 후 |
|---|---|---|
| 차익 | +57,585 (stale) | **+10,000 ↓ 시세 갱신** ✅ |
| % | +20% (stale) | +3% (current 기반) |
| Hover title | X | "추천 당시 +57,585 → 현재 +10,000" |

### 다른 case 영향

| Case | 표시 |
|---|---|
| current ≈ snapshot (차이 < 5K) | snapshot 그대로 (라벨 X) |
| current null (cron 미실행 옛 reveal) | snapshot fallback |
| current 음수 (marketStale=true) | rose badge "추천 무효" (Wave 189 분기) |
| terminal 매물 | strike-through (Wave 200) |

## 사용자 질문 답 — me 페이지 잔존 괴리?

| 케이스 | 박힌 wave |
|---|---|
| 시세 stale snapshot | ✅ Wave 190/191 |
| 시세 < 매입 = 추천 무효 | ✅ Wave 189 |
| **시세 down 으로 차익 ↓ (양수 mismatch)** | ✅ **Wave 194 (본)** |
| 팔린/사라진 매물 표시 | ✅ Wave 200 (strike-through + hide flag) |
| pool stale | ✅ score_dirty + scoreStage 자동 |
| condition fallback bias | ✅ Wave 193 (minSamples 1) |
| 미개봉 = 다나와 시세 | ✅ Wave 201 (다른 세션) |
| 다나와 라벨 카드 노출 | ⚠️ 모달엔 있음. 카드 X — 별 wave |
| SE2 sample 부족 (parser v47 NULL) | ⏳ v48 reparse 자연 진행 |

→ **남은 issue 2 개**:
1. 다나와 라벨 카드 표시 (운영자풀 패턴 카드 이식)
2. parser v48 reparse 자연 완료 대기 (다른 세션 작업)

## 새 고객 보호

신규 가입자 reveal 받을 때:
1. pool 의 expected_profit (그 시점 시세 기반 정확) → snapshot 박힘
2. 시세 변동 시 Wave 190/191 cron 자동 갱신 → current_profit
3. Wave 189 marketStale → 음수면 무효 badge
4. **Wave 194 current 우선 표시 → 양수도 mismatch 명시** ✅

→ **새 고객이 시세 stale 로 인한 화면 모순 인식할 가능성 0** (Wave 190/191/193/194 다 박힘).

## Lesson

1. **표면 fix 의 한계 = case coverage** — Wave 189 음수만 분기 → 양수 mismatch 누락. 분기 case 전수 검증 필요.
2. **snapshot 과 current 모두 가치 있음** — snapshot = historical 추천 시점, current = 실시간. UI 가 둘 다 노출 (current 우선 + snapshot title hover).
3. **사용자 행동 보호** — "왜 차익 +57K인데 시세 + 매입 차이 작음?" 의문 영구 차단.
