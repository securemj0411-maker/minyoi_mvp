# Wave 266b — 번개장터 API deep sweep 학습 → broad SKU contamination fix

**날짜:** 2026-05-20
**Owner:** MJ (사용자 명령)
**Trigger:** 사용자 정정 "db sweep이 아니라 번개장터 api deep sweep하고 우리 있는 sku, lane 학습용 카탈로그 보강 및 파서 강화 학습 하라했는데"

## 차이 — Wave 266 vs 266b

| | Wave 266 (1차, 잘못 이해) | Wave 266b (사용자 의도) |
|--|--|--|
| Sweep source | `mvp_raw_listings` DB | 번개장터 API 직접 호출 |
| 데이터 신선도 | 우리가 이전 fetch한 stale | 현재 live 매물 풀 |
| 학습 가능 | 우리 DB 한정 | catalog SKU/lane 별 fresh sample |

## 실행

**Script:** `scripts/wave266b-bunjang-api-deep-sweep.ts`
- catalog 414 fashion SKU iterate
- 각 SKU별 search query 만들어 `searchPage(query, page=0, n=96)` 호출
- 각 매물에 `ruleMatch()` 적용 → TP / contamination / unmatched 분류
- parser 적용 → product_type 정확도 측정
- 250ms throttle (API 부담 방지)
- 학습 report → `docs/AUDIT_LOG/2026-05-20-wave266b-bunjang-api-deep-sweep.json`

**결과:**
- 414 SKU / **33,287 매물** 검사
- TP 14,951 (46%)
- Unmatched 14,656
- Type Unknown 33,287 (script bug — productType field name 잘못 박힘, 다음 wave fix)

## 발견 — Broad SKU contamination (1,300+ 매물)

API sweep으로 우리 Wave 266 broad SKU가 narrow SKU 매물을 잡아채는 패턴 발견:

| Broad SKU | 건수 | 원인 |
|--|--|--|
| `bag-gucci-broad` | 229 | 오피디아/디오니소스/jackie/마몽 슈퍼미니/GG 캔버스 쇼퍼 등 narrow 매물 catch |
| `bag-prada-broad` | 209 | 리나일론 크로스/슬링백/사피아노/포코노 catch |
| `bag-lv-broad` | 203 | LV 티볼리/조쉬 (narrow 없는 모델 → 정상) |
| `bag-celine-broad` | 92 | 트리옹프/클로드 narrow catch |
| `bag-thombrowne-broad` | 71 | 반팔티/티셔츠 (의류!) catch |
| `bag-margiela-broad` | 64 | 5AC large/medium (mini 외 narrow) catch |
| `bag-cdg-broad` | 56 | PVC 가방 catch |
| `shoe-gucci-broad` | 57 | bag query 매물 catch (가방인데 broad가 shoe로 잡음) |
| `shoe-nike-cortez-broad` | 62 | Sakai x Cortez 콜라보 catch |
| `clothing-polo-apparel-broad` | 75 | 빅포니/옥스포드/피케 narrow catch |

## Fix — Wave 266b catalog patch

각 broad SKU mustNotContain 강화:

### `bag-gucci-broad`
추가: 오피디아/ophidia, 마몽 슈퍼미니/백팩, GG 마몽, 재키, GG 캔버스 쇼퍼/토트, 수프림 캔버스, 혹스턴, 실비, 뱀부

### `bag-prada-broad`
추가: 리나일론/re-nylon, 사피아노/saffiano, 테수토/tessuto, 포코노/pocono, 갈레리아/galleria, 심볼, 트라이앵글, 클리오

### `bag-celine-broad`
추가: 트리옹프/triomphe, 클로드, 벨트 백, 16 백, 보스턴 백

### `bag-thombrowne-broad`
추가: 반팔/반팔티/티셔츠/tee/후드/맨투맨/포켓 반팔/포켓 티

### `bag-margiela-broad`
추가: 5ac (전 사이즈), 글램 슬램/glam slam, 재팬 백, 반팔/반팔티

### `bag-cdg-broad`
추가: pvc, 반팔/반팔티

### `shoe-gucci-broad`
강화: 가방/백팩/토트/숄더/크로스백/포셰트/pochette (bag query 결과 차단)

### `shoe-nike-cortez-broad`
추가: sakai/사카이 (콜라보 차단)

### `clothing-polo-apparel-broad`
추가: 빅포니/big pony/포니, 옥스포드 셔츠/oxford shirt, 피케 폴로/pique (narrow 우선)

## 한계 — 다음 Wave 267 작업

### Script 보완 필요
1. **Query picking** — Jordan SKU 들이 modelName 첫 단어로 "Nike Air" query 사용 → 96 매물 다 unmatch. 더 specific query 필요 (e.g. "조던 1 high chicago lost and found")
2. **Parser productType field** — `parsed.json.product_type`로 박혔지만 script가 wrong key. type_unknown 100% 잘못 보고.

### 진짜 누락 catalog 후보 (top unmatched tokens):
- 나이키 503 / 아디다스 378 / 뉴발란스 201 / 살로몬 142 / 노스페이스 120 / 구찌 120 / 슈프림 109 / 폴로 93
- → brand keyword만 있는 매물 ~1500건 (모델 모르는 매물 catch는 한계)
- 자켓 161 / 스니커즈 158 / 반팔 92 — product type 명시만 있는 매물 (catalog 매칭 불가)

### Production 영향
- Wave 266b fix는 catalog only (parser bump 없음)
- Vercel build 후 새 매물부터 broad contamination 차단
- 기존 매물은 parserDriftStage가 자동 score_dirty 표시 → 점진 reparse

## 사용자 명령 정확 인용

"db sweep이 아니라 번개장터 api deep sweep하고 우리 있는 sku, lane 학습용 카탈로그 보강 및 파서 강화 학습 하라했는데"

→ **DB sweep ≠ API sweep**. API deep sweep으로 fresh 매물 풀에서 우리 catalog 정확도
   측정 → 1,300+ broad contamination 발견 → mustNotContain 강화로 fix.
