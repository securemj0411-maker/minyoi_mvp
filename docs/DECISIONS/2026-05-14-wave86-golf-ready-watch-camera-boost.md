# Wave 86 — 골프 ready 승격 + 시계/카메라 mining boost + 카메라 catalog 변형 흡수

> Status: **applied (DB write 1, code 2 files).** sport_golf ready 승격 + mining query +13 + 카메라 mustContain 변형 흡수. autonomy 범위 (owner sign-off 후 진행).

CLAUDE.md 6 필드 포맷.

## 0.1 sport_golf → ready 승격

- 시간: 2026-05-14 06:38 KST
- 발견: Wave 86 브리핑 14일 측정:
  - Titleist TSR2: 49건 raw / parser 49/49 OK / pool ready 6 / median 62만 / 시세 분포 28~62만 (좁음)
  - Titleist TSR3: 18건 raw / parser 18/18 OK / pool ready 2 / median 38만 / 분포 32~50만
  - 모든 ready 지표 통과 (매물 + parser + pool + 시세 신뢰)
- 변경: DB `mvp_category_readiness` INSERT/UPDATE — `category='sport_golf'`, `status='ready'`, `label='골프'`, timestamp 2026-05-14 06:38:36.949896+00.
- 검증: returning row OK. 다음 isr 후 사용자 노출 시작.
- 위험: 매우 낮음. TSR2/TSR3 parser 100% pass, pool 진입 안정.
- 다음: 사용자 노출 후 1주 모니터링 — TSi/TSR 혼동 false positive 측정.

## 0.2 시계/카메라 mining boost — DEFAULT_SEARCH_QUERIES +13

- 시간: 2026-05-14 KST
- 발견: 시계/카메라 표본 부족:
  - G-Shock DW-5600 57건 OK / GA-2100 33건 중 28건 review (85%, parser 약함) / GMW-B5000 11건
  - Seiko 5 SRPD 1건만 (한국 매물 부족)
  - 카메라 3 SKU 합쳐 5건 (Wave 65 옵션 A body-only strict 정책 영향)
- 변경: `src/lib/pipeline-config.ts` DEFAULT_SEARCH_QUERIES +13 변형 query 추가:
  - G-Shock 변형: "카시오크", "지얄오크", "DW-5600BB", "DW5600 풀박스", "지샥 풀메탈", "GMW-B5000", "GMW B5000"
  - Seiko 변형: "세이코 5KX", "Seiko 5 SRPD", "세이코 SRPD"
  - 카메라 변형: "Sony A7M3", "Sony A7 III", "ILCE-7M3", "Sony A7C 바디", "ILCE-7C", "캐논 R6M2", "EOS R6 Mark II", "캐논 알육막투"
- 검증: tsc clean, test:core pass.
- 위험: queryFamily=unknown → gather + 5m default. Wave 56/57/61/65 동일 패턴. yield-based downrank.
- 다음: 1~2주 자연 cron cycle 후 표본 증가 측정. ready 승격 재검토.

## 0.3 카메라 catalog mustContain 변형 흡수

- 시간: 2026-05-14 KST
- 발견: Wave 65 옵션 A (body-only strict) → R6 Mark II 매물 207건 중 191건 detail-skip (92%). Wave 66에서 internal_only 되돌렸음. 그러나 정직히 다음 변형은 의미 동일 (정확성 손해 0): "본체"·"본체만"·"바디셋"·"풀박스".
- 변경: `src/lib/catalog.ts` 카메라 3 SKU (R6 Mark II / A7M3 / A7C) mustContain[1] 확장:
  - 기존: ["바디", "바디만", "body"]
  - 신규: ["바디", "바디만", "바디셋", "body", "본체", "본체만", "풀박스", "풀박"]
  - 추가 변형은 LAUNCH_PLAN §12b "변형 흡수는 OK / 의미 완화 금지" 원칙 일치.
  - 풀박스 = Bunjang 카메라 관행상 body+박스+동봉품 (렌즈 미포함이 default).
- 검증: tsc clean, test:core pass.
- 위험: 풀박스 일부 매물이 렌즈 키트 포함 가능 — `mustNotContain: [...CAMERA_BODY_ONLY_NOISE]`에 "렌즈"/"키트"/"세트" 이미 박혀있어 cross-reject 작동. 위험 낮음.
- 다음: 1~2주 후 카메라 narrow lane SKU bound 비율 재측정. body-only lane의 detail-skip 92% → 30~50% 개선 기대.

## 1. owner 결정 분류

| 항목 | 분류 | 근거 |
|---|---|---|
| sport_golf ready 승격 | owner 결정 확정 (Wave 86) | TSR2/TSR3 모두 지표 통과 |
| 시계 카테고리 노출 | **현 internal_only 유지** | parser/표본 부족, 1~2주 measurement after boost |
| 카메라 카테고리 노출 | **현 internal_only 유지** (Wave 66) | catalog 보강했지만 표본 절대 부족 |
| 닌텐도 OLED 정책 | **보류** | owner 결정 대기 |

## 2. 측정 지표 (1~2주 후 측정 예정)

| SKU | 현 14d 표본 | parser OK% | pool ready | 목표 (ready 승격) |
|---|---:|---:|---:|---|
| Titleist TSR2 | 49 | 100% | 6 | ✅ 승격됨 |
| Titleist TSR3 | 18 | 100% | 2 | ✅ 승격됨 |
| G-Shock DW-5600 | 57 | 91% | 0 | 80건+ / pool 5+ |
| G-Shock GA-2100 | 33 | 15% (28/33 review) | 0 | **parser 보강 필수** / 70%+ |
| G-Shock GMW-B5000 | 11 | 55% | 0 | 30건+ |
| Seiko 5 SRPD | 1 | 100% | 0 | 10건+ (한국 시장 작음, 보류 가능) |
| 카메라 (A7M3/A7C/R6M2) | 5 합산 | 100% | 0 | catalog 보강 후 30건+ |

## 3. 추가 작업 필요

- GA-2100 parser 보강: 28/33 review의 원인 분석 + option-parser/catalog patch (별도 wave).
- Seiko 5 한국 시장 작음 결정 — KREAM 강세, Bunjang 매물 부재. dormant 인정 가능.
- 카메라 narrow lane policy 재검토: body-only 정책 유지 vs all-variants 변경 (Wave 65 옵션 A → 옵션 B 재고).
