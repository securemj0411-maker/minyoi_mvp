# Wave 65 — mining gap sweep (catalog SKU inflow 진단 + 보강)

> Status: **applied (code only).** DB write 0, candidate_pool 0, public 0, DDL 0. autonomy 범위.

CLAUDE.md 6 필드 포맷.

---

## 0.1 catalog SKU 전체 inflow 진단

- 시간: 2026-05-14 KST
- 발견: 30일 inflow 있던 SKU 96개 측정. 7d ≤ 5 인 죽은 SKU 16개 식별. 원인 분류:
  - **A. detail-skip 92% (카메라 3 SKU)**: probe 자연 inflow 큰데 (a7m3 24/a7c 49/r6m2 6) title-triage detail-skip이 92% 거름. catalog `mustContain[1]=["바디","바디만","body"]`이 너무 strict + body-only lane 정책상 의도된 reject. → **owner 결정 영역** (body-only 유지 vs all-variants 변경).
  - **B. query 부재 (sony-wh-ult900n, speaker-bose-soundlink-mini-ii)**: DEFAULT_SEARCH_QUERIES에 해당 키워드 0. → autonomy 액션.
  - **C. broader query + narrow variant 부재 (home-appliance-roborock-s8-pro-ultra)**: "로보락 S8" 있으나 Pro Ultra variant narrow query 없어 7d=2. → autonomy 액션.
  - **D. duplicate 의심 (bose-qc45-headphones vs bose-qc45)**: 같은 제품 두 SKU id. 검증 필요 → 보류.
  - **E. legacy/dormant (monitor-39gx900a, applewatch-se1 등)**: Wave 59-A에서 query 정리 완료 또는 정말 옛 모델. 추가 액션 불필요.
- 변경: 없음 (진단)
- 검증: DB 측정 (catalog SKU × inflow 24h/7d × pool_ready)
- 위험: 없음
- 다음: §0.2 B+C 자동 액션, §0.3 A 보고만

---

## 0.2 죽은 SKU 3건 query 추가

- 시간: 2026-05-14 KST
- 발견: §0.1의 B/C 분류 3 SKU. catalog 등록됐는데 자연 inflow ≤ 2건 (7d).
- 변경: `src/lib/pipeline-config.ts` DEFAULT_SEARCH_QUERIES 71→74 (+3):
  - "소니 ULT900N" (sony-wh-ult900n, query 부재)
  - "보스 사운드링크 미니" (speaker-bose-soundlink-mini-ii, query 부재)
  - "로보락 S8 프로 울트라" (home-appliance-roborock-s8-pro-ultra, broader "로보락 S8"만 있어 Pro Ultra variant 미바인딩)
  - Wave 65 comment 박음
- 검증:
  - tsc clean
  - test:core 139/139 pass
- 위험: queryFamily=unknown → gather + 5m default. yield-based downrank이 evidence 누적 후 적용 (Wave 56/57/61 동일 메커니즘).
- 다음: cron natural cycle (1~2h) 후 자연 inflow 측정. catch-up 측정 후 11 criteria 위반 query cleanup 결정.

---

## 0.3 [보고] 카메라 narrow lane detail-skip 92% — owner 결정 필요

- 시간: 2026-05-14 KST
- 발견: R6 Mark II 매물 207건 / 7d 중 **191건 (92%) detail_status='skipped'** (detail_error: `title_triage_v1:title_unknown_sku`). title-triage 로직 (`tick-pipeline.ts:790`)이 title만으로 SKU 매칭 실패한 매물은 detail 큐 진입 자체 차단. catalog `mustContain[1]=["바디","바디만","body"]` 통과 못 한 매물 (예: "캐논 EOS R6 Mark II 풀박스" 25건) 모두 skip. **lane spec "body_only_exact_model" 의도와 일치** — 정확성 원칙 §12b "명시 안 한 매물 reject default" 준수.
- 변경: 없음 (보고만)
- 검증: 측정값
  - "바디" 명시 31건 / "본체" 1건 / "풀박스" 25건 / 207건 중 191건 skip
  - mustContain[1] 통과 가능 후보 = "바디" 명시 매물 + "body" 매물 ≈ 31~35건
- 위험: catalog 변경 X. owner가 lane 정책 변경 결정해야 정확성 trade-off 진행 가능.
- 다음: **owner 결정 = 옵션 A 확정 (2026-05-14)** — `body_only_exact_model` lane 유지. 정확성 우선, 카메라 SKU dormant 인정. false-positive 0 보장, recall 손해 수용. catalog 변경 없음.

---

## 1. 결정 분류

| 항목 | 분류 | 근거 |
|---|---|---|
| 죽은 SKU 3건 query 추가 | autonomy 행동 | 사업 카테고리 변경 X, Wave 56·57·61 동일 패턴 |
| 카메라 lane 정책 변경 | owner 결정 | 정확성 vs recall trade-off, lane spec 변경 |
| bose-qc45 duplicate 정리 | autonomy 보류 | 검증 필요 |

## 2. 남은 blocker

1. ~~카메라 narrow lane policy~~ — **owner 확정 옵션 A (body_only 유지, dormant 인정)**
2. R3 첫 발화 측정 (2026-06-08+)
3. 38 no_change parser_version 정리 (낮음)
4. Phase A backup DROP (2026-05-21+ 자동)
5. Wave 57·61·65 query catch-up 측정 (자연 시간)
6. report-*.ts 483개 분류·통합 (별도 wave)
7. 사업 카테고리 신규 사인오프 (시계/골프/카메라 broad) — **owner**
8. bose-qc45 duplicate SKU 정리 — autonomy 후속
