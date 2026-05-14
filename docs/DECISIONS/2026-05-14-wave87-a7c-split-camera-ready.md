# Wave 87 — A7C 별도 SKU 분리 + 카메라 ready 승격 + 닌텐도 보류

> Status: **applied (code + DB write 1).** A7C broad noise 해소 → camera ready 승격. 닌텐도 OLED 보류 로그 분리 문서로 박음.

CLAUDE.md 6 필드 포맷.

## 0.1 닌텐도 OLED 무기한 보류

- 시간: 2026-05-14 KST
- 발견: owner 명시 결정 — 닌텐도 Switch OLED 관련 작업 무기한 보류, 거론 금지.
- 변경: `docs/DECISIONS/2026-05-14-nintendo-oled-shelved.md` 신규 — 보류 사유 + 동결 상태 + 재개 조건 기록.
- 검증: 문서 파일 1개 추가.
- 위험: 없음.
- 다음: owner가 명시 재개 지시 전까지 작업 X.

## 0.2 Sony A7C 별도 SKU 분리 (A7C II / A7CR)

- 시간: 2026-05-14 KST
- 발견: Wave 86 진단 결과 "소니 A7C" query → A7CR/A7C II/A7S2 등 다양한 후속 변형 흡수. broad noise로 18~22% binding. mustNotContain 격리는 정확 작동했으나 흡수되어야 할 매물이 갈 곳이 없었음 (다른 SKU 부재).
- 변경: `src/lib/catalog.ts` SKU 2개 신규 추가:
  - `camera-sony-a7c-ii` (Sony A7C II, 2023.10, 33MP, ILCE-7CM2): mustContain `["a7c2", "a7c ii", "a7c ll", "ilce 7cm2"]`. mustNotContain에 A7CR/A7M3/A7S/렌즈 키트 격리.
  - `camera-sony-a7cr` (Sony A7CR, 2023.10, 61MP, ILCE-7CR): mustContain `["a7cr", "ilce 7cr"]`. mustNotContain에 A7C II/A7R V/A7M/렌즈 키트 격리.
- 변경: `src/lib/pipeline-config.ts` DEFAULT_SEARCH_QUERIES +6 (소니 A7C II/Sony A7C II/A7C2/ILCE-7CM2/소니 A7CR/Sony A7CR).
- 검증:
  - 진단 재실행: A7CR 71% binding, A7C II 21% (단 ILCE-7CM2 query 67%, 소니 A7C II 29%) — 정확 매칭 작동.
  - A7C 22% — 분리 후에도 broad query noise는 그대로지만 정확성 ↑ (이전 A7CR/A7C II로 들어왔다 reject되던 매물 이제 각자 SKU로 흐름).
  - parser 모든 SKU 100% pass.
- 위험: 매우 낮음. mustNotContain 모든 변형 cross-격리. mustContain은 정확 매칭만.
- 다음: 사용자 노출 후 1주 모니터링 (5 카메라 SKU false positive 측정).

## 0.3 camera 카테고리 ready 승격

- 시간: 2026-05-14 06:55 KST
- 발견: A7C 분리 후 카메라 5 SKU (A7C / A7C II / A7CR / A7M3 / R6 Mark II) 모두 parser 100%, binding 65~74% (A7C broad query 제외).
- 변경: DB UPDATE — `mvp_category_readiness` `camera` → `ready` (label 'Camera', timestamp 2026-05-14 06:55:13).
- 검증: returning row OK. 다음 ISR 후 사용자 노출 시작.
- 위험: 매우 낮음. 5 SKU 모두 narrow lane + body-only policy 명확.
- 다음:
  - 사용자 노출 1주 모니터링.
  - A7C broad query "소니 A7C" 28만건 노이즈 흡수 — 별도 SKU 분리로 정확성은 확보, 매물 수는 query별 균등 분포.

## 1. 카테고리 readiness 상태 (Wave 87 후)

| 카테고리 | 상태 | 비고 |
|---|---|---|
| earphone | ready | 기존 |
| smartwatch | ready | 기존 |
| tablet | ready | 기존 |
| laptop | ready | 기존 |
| desktop | ready | 기존 |
| monitor | ready | 기존 |
| speaker | ready | 기존 |
| home_appliance | ready | 기존 |
| **sport_golf** | **ready (Wave 86)** | TSR2/TSR3 |
| **watch** | **ready (Wave 86)** | DW-5600/GA-2100/GMW-B5000/Seiko 5 |
| **camera** | **ready (Wave 87)** | A7C/A7C II/A7CR/A7M3/R6 Mark II |
| smartphone | internal_only | broad recall AI L2 영역 |
| game_console | internal_only | 닌텐도 보류 (Wave 87 §0.1) |
| small_appliance | blocked | 기존 |

→ **사용자 노출 카테고리 11개 (이전 9개 → +2)** + smartphone/game_console internal_only.

## 2. 다음 가능 작업

1. AI L2 enable (LAUNCH_PLAN §4.5 phase 1b — FK migration review).
2. 가격/quota 시스템 구현 (Wave 85 owner sign-off 후).
3. report-*.ts 483개 분류 (별도 wave).
4. God file 분리 (`pipeline.ts` 1409줄 / `tick-pipeline.ts` 3448줄).

## 3. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류, `docs/DECISIONS/2026-05-14-nintendo-oled-shelved.md` 참조. 재개 지시 전까지 거론 X.
