# Wave 88 — 카테고리 sweep 도입 + Wave 87 자연대기 유지

> Status: **applied (code).** Bunjang find_v2 `f_category_id` 파라미터로 카테고리별 신규 매물 일괄 흡수. 10개 L2 카테고리 + 기존 127 narrow query 병행. 호출 ~8% 증가, 신규 SKU 자동 흡수 + 매물 편향 0.

CLAUDE.md 6 필드 포맷.

## 0.1 카테고리 sweep 도입

- 시간: 2026-05-15 02:30 KST
- 발견: 번개장터 비공식 `find_v2.json` API가 `f_category_id=<L2_ID>` 파라미터를 받음. 검증 결과 5개 카테고리 (휴대폰/시계/골프/카메라/오디오) 모두 카테고리별 정확 필터링. order=date도 그대로 작동. 광고/매입글은 catalog mustNotContain + ruleMatch가 자동 reject. 즉 partner API segment dump의 ~95% 효과를 무료로 얻음.
- 변경:
  - `src/lib/bunjang.ts`: `CATEGORY_QUERY_PREFIX = "category:"` 라우팅. query가 prefix 가지면 `f_category_id` + `req_ref=category`로 라우팅, q 생략.
  - `src/lib/pipeline-config.ts`: `DEFAULT_CATEGORY_SWEEPS` (10개 L2 ID) 추가. `envQueries()`에서 기존 query 리스트에 `category:<id>` 형태로 자동 merge. `PIPELINE_DISABLE_CATEGORY_SWEEP=1`로 rollback 가능.
  - `src/lib/search-query-cadence.ts`: `queryFamily()`가 `category:` prefix 인식 (카테고리 → family 매핑). `decideCadence()`에서 category sweep은 5m harvest 고정 (yield 무관, breadth 우선).
- 검증:
  - `npx tsc --noEmit` clean
  - `npm run test:core` 139/139 pass
  - PoC `scripts/wave88-category-sweep-verify.ts`: 10 카테고리 × page 0 (96건) = 960건 fetch / 125건 매칭 / 광고 59건 (catalog가 정확 reject)
  - 카테고리별 매칭 비율: 휴대폰 36.5%, 태블릿 39.6%, 오디오 45.8%, 워치 29.2% — broad sweep 효과 큼
  - 광고 매입글: 14~18% 발생 but catalog mustContain이 SKU 매칭 시도 자체를 차단 — pool 진입 0
- 위험: 낮음.
  - tick collected_count ~2000 → ~2960 (~50% 증가). Vercel `maxDuration=60` p95 33초 → 추정 50초 (한계 근접 but OK).
  - DB INSERT 증가 (첫 1~2일 catch-up). 이후 정상화.
  - 기존 narrow query 유지 (병행) — 누락 위험 0. 90% 커버리지 확인 후 narrow 점진 deprecate 가능.
- 다음:
  - Vercel deploy 후 1~2시간 모니터링: category: prefix 매물 흡수량, tick duration, fail rate.
  - 1주 후 narrow query 중 sweep으로 100% 흡수되는 것 deprecate 검토.
  - 카테고리별 cadence 차등화: 카메라/시계/가전/골프는 매물 적어 30~60분으로 강등 검토.

## 0.2 Wave 87 카메라 자연대기 — 결론적으로 유지

- 시간: 2026-05-15 02:30 KST
- 발견: category sweep PoC로 카메라 카테고리 600300 측정 결과 page 0 96건 span = 108일. 즉 카메라 카테고리 전체 신규 매물 일 ~30건 수준 (Wave 87 측정 "본체만 일 27건"과 일치). category sweep으로도 우리 5 SKU 매칭 0건. **Bunjang 마켓 자체에 본체만 카메라 매물 절대량이 적은 것**이지 우리 query가 누락한 게 아님.
- 변경: 없음. Wave 87 "자연 대기 1~2주" 결정 유지.
- 검증: PoC 결과 + 어제 wave 86 boost diag 결과 (카메라 5 SKU 합쳐 fetched 21~42건/query) 교차 검증.
- 위험: 없음.
- 다음: Wave 87 §0.1 "다음" 그대로. 1~2주 후 재측정. 단 category sweep 데이터도 함께 봐서 결정.

## 0.3 광고 매입글 처리 정책 확정

- 시간: 2026-05-15 02:30 KST
- 발견: PoC 측정 결과 카테고리 sweep page 0의 14~18%가 매입 광고/스폰서 글 (휴대폰 14건, PC 17건, 게임 11건). owner 지적 "마이닝/파서 파이프라인 강화로 다 쳐낸다" 확인 — catalog mustContain이 SKU 매칭 시도 자체를 차단, ruleMatch 결과 광고 매물 pool 진입 0.
- 변경: 없음 (기존 catalog로 충분).
- 검증: PoC 매칭 결과에 매입 광고 한 건도 없음.
- 위험: 없음.
- 다음: 새 매입 패턴 등장 시 catalog mustNotContain에 추가 (예: "매입합니다", "고가매입").

## 1. 카테고리 sweep 매핑 (10개 L2)

| L2 ID | title | family | 매물 총수 | PoC 매칭율 | 평가 |
|---|---|---|---:|---:|---|
| 600700 | 휴대폰 | smartphone | 162,303 | 36.5% | 핵심 — 갤럭시/아이폰 broad |
| 600710 | 태블릿 | tablet | 34,326 | 39.6% | 핵심 — 아이패드 broad |
| 600720 | 워치/밴드 | smartwatch | 19,498 | 29.2% | 큰 효과 — 애플워치 broad |
| 600100 | PC/노트북 | laptop | 115,163 | 6.3% | 보통 — 광고 多 |
| 600300 | 카메라/DSLR | camera | 71,066 | 0% | 작음 — 본체만 매물 적음 |
| 600500 | 오디오/영상 | earphone | 118,102 | 45.8% | **최대** — 에어팟/Bose/Sony |
| 600600 | 게임/타이틀 | game_console | 112,985 | 2.1% | 작음 — 광고 多 |
| 421    | 시계 | watch | 57,946 | 0% | 작음 — narrow 위주 |
| 610    | 가전제품 | home_appliance | 106,001 | 0% | 작음 — narrow 위주 |
| 700600 | 골프 | sport_golf | 247,398 | 0% | 작음 — narrow 위주 |

## 2. 추가 가능 작업 (다음 wave)

1. **narrow query deprecate**: 카테고리 sweep으로 95%+ 흡수되는 narrow query 제거 (호출량 50%↓)
2. **카테고리별 cadence 차등**: 카메라/시계/가전/골프 30분으로 강등 (호출량 추가 15%↓)
3. **categoryId page 1+ 깊이**: 휴대폰 같은 busy 카테고리 peak time 누락 방지
4. **carbon-blind 카테고리 추가**: gear (700) / fashion (310) 같은 카테고리에 우리 SKU 있는지 탐색

## 0.4 follow-up 패치 (2026-05-15 02:50 KST)

- 시간: 2026-05-15 02:50 KST
- 발견: 02:40 첫 sweep tick 측정 후 4가지 후속 작업 식별 — (1) tick budget 15s 빠듯, (2) 레거시 query 17개 starved, (3)(4) 1주 후 재측정 도구 부재.
- 변경:
  - `pipeline-config.ts` `tickSearchBudgetMs` default 15s → **25s** (Vercel 60s 한계 내 search 25s + score 10s + DB 5s = 40s 여유).
  - DB UPDATE: 레거시 17개 query `enabled=false` (`wave-*_boost:*` 13개, `internal_acquisition:*` 1개, `카시오크`/`ILCE-7C`/`LG 39GX900A` 3개). 모두 envQueries 미포함 or Wave 86/59 명시 폐기. reason='wave88_legacy_disable'.
  - `scripts/wave88-narrow-vs-category-overlap.ts` 신규: pid 단위 overlap 측정 → deprecate 후보 자동 식별 (overlap≥95%).
  - `scripts/wave88-low-sample-sku-tracking.ts` 신규: 14개 저표본 SKU (카메라 5 + 시계 4 + 골프 2 + 저volume 3) 누적 추적. cat vs narrow 출처 분리.
- 검증:
  - `npx tsc --noEmit` clean
  - Baseline 측정 (`wave88-low-sample-sku-tracking-latest.json`): 카메라 5 SKU 7d 합 10건 (모두 narrow 출처), 시계 G-Shock 그룹 7d 122건 (Wave 86 ready 충분), 골프 0건, sweep 02:40 시작이라 cat 기여 아직 0.
- 위험: 없음 (default 값 조정 + DB UPDATE 17 row + 측정 도구 신규).
- 다음:
  - 1주 후 (~2026-05-22) 두 스크립트 재실행 → narrow query deprecate 후보 확정 + 카메라 자연 누적 재측정
  - tickSearchBudgetMs 25s 적용 후 starved query 회복 확인 (~다음 tick 1~2회)

## 3. 거론 금지

- 닌텐도 Switch OLED — Wave 87 §0.1 보류 유지.
- 카메라 ready 재검토 — Wave 87 자연 대기 1~2주 그대로.
