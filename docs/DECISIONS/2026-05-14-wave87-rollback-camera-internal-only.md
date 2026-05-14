# Wave 87 정정 — camera ready 롤백 + 자연 시간 대기

> Status: **applied (DB rollback 1 row).** Wave 87에서 카메라 ready 승격 → 71% binding은 production 기준 미달 → internal_only 롤백. 1~2주 자연 매물 누적 후 재측정.

CLAUDE.md 6 필드 포맷.

## 0.1 카메라 ready 롤백 + 정정

- 시간: 2026-05-14 06:57 KST
- 발견: Wave 87 카메라 ready 승격 (5 SKU 평균 65~74% binding) → owner 지적 "71%가 ready라고?". 정확한 분석:
  - 65~74% binding rate는 **query→SKU yield**이지 parser 정확도 아님.
  - bound 매물 parser 100% pass.
  - unbound 잔여 분석: 50%+ 렌즈 키트 (의도된 reject) / 30%+ 다른 모델·세대 (정확 reject) / 10% 액세서리 / 1~3% 진짜 false negative ("Alpha 7CR" 같은 edge case).
  - **결정론 자체로는 수렴 도달** — 추가 catalog 강화로 잡을 게 거의 없음.
  - 그러나 깨끗한 본체만 매물 / 일 합 ~27건 — user 입장 매물 적음.
- 변경: DB UPDATE `mvp_category_readiness camera` → `internal_only` (2026-05-14 06:57:47).
- 검증: returning row OK.
- 위험: 낮음. 시세 학습은 internal_only에서도 계속.
- 다음: 자연 시간 대기 (1~2주). 매물 누적 후 재측정 → ready 재검토.

## 0.2 결정론 수렴 vs 표본 부족 — 정직 분석

- 시간: 2026-05-14 KST
- 발견: owner 질문 "더 강화할 데이터 부족 vs 진짜 수렴?". 측정으로 답:
  - **결정론 수렴 도달** (false negative 1~3%만).
  - 표본은 충분치 않음 (A7CR 21개, R6 Mark II 42개 등 query당) — 단 보강해도 binding 율 안 올라감 (위 unbound 분석 참조).
  - 진짜 한계: **렌즈 키트 매물 살리기 = AI L2 영역**. body-only 정책상 결정론은 reject 정확.
- 변경: 인정만, 코드 변경 X.
- 검증: 측정값 그대로 + JSON 기록 (reports/wave86-watch-camera-boost-diag-latest.json).
- 위험: 없음.
- 다음:
  - **자연 시간 대기**: 1~2주 cron natural cycle → 카메라 SKU 표본 2~3배 누적.
  - 그 후 재측정 → 일 50건+ 도달 시 ready 재검토.
  - 또는 **AI L2 enable** (별도 wave) — 렌즈 키트 본체만 평가 → binding 65%→90% 도약 기대.

## 1. 카테고리 readiness 최종 상태

| 카테고리 | 상태 |
|---|---|
| earphone / smartwatch / tablet / laptop / desktop / monitor / speaker / home_appliance | ready (기존) |
| **sport_golf** | ready (Wave 86) |
| **watch** | ready (Wave 86) |
| **camera** | **internal_only** (Wave 87 롤백 → 자연 시간 대기) |
| smartphone | internal_only (기존, AI L2 영역) |
| game_console | internal_only (닌텐도 보류, 거론 금지) |
| small_appliance | blocked (기존) |

→ **사용자 노출 카테고리 10개 (sport_golf + watch 추가).**

## 2. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류, `docs/DECISIONS/2026-05-14-nintendo-oled-shelved.md`.
- 카메라 ready 재검토 — 자연 시간 1~2주 대기 후 재측정 시점에만 거론.
