# 2026-05-17 생활가전 sweep wave (report-only) — readiness 진단

## 컨텍스트

Master plan 결정 — 사용자 선택: "유아동/생활가전 등 친화도 ⭐⭐⭐ 카테고리".
다만 메모리 노트 경고:
> "Wave 90 source 다양화 — 유아동 함정 (친화도 ⭐⭐⭐인데 차익 fail). 990/910 충돌 — 코드엔 있지만 분석은 skip 권고."

따라서 유아동은 보류 권고, **생활가전 (small_appliance)** 만 진단.

## 진단 방법

```bash
npx tsx scripts/diagnose-category-readiness.mjs \
  --category=small_appliance,monitor,camera,speaker_audio
```

`mvp_listing_parsed` 의 카테고리별 rows / parse-ready / trusted-key 측정.

## 결과

| 카테고리 | gate | rows | parseReady | trustedKeys | 권고 |
|---|---|---|---|---|---|
| **small_appliance** | **blocked** | **0** | 0% | 0 | keep_internal: 표본 100건 미만 |
| monitor | internal_only | 1 | 0% | 0 | keep_internal |
| camera | unconfigured | 1 | 100% | 0 | keep_internal |
| speaker_audio | unconfigured | 0 | 0% | 0 | keep_internal |

→ 보고서 저장: `category-intelligence/readiness/REPORT.md`

## 해석

### 생활가전 = 진입 전 단계
- **rows = 0**: mvp_listing_parsed 에 생활가전 매물이 한 건도 없음. 즉 mining 안 됨.
- **gate = blocked**: `CATEGORY_STATUS.small_appliance = "blocked"` (`diagnose-category-readiness.mjs:33`)
- **runtime 미구현**: `report-category-expansion.mjs` 명시 — *"home_appliance runtime risk model and logistics gate are not implemented yet"*

### 진입 prerequisite
생활가전 진입 시 박아야 하는 것 (큰 순서대로):
1. **Catalog SKU 박기** — 다이슨/발뮤다/필립스/위닉스 etc. 메이저 model + variant
2. **Parser 구현** — comparable_key 산출 (모델/색상/연식)
3. **Risk model + logistics gate** — 부피/배송비/AS 보증 변수
4. **Ground truth anchor** — 다나와 (있음, +) / 공식가 / 번개 sold
5. **Raw listing mining** — 키워드 query 등록 + tick-pipeline 진입
6. **Pool 진입 gate** — POOL_BLOCK_FLAGS 카테고리별 보정

각 단계가 wave 1개씩. 즉 4~6 wave effort.

### 다른 worktree 활동
`/Users/iminje/Documents/Claude/Projects/미뇨이/mvp-agent-*` 9개 worktree:
- 진행 중 lane: `airpods_4_anc`, `galaxy_buds_3_pro`, `bose_qc45`, `ipad_pro_13_m2_256`, `macbook_air_m2_13_256`, `iphone_11_pro_128_self`, `galaxy_z_flip_5_256_self`, `switch_oled`, `galaxy_tab_s10_ultra_256_self`
- **신발 lane은 별도 worktree 보이지 않음** — 신발 진입 stash 상태 추정
- 사용자가 언급한 "다른 세션 새 카테고리 확인 작업"은 **현 SKU 확장 (smartphone embeddings 등)**이 메인

## 결정

생활가전 sweep wave: **현 단계 진입 불가 — 보류**.

이유:
1. raw mining 없음 (rows = 0) → 차익 검증 자체 불가
2. runtime risk model + logistics gate 미구현 — 부피/배송/AS 핵심 변수 미반영 시 잘못된 추천
3. 다른 worktree들이 이미 9개 SKU lane 작업 중 — 카테고리 확장보다 현 카테고리 정확도 작업 우선
4. 메모리 노트: **"일반인 친화 = 풀 부족은 source 다양화로 해결"** — 다양화 의도 자체는 맞지만, 생활가전은 prerequisite 많아 신발/가방 다음 순위

## 권고 — 카테고리 진입 가이드

next 시도 시 우선순위:
1. **신발** — KREAM anchor (한정판) + 다나와 보조. 친화도 ⭐⭐⭐⭐. Wave 90 본래 plan.
2. **가방 (명품)** — 카멜 anchor 부분 + 번개 sold. 위조 risk 큼 → L4 risk score 강화 prerequisite.
3. **카메라** — parseReady 100% (1건이지만), 다나와 anchor 강함. SKU 박으면 빠른 진입.
4. **모니터/스피커** — 다나와 anchor 있지만 매물 mining 안 됨. mining wave 먼저.
5. **생활가전 (small_appliance)** — runtime 미구현 + logistics 변수 큼. 가장 마지막.

## Trade-off

- 사용자 선택 ⭐⭐⭐ 카테고리 vs 메모리 노트 권고 ⭐⭐⭐⭐ 카테고리 — 후자 우선 (이미 분석 + 명시적 권고).
- 생활가전 plan은 PMF 확인 + 사용자 1000명+ base 이후 wave 묶음 (4~6 wave) 으로 재검토.

## Follow-up

- 신발 lane mining 진척 확인 (다른 worktree 동기화 시점)
- KREAM API/scrape 가능성 결정 (legal/ToS 검토 필요)
- `report-category-expansion.mjs` 정기 재실행 (월 1회) — readiness 신호 추적

## Linked decisions

- `2026-05-17-master-plan-deferred-items.md`
- `2026-05-17-l4-risk-score-chip.md`
- (메모리) `project_wave90_source_diversification.md`
- (메모리) `project_core_principle_consumer_friendly.md`
