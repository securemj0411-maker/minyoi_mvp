# SESSION_HANDOFF_2026-05-14.md

> 밤샘 main Claude (2026-05-14 overnight) → 다음 세션 인수 문서  
> 이전 handoff: `/Users/iminje/Documents/Claude/Projects/미뇨이/SESSION_HANDOFF_2026-05-13.md`

---

## 1. 읽을 문서 순서

1. `mvp/LAUNCH_PLAN.md` — SoT, 원칙 1~13 + 측정 데이터 (반드시 먼저)
2. 이 문서 (SESSION_HANDOFF_2026-05-14.md)
3. `mvp/OVERNIGHT_PHASE2_LANE_BOARD.md` — 50 lane A/B/C/D 분류 현황
4. `mvp/OVERNIGHT_PHASE3_AI_L2_COST.md` — AI L2 비용 시뮬레이션
5. GPT 산출물 (아직 commit 없음 — 아래 §3 참고)
6. `/Users/iminje/Documents/Claude/Projects/미뇨이/30일_실행계획.md` — 의사결정 히스토리

---

## 2. 우리 위치 한 줄

> **결정론 stop 완성 + AI L2 라우팅 30 lane board 확정. cost 시뮬 월 $0.13~$0.88 (팩 수익 0.02~0.8%). GPT FK migration DDL pending — 이것만 승인되면 AI L2 escrow 켤 준비 완료.**

---

## 3. 산출물 통합 요약

### main (밤샘 Claude) 산출물 — commit 완료

| 산출물 | 파일 | 핵심 내용 |
|---|---|---|
| Phase 1 진단 | `OVERNIGHT_PHASE1_MINING_DIAGNOSIS.md` | beats_solo_4→(a)가격상한완화, lg_gram_17→(a)패턴수정, iphone12/13/ipad_pro_13_m2→(b)AI L2 후보 |
| Phase 2 lane board | `OVERNIGHT_PHASE2_LANE_BOARD.md` | 50 lane 분류: A급10/B급14/C급8/D급18. GPT 라우팅 27/30 일치. macbook_pro_14 unknown 95.6% 진단. |
| Phase 2 raw 측정 | `reports/lane-replay-overnight-20260514.json` | gitignore됨 (reports/). 로컬에만 존재. |
| Phase 3 비용 시뮬 | `OVERNIGHT_PHASE3_AI_L2_COST.md` | aiReviewTopN=1000 Haiku: 월 $0.13. aiReviewTopN=5000: $0.63. Pack 1팩($1.09) 대비 AI 비용 0.02%. |
| LAUNCH_PLAN 갱신 | `LAUNCH_PLAN.md §4 작업로그` | Phase 1~3 결과 3행 추가 |

### GPT (Codex, 별도 세션) 산출물 — **커밋 없음 확인됨**

> `git log --oneline -20` 기준 bfa3f24 이후 GPT commit 없음. OVERNIGHT_BRIEF §1에 예고된 4가지 산출물이 아직 생성되지 않았거나 본 세션 종료 후 완성될 예정.

| 예고 산출물 | 상태 | 파일 경로 |
|---|---|---|
| AI L2 bridge metadata patch (PipelineRow + dry-run) | **미완성** | src/lib/pipeline.ts, src/lib/ai-l2-policy.ts |
| FK migration review 문서 | **미완성** | reports/ai-l2-cache-fk-review-latest.md/json |
| needs_more_mining 5 lane 보강안 (설계만) | **미완성** | LAUNCH_PLAN 갱신 예정 |
| lane 상태판 (board) LAUNCH_PLAN 갱신 | **미완성** | LAUNCH_PLAN.md §2~4 |

**다음 세션에서 GPT commit 확인 필수**: `git log --oneline -10`으로 새 commit 있는지 먼저 확인.

---

## 4. 다음 액션 우선순위 5개

### (a) GPT FK migration DDL 적용 결정 — MJ owner
- `reports/ai-l2-cache-fk-review-latest.md` 읽고 `mvp_listing_ai_classifications.pid` → `mvp_raw_listings(pid)` 마이그레이션 승인/거부
- 승인 시: Supabase 적용 → AI L2 escrow 켜기 준비 완료
- 미승인 시: needs_review row cache 실패 상태 유지 (현재도 AI OFF이므로 production 영향 없음)

### (b) AI L2 dry-run 실행 후 production 활성 결정
- `AI_L2_POLICY_ENABLED=1` dry-run 모드로 켜기 (pool behavior 변화 0)
- 30 lane × routing flag 실제 작동 확인
- 이상 없으면: `needs_review=true` row를 scoreStage까지 올리는 escrow 실제 활성
- **전제: GPT의 PipelineRow parser metadata patch 먼저 머지 필요**

### (c) needs_more_mining lane 보강 실행
Phase 1 (a) 라벨 2개:
- **beats_solo_4**: `price_range_krw` 상한 280k → 400k + query "비츠 솔로4 제니" 추가 → parse_ready 15 → 40+건 목표
- **lg_gram_17_2024**: acceptAll 패턴 `lg\s*(?:\d{4}\s*)?그램|lg전자\s*그램` + query "17Z90S" 추가 + 13세대 accept_any_of 제거 (2023 모델 혼입 방지)
- Phase 1 (b) 3개 (iphone_12/13_pro, ipad_pro_13_m2): 마이닝 보강 효과 ≤5건. AI L2 후보 유지, 별도 작업 불필요.

### (d) Owner decision 항목 답 받기 (MJ)
§7 항목 전체 묻기 — 특히 switch_oled bundle policy와 parser 혼재 버전 reparse 정책이 production 매물 품질에 직접 영향.

### (e) UI/Auth/결제 launch gate 작업 시작
이건 LAUNCH_PLAN 원칙 13에 명시된 병렬 진행 항목. AI L2 작업 중에 별도로 진행 가능.
- Supabase Auth 설정 → 사용자 계정 기반 팩 오픈
- 결제 (1팩 = 1500원) Stripe 또는 간편결제 연동
- 팩 UI 화면 기본 버전

---

## 5. 알려진 함정 (Codex/Claude 양쪽 경험)

### [이번 세션 신규]

**함정 1: macbook_pro_14_m3_18_512 — unknown 95.6%**
- catalog SKU match 100%인데 comparable_key complete 4.4%
- option-parser가 이 SKU의 chip/ram/ssd 추출을 거의 전부 실패
- 결정론으로 올리려면 parser 수술 필요. 현재 production에서 이 lane의 listing은 거의 전부 needs_review=true → scoreStage skip → pool 미진입
- **다음 세션에서 이 lane 만지기 전에 Phase 2 board §모순 2 섹션 필독**

**함정 2: lg_gram_17_2024 — 13세대 false positive**
- parse_ready 5건 중 일부가 2023 LG Gram 17 (13세대 Intel = 2023 모델, 2024 아님)
- accept_any_of에 `13\s*세대`가 있어서 2023 모델 혼입됨
- 마이닝 보강 전 `13세대` accept 제거하고 `14세대|ultra5|ultra7|2024`만 남겨야 정확도 유지

**함정 3: GPT 커밋 없음 — BRIEF §1 산출물 아직 생성 전**
- 이번 세션 동안 GPT commit 확인 불가 (코드 변경 파일 절대 금지 영역이어서 내가 확인 못 함)
- 다음 세션 시작 시 `git log --oneline -10` + `reports/` 새 파일 확인 먼저

### [이전 세션 유지]

**함정 4: 자급제 일괄 patch = broad SKU 충돌**
- galaxy_z_flip_5 자급제 group 제거: 0% → 75% → 정확성 원칙으로 7.5% 복원
- 자급제 group 제거는 broader SKU 없는 lane에서만 안전. 일괄 적용 금지.

**함정 5: headphone disambig = QC45 false positive**
- laptop/tablet에만 exact-vs-broad disambiguation 적용. headphone 적용 시 QC45 100%→FP 폭증.
- `catalog.ts` disambiguation 코드 수정 시 headphone 예외 유지 필수.

**함정 6: switch_oled needsReview=0 ≠ 버그**
- 게임콘솔 파서 정책으로 needsReview=0이 설계. complete=99.5%는 정상.
- 이걸 "버그"로 보고 parser 건드리지 말 것.

---

## 6. 검증 명령어

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp

# 1. GPT 작업 확인
git log --oneline -15
ls reports/ai-l2-* 2>/dev/null

# 2. Phase 2 기준 재측정 (GPT 작업 후 변경 확인용)
npx tsx scripts/lane-replay-readiness.ts > /tmp/lane-replay-check.txt 2>&1
# 이번 측정과 비교: A급 10 lane complete 87%+ 유지 여부

# 3. parser production 현황
npm run diagnose:parser

# 4. core 테스트
npm run test:core 2>&1 | grep -E "^(ℹ|✓|✗)"
# 3 fail (pack-open-race)은 사전 존재, 정상

# 5. tsc 체크 (scripts/ 사전 에러 무시)
npx tsc --noEmit 2>&1 | grep -E "^src/"
```

---

## 7. MJ 결정 대기 항목

| # | 항목 | 내용 | 긴급도 |
|---|---|---|---|
| A | **FK migration DDL 적용** | `mvp_listing_ai_classifications.pid` → `mvp_raw_listings(pid)` 마이그레이션. AI L2 escrow 활성을 위한 전제 조건. | 높음 (AI L2 block) |
| B | **switch_oled bundle policy** | full_set만 / body_only 분리 / 둘 다 허용 중 택1. 현재 owner_decision_pending으로 pool 미진입. | 중간 |
| C | **AI L2 dry-run 활성 승인** | `AI_L2_POLICY_ENABLED=1` 켜기 (pool behavior 변화 0). dry-run 2일 후 escrow 활성 결정. | 높음 |
| D | **parser version 혼재 reparse 정책** | v24 매물 360건 재파싱 여부. 일괄 reparse vs 그대로. 재파싱하면 production 일시 부하. | 낮음 |
| E | **needs_more_mining 보강 실행 승인** | beats_solo_4 (가격 상한 완화), lg_gram_17 (패턴 수정). 실제 실행은 mining 담당 — MJ가 명령 내려야 함. | 중간 |
| F | **Switch 2 / PS5 Pro narrow lane 추가 여부** | 신모델 lane 추가 → Pareto 커버 확대. Wave 7 계획에 포함 여부. | 낮음 |

---

## 8. 현재 측정 스냅샷 (2026-05-14 overnight 기준)

| 지표 | 값 | 비고 |
|---|---|---|
| A급 lane (complete 85%+) | 10 lane | airpods_4_anc/pro_3/max, beats_studio/solo_4, sony_xm4/ch520, applewatch_ultra_2, bose_qc_ultra, galaxy_buds_3_pro |
| B급 lane (complete 60~85%) | 14 lane | ipad_air_m3, macbook_air_m2, game_console, switch_oled 등 |
| C급 lane (complete 30~60%) | 8 lane | iphone_14/15_pro, galaxy_s23/s24, ipad_mini_7 등 |
| D급 lane (complete <30%) | 18 lane | bose_qc45, galaxy_z_flip_5, broad lane들 |
| needs_ai_l2 total | 30 lane | GPT routing 기준 |
| AI L2 월 비용 (Haiku, 1k TopN) | $0.13 | 70% 캐시, 1팩=$1.09 대비 0.02% |
| production needs_review | 16.4% | LAUNCH_PLAN §1.1 기준 (1000건) |

---

## 9. 끝내고 싶은 첫 번째 것

> **GPT FK migration review + MJ 승인 → AI L2 dry-run 켜기**  
> 이것 하나면 30 lane의 C/D급 listing이 AI 심사를 받기 시작하고, pool depth가 실제로 늘어남.  
> 결정론 튜닝은 멈춤. 남은 recall은 AI L2가 담당. 이 전환이 핵심.
