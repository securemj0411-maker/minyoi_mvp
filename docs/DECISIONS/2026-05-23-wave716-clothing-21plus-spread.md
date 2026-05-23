# Wave 716 — 의류 21+위 spread 추가 narrow split

**Date**: 2026-05-23
**Trigger**: Wave 715 결과 baseline에서 20 broad SKU 외 21+위 SKU도 spread 20-120x 잔여 → 추가 cycle 필요.
**사용자 지시**: "다 했으면 다시 pool의류검토해보고 deepsweep해도되고"

## Phase 0 — 21+위 spread 식별 (SQL 측정)

Wave 715 cover 안된 영역에서 spread 큰 SKU 추출:

| Rank | SKU | n | spread |
|---|---|---|---|
| 1 | adidas_thugclub_collab | 37 | 120.0x |
| 2 | polo_rrl_jacket_coat | 91 | 74.6x |
| 3 | acne_denim | 148 | 50.0x |
| 4 | polo_purple_label | 22 | 42.1x |
| 5 | junya_watanabe_apparel_broad | 61 | 41.0x |
| 6 | bape_jacket_broad | 54 | 40.0x |
| 7 | tnf_nuptse_broad | 180 | 30.0x |
| 8 | stussy_hoodie | 530 | 24.5x |
| 9 | arcteryx_beta | 202 | 23.8x |

## Phase 1 — Immediate fixes (commit `3ea5e17`)

### polo_purple_label accessory 차단 (42x spread)
- 넥타이 12만 → 의류 시세군 외 (accessory)
- 벨트/지갑/포켓치프/머플러/모자/안경/타올 추가 차단

### Junya broad 41x → collab narrow 4개 신설
sample에서 collab 명확 식별:
- **junya_carhartt_collab** (워크자켓 50-85만)
- **junya_levi_collab** (데님 66만)
- **junya_cp_company_collab** (M65 파카/다운 220만 premium)
- **junya_brooks_brothers_collab** (자켓/블레이저 68-94만)
- broad에 carhartt/levi/cp/brooks/베르베르진/자미로콰이/카리모어/뉴매뉴얼 mustNotContain
- **cdg_junya (Wave 715) 삭제** — junya broad와 중복

### Acne Denim 50x → premium 분리
- **acne_denim_premium** 신설 (Petit/2021M/Flare 600k tier)
- acne broad에 petit/쁘띠 mustNotContain (750k outlier 5건 routing)

## Phase 2 — Agent deep sweep 결과 적용 (commit `7cd6cb0`)

Agent `a666cb57470a903f1` 의류 5000건 sweep 발견 권고:

### P0 — 이름과 데이터 mismatch
- **stussy_pigment_dye_hoodie 76% tees!**
  - Rename → "Stussy Pigment Dye Tee"
  - 후드/봄버 mustNotContain (별도 가격대 13만/40만)
  - msrpKrw 17만 → 7만 보정
- **adidas_thugclub_collab teamgeist 분리**
  - **thugclub_teamgeist_hoodie** 신설 (~63만 tier, 후디/레더)
  - broad에 팀가이스트 후드/레더 mustNotContain
  - 비-collab 아디다스 축구 매물 차단 (수원삼성/축구/풋살/아디컬러)

### P1 — Sub-cluster 분리
- **polo_rrl_jacket_coat 75x spread**:
  - **polo_rrl_work_chore_jacket** 신설 (~53만 median, 7건)
  - **polo_rrl_wool_mackinaw_jacket** 신설 (~90만 premium)
  - broad에 워크/초어/wool/맥키노/trucker mustNotContain
- **bape_jacket_broad 40x spread**:
  - **bape_varsity_jacket** 신설 (~22만 median, 11건)
  - **bape_coach_jacket** 신설 (~19만 median, 10건)
  - broad에 varsity/coach mustNotContain
- **tnf_nuptse_broad 30x** (split 효과 미미 — agent 결론):
  - mustNotContain 강화만 (롱슬리브/플리스/반팔/키즈/1992 us/us overseas)

### P1 hold (defer, agent 권고)
- **arcteryx_beta**: sub-model 가격 차이 50k 이내, split 효과 X
- **acne_denim**: batch dup이지 sub-cluster 부족 아님

## Wave 716 신설 SKU: 10개

| SKU id | tier | sample n |
|---|---|---|
| thugclub_teamgeist_hoodie | 63만 | 7 |
| polo_rrl_work_chore_jacket | 53만 | 7 |
| polo_rrl_wool_mackinaw_jacket | 90만 | 5 |
| bape_varsity_jacket | 22만 | 11 |
| bape_coach_jacket | 19만 | 10 |
| junya_carhartt_collab | 75만 | 6+ |
| junya_levi_collab | 70만 | 6+ |
| junya_cp_company_collab | 220만 | 3+ |
| junya_brooks_brothers_collab | 85만 | 3+ |
| acne_denim_premium | 60만 | 5+ |

## Phase 3 — 검증 baseline

**score_dirty trigger 실행**:
- 632 raw_listings 큐 박음 (Wave 716 8 broad SKU 14d)
- Wave 715에서 이미 큐된 4,602와 합쳐서 reparse cycle 진행

## 관련 commit

- `3ea5e17` — Wave 716 immediate (purple label accessory + junya collab + acne_denim petit)
- `7cd6cb0` — Wave 716 P0/P1 (agent 권고 적용)

## Agent 추적

- `a666cb57470a903f1` — Wave 716 의류 5000건 deep sweep (P0/P1 권고)

## 진행 상황

- [x] Phase 0 — spread 식별 (9 SKU 후보)
- [x] Phase 1 — immediate fixes (3 commit)
- [x] Phase 2 — agent 권고 적용 (P0 2개 + P1 3개 narrow split + 2개 hold)
- [x] Phase 3 — score_dirty 632건 큐 박음
- [ ] Phase 4 — 24-48h 후 spread 재측정

## 다음 cycle 후보 (Wave 717+)

- stussy_hoodie (530건 25x) — 사용자가 별도 검토 권고 시
- arcteryx_beta sub-model (만약 deployment 후 spread 갈리면 재검토)
- 신발 condition grading deep sweep 10K (Task #49 pending)
