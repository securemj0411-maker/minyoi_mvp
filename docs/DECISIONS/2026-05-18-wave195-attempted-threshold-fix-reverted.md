# Wave 195 — 신발 threshold 변경 시도 후 revert + 진짜 원인 발견 (2026-05-18)

## 배경

사용자: "1만 5천원도 택배비/수수료/안전버퍼 다 감안한 차익이면 할 만함"

→ Wave 193 audit에서 Option A (신발 profit threshold 20K → 15K) 박으려 함.

## 시도

`src/lib/profit.ts:bandFromProfit()` 변경:
- 신발 카테고리는 band 1 threshold 15K
- 다른 카테고리는 20K 그대로

`src/lib/candidate-pool-builder.ts` 호출부에 category 인자 전달.

## 발견 — 변경 시도 자체가 무의미

코드 두 군데에 `bandFromProfit` 박혀있음:
1. `src/lib/profit.ts` — **dead code** (어디서도 import 안 됨)
2. `src/lib/pool-policy.mjs` — **실제 사용처** (candidate-pool-builder가 여기서 import)

`pool-policy.mjs` 의 실제 threshold:
```js
if (avg >= 70_000) return 3;
if (avg >= 40_000) return 2;
// Wave 90 (2026-05-15): 1만 게이트로 lower. 배송비/수수료 net 1만 차익이면 사용자 가치.
if (avg >= 10_000) return 1;
return null;
```

**이미 10K threshold 박혀있음** (Wave 90 사용자 결정). 사용자가 "15K도 할 만함" 한 그것보다 **더 낮음**.

## Revert

profit.ts / pool-policy.d.ts / candidate-pool-builder.ts 변경 모두 revert. dead code는 그대로 둠 (별도 cleanup wave).

## 진짜 원인 — 신발 시세 비현실적 낮음

신발 시세 daily sweep:

| SKU+사이즈+condition | sample | median | p25 | p75 |
|---------------------|--------|--------|-----|-----|
| dunk_low 230 mint | 8 | **30K** | 27K | 62K |
| chuck70_high 230 mint | 8 | **32K** | 25K | 48K |
| dunk_low 275 b_grade | 10 | 46K | 40K | 75K |
| gazelle_og 230 mint | 9 | 55K | 50K | 79K |
| 2976_chelsea 230 b_grade | 9 | 64K | 55K | 95K |
| chuck70 230 a_grade | 8 | 73K | 49K | 100K |
| dunk_low 280 mint | 13 | 110K | 100K | 149K |
| dunk_low 270 mint | 16 | 96K | 65K | **179K** |

**문제 패턴**:
1. **p25~p75 spread 2~3배** — 같은 SKU+사이즈+condition인데 가격 분산 매우 큼
2. **가품/특가 매물이 sample에 끼어들어** median 끌어내림
3. **정상가 매물은 시세보다 비싸 보여 profit_below_pack_band 차단**

매물 sample 비교:
- 닥터마틴 첼시부츠: 매물가 120K, 시세 64K → gap **-56K**
- 나이키 덩크로우 코스트: 매물가 150K, 시세 74K → gap **-76K**

차익 음수 = 어떤 threshold (10K도) 못 넘음.

## 정책 결정 필요 (사용자 판단)

진짜 fix 옵션:

### Option α — 신발 가품 floor 강화

현재 (Wave 141~155):
- tier 1: price < msrp × 15% → 가품 확실 차단
- tier 2: price < msrp × 25% + 셀러 신뢰도 ↓ → 가품 의심
- tier 3: price < msrp × 30% + 이미지 1장 + desc 50자 미만 → 가품 의심

**제안**: 신발 시세 sample에 들어가는 매물 가품 floor 더 strict (예: 30% → 50%).
영향: 시세 sample 더 깨끗해짐 → median 정상화 → 정상가 매물 풀 진입 가능.
위험: 진짜 저가 매물 (사용감 큰 매물) 도 차단 가능.

### Option β — condition_class 더 strict 분리

현재 mint / clean / worn / normal / unopened / flawed 분리. 하지만 신발은 mint 정의가 "사용감 거의 없음" 인데 sample에 mint 표기 가품 다수.

**제안**: 신발 mint 시세 sample에 추가 검증 (예: 셀러 review_count >= 20, 가격 >= msrp × 40%).
영향: mint 시세 sample 정정.

### Option γ — 시세 confidence 활용 강화

현재 confidence: high/medium/low. low confidence 시세는 일부 게이트 차단.

**제안**: 신발 카테고리는 confidence=low + p25/p75 spread > 2x 시 trustedMarketMedian 차단.
영향: 분산 큰 시세는 사용 안 함 → 정확성 ↑.

### Option δ — 현 정책 유지 + 신발 catalog 확장

mainstream brand SKU 더 박아 raw 매물 다양성 ↑ → 가품 비율 분산 자연 감소.

### Option ε — admin UX 보강

신발 시세 SKU별 sample 분포 + 분산 표시. 사용자가 시세 신뢰도 직접 판단.

## 추천

**Option α + γ 조합**: 신발 가품 floor 강화 (sample 정정) + low confidence + 큰 spread 시세 차단. 사용자 정책 (§12b 정확성 우선) 일관.

**사용자 결정 필요** — 자율 진행 안 함.

## 자기 평가

또 잘못 진단:
1. `src/lib/profit.ts` 만 보고 "20K threshold" 라고 사용자한테 답함
2. 실제 사용처 `pool-policy.mjs` 안 확인. dead code vs live code 구분 못 함
3. 사용자가 "band 1/2/3 안 쓴다" 정정해서 다시 보니 발견
4. 같은 실수 재발 방지: 정책 함수 변경 전 **callsite grep 먼저** 박기. import path 다양한 (.ts / .mjs / .d.ts) 라이브러리는 특히 주의.
