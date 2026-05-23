# Wave 751-752 Pareto Systemic Cycle

**날짜**: 2026-05-24
**Owner**: Claude (사용자 명시 "파레토법칙에 해당되는 롱테일들 먼저 다 하자")
**Status**: 24-48h verification 대기

## 개요
Wave 727-750 catalog cycle 후속. Pareto long-tail focus — biggest-impact fix가 우선.
catalog tweak (1-100건 단위) → systemic parser bump (135K 매물) 까지 escalate.

## Wave 751a — 전자기기 + 신발 Pareto 8 SKU
Top spread SKU (1818x ~ 18000x) bias-free audit:

| SKU | Spread | 차단 |
|-----|--------|------|
| clothing-champion-apparel-broad | 1818x | Coach/Darkroom/Vetements collab + 90s vintage + 만원샵 |
| iphone-14-pro / iphone-16-pro | 18000x / 4444x | 사제수리/대용량 배터리/어프어프 case brand |
| macbook-pro | 4400x | 키보드가드/공박스/조이룸 도킹/사봐요 구매글 |
| ipad-air | 3846x | 1세대(2013)/2세대(2014) 9년 정책 + 교환 dummy |
| airpods-pro-3 | 1250x | 분실/찾기/사례 lost & found + 어프어프 콜라보 |
| galaxy-s25 | 838x | GTS250 NVIDIA GPU false match + 그래픽카드 |
| shoe-crocs-classic-clog | 380x | BAPE/Salehe Bembury/Balenciaga 한정 협업 |
| shoe-adidas-football | 960x | 골키퍼 장갑 false match + 가격제안 bait |

## Wave 751b — 추가 5 SKU 보강
- Switch V1 307x: 메탈걸쇠/조이콘 핸드그립/스트랩/FIFA·마리오카트 게임 카트리지
- iPad Mini 333x: 백팩/복조리백/호환 키보드
- Galaxy S26 545x: Chanel SS26 시즌 코드 + 붕스 키레네 오르골
- Mizuno Alpha 700x: "(가격 제시)" placeholder bait
- 신규 brand 보강 (이전 batch에 묻혀있던 패턴들)

## Wave 751c — 의류 Pareto 2 SKU
- Arcteryx LEAF 350x: 전술배낭/DryPack/포치 (가방 false match)
- Supreme apparel broad 46x: Vanson Leathers/B.B. Simon/스터드 퍼퍼/페더웨이트/코듀라 premium collab + 11ss~19fw 시즌 코드 추가

## Wave 751d — Dyson V-series 76 매물 신설 (catalog gap!)
신규 SKU 3개:
- `dyson-v15-detect` (msrp 900K, 2021): V15 Detect/Submarine — 33건
- `dyson-v12-detect` (msrp 700K, 2021): V12 Detect Slim/Submarine — 43건
- `dyson-v8-v11-vacuum-broad` (msrp 500K, 2018): V8/V10/V11 구형 broad

기존 Dyson SKU: Airwrap/Supersonic/Corrale (헤어케어/고데기)만 — 청소기 broad 없었음.
category_readiness 3 entry 등록.

## Wave 752 — title_triage v2→v3 systemic bump (135K reparse 큐)

### 🔥 CRITICAL DISCOVERY
Audit:
- 215,046 매물 listing_parsed 아예 없음 (NEVER parsed)
- 141,582 of these are from the last 7 days
- 7일 내 135,427 matters `detail_status='skipped'` (sku_id 9.4%만 매칭)
- 67,077 detail=done 중 20,945 sku_id NULL (31% leak)

### Sample 검증
"skipped"인데 catalog match 가능한 매물:
- "Nike Air Max BW" (220K)
- "adidas 슈퍼스타 스칼렛 한정판 정품" (150K)
- "NIKE DUNK LOW CHAMPIONSHIP GOLDENROD OG" (79K)
- "Palace Adidas fleece jacket" (180K)
- "adidas 패딩 SIZE: 85" (29K)

이런 매물들이 title_triage_v2 단계에 stuck. Wave 713의 v1→v2 (168K reparse) 패턴 재실행.

### Fix
`TITLE_TRIAGE_SKIP_VERSION = "title_triage_v2"` → `"title_triage_v3"` (1 line change).

`isCurrentTitleTriageSkip()`이 detail_error에 prefix "title_triage_v3:" 확인. v2 prefix는 이제 stale → 매물 재처리 큐 박음.

cron이 점진적으로 detail 갱신 + parse → sku_id 매칭. **135K 매물 잠재적 회수**.

## Files Touched
- `src/lib/catalog.ts` — PHONE_NOISE/LAPTOP_NOISE/HEADPHONE_NOISE 확장, iPad Air/Mini broad, Galaxy S26 broad, Switch V1, Mizuno Alpha, Adidas Football, Crocs Classic + 신규 Dyson V12/V15/V8-11
- `src/lib/generated/catalog-wave266-clothing.ts` — Champion broad + Supreme apparel broad
- `src/lib/generated/catalog-715-clothing-narrow.ts` — Arcteryx LEAF
- `src/lib/category-readiness.ts` — Dyson V-series 3 entry 등록
- `src/lib/tick-pipeline.ts` — TITLE_TRIAGE_SKIP_VERSION v2→v3 (1 line)

## Pending verification (24-48h 후)
- title_triage_v3 reparse 진행률 측정 (`detail_status='skipped' WHERE detail_error LIKE 'title_triage_v2:%'` 감소 추세)
- 매물 매칭률 baseline → 회복 측정 (현재 9.4% → 30%+ 예상)
- spread 재측정 (Wave 751 차단 효과)
- Dyson V-series pool entry (3 신규 SKU)

## Pareto 인사이트 (이번 cycle 발견)
1. **Catalog tweak < parser bump**: 단일 systemic fix가 135K 매물 영향 — 수십 SKU 보강보다 임팩트 큼
2. **title_triage 버전 bump 주기**: 매 catalog cycle (15+ SKU 신설) 마다 권장
3. **detail_status='skipped' 모니터링**: 신규 catalog 인지하지 못하는 stuck 매물 빠르게 감지
4. **명품 가방/luxury skip**: 사용자 정책 "명품은 안할 생각임" + "가방 ready안할거임" 준수 — 시간 낭비 방지
5. **Parser drift vs catalog miss 구분**: 같은 brand 내에서도 분리 — drift는 reparse cron, miss는 catalog 보강

## Outstanding
- Galaxy S22/S23/iPhone SE 등 parser drift (Wave 743b 매핑 완료, cron 진행 중)
- 명품 SKU (LV/Dior/Chanel) — 사용자 정책 skip
- Logitech/Xiaomi 작은 brand long-tail — Pareto 임팩트 작음
- Wave 752 v3 bump 효과 측정 후 v4 추가 cycle 가능
