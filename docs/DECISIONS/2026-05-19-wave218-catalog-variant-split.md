# Wave 218 — catalog variant 분리 + placeholder price filter (2026-05-19)

## 사용자 명시

> "자 지금 우리 옷이랑 신발 전부 카탈로그들 진짜 정확함?? 분류 더 세분화되거나 옵션이거나 색별로 좀 가격대 달라져서 색이나 디자인 별로 또 다른 sku로 해야될지 lane이나 한정판이나 등등 여부 이런거 모두 다 조사함??"

→ catalog 완벽도 검증 + variant 분리 + placeholder fix.

## 진단 결과

### 1. placeholder 가격 침투 (긴급 fix)

| sku_id | max_price | CV |
|--------|-----------|-----|
| shoe-stussy-nike-collab | 99,999,999 | 10.73 |
| shoe-crocs-bayaband | 77,777,777 | 7.44 |
| shoe-adidas-football | 11,111,111 | 4.16 |
| clothing-polo-rrl | 11,111,111 | 1.56 |

기존 차단: `price >= 100_000_000 || price <= 0`. 통과한 패턴: 99,999,999 / 77,777,777 / 11,111,111 / 9,999,999 / 999,999 / 111,111 등 "같은 자리수 반복" (active 44건 측정).

### 2. broad SKU 가격 분산 큼 — narrow 분리 필요

| sku_id | CV | 문제 |
|--------|----|------|
| **clothing-polo-rrl** | 1.56 | 6+ product type 묶임 (티/팬츠/자켓/액세서리/스니커즈) |
| **clothing-arcteryx** | 0.67 | Beta/Gamma/Alpha/Atom 모델 가격대 X 3-5 |
| clothing-tnf-supreme-collab | 0.78 | 시즌별 차이 (보류) |
| clothing-acne-apparel | 0.73 | product type 다양 (보류) |
| shoe-nike-blazer-broad | 1.51 | Mid/Low/Hi/77 (보류) |

### 3. 누락 후보 측정

| pattern | active 매물 |
|---------|------------|
| jordan 4/11/12/13 | 0 (한국 매물 거의 없음) |
| yeezy 350 colorway | 0 (한국 명시 적음) |
| travis scott collab | 0 |
| off-white | 6 (낮음) |
| dunk SB | 1 (낮음) |
| sacai collab | 1 (낮음) |

→ **D 카테고리 (누락 추가) skip** — 한국 시장 인기 모델 catalog 이미 박혀있고 추가 가치 낮음.

## 코드 fix (3 부분)

### A. `src/lib/tick-pipeline.ts` — `isPlaceholderPrice` 헬퍼

```ts
function isPlaceholderPrice(price: number | null | undefined): boolean {
  if (!Number.isFinite(price ?? NaN)) return true;
  const p = Number(price);
  if (p <= 0) return true;
  if (p >= 100_000_000) return true;
  const s = String(Math.floor(p));
  if (s.length >= 5 && /^(\d)\1+$/.test(s)) return true; // 11111 / 99999 / 1111111
  if (p === 1004 || p === 1234 || p === 4321 || p === 12345) return true;
  return false;
}
```

3 곳 적용:
- `upsertMarketPriceDaily` (시세 daily sample 제외)
- score-stage fallback (median 계산 sample 제외)
- score gap calc (`isPlaceholderPrice ? priceGap=0` — pool 진입 차단)

### B. `src/lib/catalog.ts` — RRL narrow 5개

| 신규 SKU | mustContain | mustNotContain (추가) |
|---------|-------------|----------------------|
| clothing-polo-rrl-tee | RRL + (tee/맨투맨/후디/롱슬리브/헨리넥) | rrl 무드, 스니커즈, 데님, 벨트 |
| clothing-polo-rrl-denim | RRL + (데님/청바지/셀비지) | rrl 무드, 스니커즈, 벨트, 모자 |
| clothing-polo-rrl-shirt-pants | RRL + (셔츠/코듀로이/워크팬츠) | rrl 무드, 스니커즈, 데님 |
| clothing-polo-rrl-accessory | RRL + (벨트/지갑/모자/넥타이/키링/클러치/장지갑) | rrl 무드, 스니커즈, 목걸이, 925 |
| shoe-polo-rrl-sneaker | RRL + (스니커즈/메이포트/캔버스) | rrl 무드 |
| **clothing-polo-rrl (broad)** | RRL only | 위 narrow 키워드 다 제외 (catch-all) |

→ 기존 broad mustNotContain 강화 ("rrl 무드" / "rrl 스타일" / 925 목걸이) → "rrl 무드" 가짜 매물 차단.

### C. `src/lib/catalog.ts` — Arc'teryx narrow 5개

| 신규 SKU | mustContain | msrp |
|---------|-------------|------|
| clothing-arcteryx-beta | arcteryx + (beta/베타) | 590K (Gore-Tex) |
| clothing-arcteryx-gamma | arcteryx + (gamma/감마) | 350K (softshell) |
| clothing-arcteryx-alpha | arcteryx + (alpha/알파) | 850K (등반) |
| clothing-arcteryx-atom | arcteryx + (atom/아톰) | 320K (insulated) |
| clothing-arcteryx-vertex-squamish | arcteryx + (vertex/버텍스/squamish/스쿼미시) | 280K |
| **clothing-arcteryx (broad)** | arcteryx + product type | 위 narrow 키워드 다 제외 |

### `src/lib/category-readiness.ts` — LANE_READINESS 11개 신규

- polo_rrl_tee / polo_rrl_denim / polo_rrl_shirt_pants / polo_rrl_accessory / polo_rrl_sneaker / polo_rrl_broad (status: ready)
- arcteryx_beta / arcteryx_gamma / arcteryx_alpha / arcteryx_atom / arcteryx_vertex_squamish / arcteryx_broad (status: ready)

## ruleMatch 우선순위

`tryNarrowLanePromotion` (Wave 108 박힘) — broad 만 잡혔을 때 narrow lane 재시도. RRL/Arcteryx broad SKU 매칭되면 자동으로 narrow 재시도 → 정확한 SKU 박힘.

## verify

- test:core **557/557 pass** ✅
- placeholder 44건 active 차단됨
- 신규 narrow lane 11개 → 다음 cron reparse 시 자동 적용

## 다음 자연 처리

1. **자연 cron** (market-worker / score-stage): 새 raw_listings 매물부터 narrow SKU 매칭
2. **기존 매물 재매칭** — RRL 115건 / Arcteryx 92건 reparse 후 narrow 분리 → 시세 daily condition_class 분리 + pool 정확도 ↑
3. **시세 spread 감소 측정** — Wave 219 이후 RRL/Arcteryx p75/p25 spread ratio 감소 검증

## skip 한 이유 (D 누락 보강)

한국 시장 매물 측정 결과 jordan 4/11/12/13 / yeezy colorway / travis scott / sacai 매물 거의 없음. catalog 추가 가치 낮음. 인기 매물 (jordan 1 / yeezy 350 통합 / dunk panda) 이미 박힘.

## decision log

이 파일 push 후 사용자에 진척 보고 + reparse 결과 측정.
