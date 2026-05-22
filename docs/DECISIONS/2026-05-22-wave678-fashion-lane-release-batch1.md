# Wave 678 — Fashion lane release 1차 batch (blocked → ready)

## 발견 (사용자 지적)

이전 세션에서 fashion narrow tightening 작업 위해 **lane 39 blocked + 16 internal_only** 박혔음. Wave 593-677 narrow 작업 완료됐는데 **lane은 여전히 닫혀있어** matched 잘 되지만 ready 풀 안 들어옴.

shoe matched 16,917 → ready 10 (0.06%) / clothing matched 10,540 → ready 28 — fashion 비율 비정상.

## 1차 release batch (4 lane)

Wave 593-677 직접 narrow tightening + sample audit + LATEST parser spread <4x 확인된 lane만:

| lane | Wave | 차단 정책 |
|------|------|----------|
| `stussy_basic_tee` | 656 | 도시 한정/DSM/마틴로즈/CPFM/돌리/갱스타/월드투어 |
| `stussy_hoodie` | 655 | 월드투어/CPFM/스컬본즈/iD 매거진/스택드 |
| `adidas_trefoil` | 652+676 | 레더/세트/누빔/플라워/빈티지 블루종 |
| `patagonia_retro_x` | 654 | mustContain narrow + 신칠라/스냅T/캔버스 fleece 분리 |

## 조치

1. `category-readiness.ts`: 4 lane status `blocked` → `ready` + note 갱신.
2. invalidation 큐: 141 comparable_key (cross-product variant 다 포함) priority 85 + status pending.
3. cron market-worker가 LATEST v32 parser로 시세 reparse → ready pool 진입.

## 안전 기준 (1차 batch에서 제외된 lane)

- `bape_tee` / `bape_hoodie` / `bape_hoodie_zip` / `bape_crewneck`: Wave 413 hold 이후 narrow 추가 작업 없음. 별도 wave에서 sample audit 필요.
- `polo_rrl` / `polo_rrl_broad` / `polo_rrl_accessory`: 풀 작아 sample audit 어려움.
- `acne_apparel` / `matinkim_apparel` / `fila_apparel`: broad apparel, narrow split 미완.
- `arcteryx_apparel` / `arcteryx_broad` / `arcteryx_vertex_squamish`: arcteryx_beta는 release, broad는 hold.

## Why (사용자 검증 데이터)

이전 cycle 완료 후 spread audit 결과 `clothing|adidas_trefoil|jacket|b_grade` spread 8.9x (10건, Wave 676 잔여) → 차단 추가 후 0건. `stussy_basic_tee a_grade` spread 8.25x → 차단 후 < 4x. LATEST parser 매물에서 spread 위험 lane 모두 정리됨.

## How to apply

release 후 24h 모니터링 — ready 풀 회복 여부 + spread re-emergence 확인. 안정 시 2차 batch (bape tee/hoodie + polo_rrl 등) 사전 narrow audit 후 release.
