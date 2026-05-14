# Wave 91 — 일반인 친화 카테고리 확장 (신발/가방/자전거 106 SKU)

> Status: **applied (code + DB).** 110 narrow SKU + 3 카테고리 sweep + 가품/사고차 가드. resale ≤200만 cap. internal_only 시작.

CLAUDE.md 6 필드 포맷.

## 0.1 신발/가방/자전거 카테고리 진입

- 시간: 2026-05-15 06:00 KST
- 발견: Wave 88 카테고리 sweep으로 번장 내부 lever 거의 소진. owner 결정 — 일반인 친화 + 차익 가능한 비테크 카테고리로 확장. 3개 에이전트 병렬 조사 (KREAM/StockX/공식 사이트 + 트렌비/머스트잇/Vestiaire/자이언트·트렉·캐논데일 공식) 후 106 SKU 정의.
- 변경:
  - `src/lib/catalog.ts`: category union에 `"shoe" | "bag" | "bike"` 추가. SHOE_CATALOG (39) + BAG_CATALOG (34) + BIKE_CATALOG (33) import + spread. 모든 SKU `marketPriceKrwRange` resale ≤200만 검증 통과 (자본 천장 준수).
  - `src/lib/generated/catalog-{shoe,bag,bike}-wave91.ts` 신규 — agent JSON에서 변환.
  - `src/lib/pipeline-config.ts` `DEFAULT_CATEGORY_SWEEPS`:
    - 추가: `405 신발` (스니커즈 24만 매물), `430 가방/지갑` (입문명품+빈티지), `700350 자전거` (99k 매물 — 700 broad는 골프 외 99% noise라 narrow sub-id 사용).
    - 제거: `910 스타굿즈`, `990 예술/희귀` (마니아 시장 → 일반인 친화 X. 분석 미적용으로 wave90에 박혔던 것 cleanup).
  - `src/lib/search-query-cadence.ts` `CATEGORY_SWEEP_FAMILY` 매핑 추가: 405→shoe, 430→bag, 700350→bike.
  - `src/lib/category-readiness.ts` 신규 카테고리 3개 `internal_only` 등록. minReadyPool 8~10, minParseRate 0.8~0.85.
  - DB UPDATE: `mvp_search_queries`에서 `category:910`/`category:990` `enabled=false` (reason='wave91_consumer_unfriendly_mania').
- 검증:
  - `npx tsc --noEmit` clean
  - `npm run test:core` 139/139 pass
  - Boost diag (`scripts/wave91-shoe-bag-bike-boost-diag.ts`, page 0~2 × 3 카테고리 = 864건):
    - 신발 1.4% (한정판 catalog 자연 결과)
    - 가방 5.9% (보테가/마르지엘라/MCM/프라다/LV/토리버치/마이클코어스 매칭)
    - 자전거 1.0% (스페셜라이즈드 알레 / 메리다 스컬트라 매칭)
  - parser는 신규 카테고리 미지원 → 모든 매칭 needsReview → pool 진입 X → 사용자 노출 X (internal_only + parser gap 이중 가드).
- 위험: 낮음.
  - **가품 위험 ↑↑↑** (특히 가방 - LV 빈티지/MCM/구찌 마몽). 모든 SKU `mustNotContain`에 `"미러/짭/A급/이미테이션/복각/오라리"` 박음. internal_only 유지로 사용자 노출 차단.
  - **도난 자전거 위험** (Brompton 1순위). reasoning에 시리얼 확인 가이드 명시. 사용자 노출 시 UI 가이드 필요.
  - false positive 1건 발견 ("엔진11 자전거 + 에어팟 교환" 게시물이 airpods-pro-3 SKU 매칭). 0.1% 미만이라 모니터링.
- 다음:
  - 1주 측정 (`reports/wave91-shoe-bag-bike-boost-diag-latest.json` 갱신) → SKU별 raw 누적 + 가품 사례 식별.
  - wave92: parser 신규 카테고리 처리 추가 (shoe/bag/bike option-parser branch).
  - wave93: ready 승격 검토 (minReadyPool 통과 시 + 가품 가이드 UI 박은 후).

## 0.2 200만 cap 검증

- 시간: 2026-05-15 06:00 KST
- 발견: owner 명시 "200만원 이하". 자본 천장 = 일반인 한 매물 자본 회수 가능 한계.
- 변경: agent 조사 결과의 `marketPriceKrwRange` 상한값으로 자동 필터. 변환 스크립트(`/tmp` JSON → `catalog-*-wave91.ts`)에서 hi > 200만 매물 자동 skip.
- 검증: 106 SKU 모두 통과 (skipped 0). 신발 30-150만, 가방 15-200만 (LV 스피디 등 일부 상한 근접), 자전거 60-180만.
- 위험: 빈티지 가방 시세 변동성 ↑. retail 정보와 marketPriceKrwRange 시세 분리 → resale로 cap 적용 (retail 200만+도 중고 200만 이하면 OK, 예: 자이언트 TCR retail 299만 → 중고 120-170만).
- 다음: 1주 후 실제 매물 price 분포 측정. 200만 cap 자동 차단은 pool-policy에서 별도 처리.

## 0.3 910/990 cleanup (잘못된 wave90 적용 정정)

- 시간: 2026-05-15 06:00 KST
- 발견: wave90 적용 (다른 에이전트)에 910(스타굿즈)/990(예술·수집품)/800(생활·주방)이 sweep에 박혔는데, 같은 wave 분석은 "910/990 마니아 시장 → skip" 결론. 적용과 분석 conflict.
- 변경: 910/990 sweep 제거 (코드 + DB enabled=false). 800은 측정 부족으로 보류 (wave92 검토).
- 검증: DB 2 row disable 확인.
- 위험: 없음 (사용자 노출 단계 이전 cleanup).
- 다음: 800 카테고리 별도 측정 (생활/주방 = 스타벅스 시즌 텀블러/콜라보 한정 잡힐 가능성 — 셀러 시세 인식 ↑↑인지 측정 필요).

## 1. 카테고리 sweep 상태 (Wave 91 후)

| ID | 카테고리 | family | 상태 | 비고 |
|---|---|---|---|---|
| 600100 | PC/노트북 | laptop | active | Wave 88 |
| 600300 | 카메라/DSLR | camera | active | Wave 88 |
| 600500 | 오디오/영상 | earphone | active | Wave 88 |
| 600600 | 게임/타이틀 | game_console | active | Wave 88 |
| 600700 | 휴대폰 | smartphone | active | Wave 88 |
| 600710 | 태블릿 | tablet | active | Wave 88 |
| 600720 | 워치/밴드 | smartwatch | active | Wave 88 |
| 421 | 시계 | watch | active | Wave 88 |
| 610 | 가전제품 | home_appliance | active | Wave 88 |
| 700600 | 골프 | sport_golf | active | Wave 88 |
| **405** | **신발** | **shoe** | **active** | **Wave 91 신규** |
| **430** | **가방/지갑** | **bag** | **active** | **Wave 91 신규** |
| **700350** | **자전거** | **bike** | **active** | **Wave 91 신규** |
| 910 | 스타굿즈 | — | **disabled** | wave91 cleanup |
| 990 | 예술/희귀 | — | **disabled** | wave91 cleanup |
| 800 | 생활/주방 | — | active | 보류 (측정 부족) |

→ **활성 sweep 13개** (테크 10 + 일반인 친화 3 + 800 보류).

## 2. Catalog 카테고리 readiness (Wave 91 후)

| 카테고리 | 상태 | SKU 수 |
|---|---|---:|
| earphone / smartwatch / tablet / laptop / desktop / monitor / speaker / home_appliance | ready | 기존 |
| sport_golf / watch | ready (Wave 86) | 기존 |
| smartphone / game_console / camera | internal_only | 기존 |
| **shoe / bag / bike** | **internal_only (Wave 91)** | 39 / 34 / 33 |
| small_appliance | blocked | 기존 |

→ 사용자 노출 카테고리 10개 (변화 없음). shoe/bag/bike는 internal_only로 시작 — parser 추가 + 측정 후 ready 검토.

## 3. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류.
- 카메라 ready 재검토 — Wave 87 자연 대기 1~2주 그대로.
- 마니아 카테고리 (910/990) 재진입 — 일반인 친화 원칙 위반.
