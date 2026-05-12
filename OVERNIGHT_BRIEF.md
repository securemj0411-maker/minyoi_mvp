# OVERNIGHT_BRIEF.md — 밤샘 미션 지침서

> **다음 세션 (밤샘 Claude)** 정확한 미션. 작성: 2026-05-13 자정.
>
> **시작 전 필독 순서:**
> 1. 이 문서 (전체)
> 2. `mvp/LAUNCH_PLAN.md` — SoT, 원칙 1~13 + 측정 데이터
> 3. `mvp/30일_실행계획.md` — decision log (GPT가 갱신 중)
> 4. `mvp/CLAUDE.md` — 프로젝트 구조

---

## 1. 컨텍스트 — 누가 뭐 하고 있나

### Codex (GPT, 별도 세션, **밤샘 작업 중**)
**만지는 영역:**
- `src/lib/catalog.ts` (chooseUniqueCandidate disambiguation, mustContain/mustNotContain 정밀화)
- `src/lib/option-parser.ts` (chip/year 추정 차단, comparable_key precision)
- `src/lib/pipeline.ts` (PipelineRow에 parser metadata 추가)
- `src/lib/ai-l2-policy.ts` (vocabulary 확장)
- `scripts/report-ai-l2-*` (parser gap routing report)
- `reports/ai-l2-runtime-bridge-design-latest.md` (FK migration review)
- `LAUNCH_PLAN.md §2~4`, `30일_실행계획.md` (결정 로그)

**GPT의 4가지 산출물 (밤새 생김):**
1. AI L2 bridge metadata patch (PipelineRow + AI prompt + dry-run 모드)
2. FK migration review 문서 (mvp_listing_ai_classifications.pid → mvp_raw_listings)
3. needs_more_mining 5 lane 보강안 (**설계만** — 실제 mining 실행 X)
4. lane 상태판 (board) — LAUNCH_PLAN 갱신

### 너 (밤샘 main Claude)
**미션 한 줄**: GPT 산출물을 정확히 보완하는 4 phase. 충돌 0, ROI 명확.

### 이전 작업 끝점 (2026-05-13 자정 직전)
- Commit `ce0faaa` 직후 — airpods_pro_3 4%→100%, airpods_4_anc 0.8%→100%, galaxy_z_flip_5 0%→7.5% (정확성 우선)
- LAUNCH_PLAN.md 원칙 1~13 박힘. 측정 인프라 `scripts/lane-replay-readiness.ts` 안정.

---

## 2. 절대 금지 (위반 시 즉시 멈춤)

- ❌ `src/lib/catalog.ts` 편집
- ❌ `src/lib/option-parser.ts` 편집
- ❌ `src/lib/pipeline.ts` 편집
- ❌ `src/lib/ai-l2-policy.ts` 편집
- ❌ `scripts/report-ai-l2-*` 편집/삭제
- ❌ Supabase DDL 실제 적용 (review-only는 GPT가)
- ❌ 새 SKU lane 추가 (Pareto 한계 + GPT 충돌)
- ❌ Mining 실제 실행 (lane_config 변경 risk, GPT 설계 진행 중)
- ❌ LAUNCH_PLAN §2~4 (현재 결론) 직접 큰 구조 변경 — GPT가 갱신 중
- ❌ 정확성 낮추는 token 완화 (원칙 12b)
- ❌ Sub-agent에게 위 파일 편집 위임 (간접 충돌)

## 3. 허용 영역 (마음껏)

- ✅ `category-intelligence/<lane>/*` 읽기
- ✅ `scripts/` 새 분석 파일 작성 (`lane-replay-*`, `inspect-*` 같은 측정 도구)
- ✅ `LAUNCH_PLAN.md §1 (현재 측정 데이터)` + 작업 로그 갱신
- ✅ `OVERNIGHT_PHASE*.md`, `SESSION_HANDOFF_2026-05-14.md` 작성
- ✅ `reports/` raw 측정 dump (JSON) — 단순 데이터, report-only 분석 ❌
- ✅ Sub-agent (read-only) 활용 (원칙 8/10 따름, 4개 이하 동시)

---

## 4. Phase 1 — needs_more_mining 5 lane 사전 진단 (1~2시간)

### 입력
- `category-intelligence/<lane>/parse_summary.json`
- `category-intelligence/<lane>/samples.json`
- `category-intelligence/<lane>/lane_config.json`

### 5 대상 lane
1. `beats_solo_4`
2. `ipad_pro_13_m2_256_wifi`
3. `iphone_12_pro_128gb_self`
4. `iphone_13_pro_128gb_self`
5. `lg_gram_17_2024`

### 작업 (각 lane)
1. `parse_summary.json`의 `reject_breakdown` → top 5 reject reason + 카운트
2. `samples.json`에서 rejected 매물 10건 sample 직접 봐서 정당한 reject인지 확인
3. `lane_config.json`의 query / pages / acceptAll / reject 검토
4. `fetched_count` vs `parse_ready_count` 비율 계산
5. **3택 1 라벨:**
   - **(a) mining 보강 가능**: acceptAll/reject 일부 too strict, 변형 추가로 정확도 유지하며 표본 ↑ 가능 → 구체적 query 변형 또는 acceptAll 정규식 변형 patch 제안 (텍스트만, 코드 변경 X)
   - **(b) 시장 자체 적음**: fetched 자체가 부족. re-mining 효과 ≤ 5건 추정. **AI L2 후보로 마킹**
   - **(c) lane 폐기 후보**: 시장 너무 작아 사용자 가치 없음. **owner_decision_pending**

### 출력
`mvp/OVERNIGHT_PHASE1_MINING_DIAGNOSIS.md`
- 각 lane 1 섹션 (≥ 200자, ≤ 600자)
- 진단 + 라벨 + (a) 라벨 시 구체적 변형 제안

### 검증
- 각 라벨에 측정값 근거 (fetched / parse_ready / 주요 reject reason 수치)
- spot check: rejected 매물 10건 중 잘못 reject 된 건 몇 건?

---

## 5. Phase 2 — Production replay 종합 측정 + lane board (2~3시간)

**주의**: GPT가 catalog/parser 변경 중이라 측정값 변할 수 있음. **시작 시점에 한 번, phase 끝나기 직전 한 번 재측정**해서 GPT 작업 반영.

### 작업
1. `cd mvp && npx tsx scripts/lane-replay-readiness.ts` 실행 → 전체 50+ lane 측정값
2. 각 lane을 LAUNCH_PLAN §5 기준 A/B/C/D class로 분류
3. lane 상태 board 작성 (각 lane 행):

| 컬럼 | 값 |
|---|---|
| laneKey | (string) |
| class | A / B / C / D |
| skuMatchPct | % |
| needsReviewFalsePct | % |
| comparableKeyCompletePct | % |
| unknownPartsPct | % |
| 4-blocker | data_insufficient / semantic_pollution / runtime_not_deployed / owner_decision_pending (multi-label OK) |
| 상태 | deterministic_ready_stop / deterministic_precision_stop / needs_ai_l2 / needs_more_mining / manual_or_owner_review |

4. GPT의 `reports/ai-l2-parser-gap-routing-latest.json` 라우팅 분류와 비교 — 일치 / 불일치 lane 식별
5. 불일치 lane은 spot check (원칙 10) — 어느 분류가 정확한지 측정 근거로 판정

### 출력
- `mvp/OVERNIGHT_PHASE2_LANE_BOARD.md` — 위 표 + 분석
- `reports/lane-replay-overnight-20260514.json` — raw 측정 dump (재현용)
- `LAUNCH_PLAN.md §1.6a` 갱신 (작업 로그 행 추가)

### 검증
- A급 lane (closed-set) skuMatch 90%+ 인지 확인
- C/D급 lane이 무리하게 결정론으로 끌어올려졌는지 (false positive 위험) 검토 — sample 5건씩 spot check
- 측정값 모순 (예: skuMatch 100% but needsReviewFalse 0%) 있으면 원인 진단

---

## 6. Phase 3 — AI L2 cost 사전 시뮬레이션 (1~2시간)

### 입력
- GPT의 `reports/ai-l2-parser-gap-routing-latest.json` (needs_ai_l2 30 lane 목록)
- production traffic 추정:
  - `npm run diagnose:parser` (최근 1000건 카테고리 분포)
  - 또는 production listing volume 추정값 (LAUNCH_PLAN §1.1)

### 모델 pricing (2026-05 기준)
- **Haiku 4.5**: input $0.80/M, output $4/M, cache read $0.08/M
- **Sonnet 4.6**: 약 5배

### 작업
1. needs_ai_l2 30 lane의 매물 traffic 추정 (lane별 production listings 비율)
2. lane당 일 평균 AI 호출 수 × tokens (input ~500 + system prompt cached ~10K + output ~200)
3. 월 비용 매트릭스:
   - **시나리오 A — 보수 (Haiku 전부)**: $X
   - **시나리오 B — 정확도 (Sonnet escalation hold + Haiku 일반)**: $X
   - **시나리오 C — Pack open 직전 verify 추가**: +$X
4. Cache hit rate 시나리오:
   - 50% (보수적), 70% (typical), 85% (best case)
5. Sensitivity: `aiReviewTopN` 1000 / 2000 / 5000 별 비용 변동

### 출력
`mvp/OVERNIGHT_PHASE3_AI_L2_COST.md`
- 표 형식 비용 매트릭스
- 추정 근거 명시 (traffic 어떻게 산정했는지)
- 후보팩 1팩 1500원 가정 시 unit economics 양수 조건

### 검증
- 매물 traffic 추정 근거 명시 (production data vs handoff 추정)
- 보수/정확도/best case 3 시나리오 모두 제시
- GPT의 unit-economics 리포트와 매칭 가능한 형식

---

## 7. Phase 4 — Handoff 문서 (1시간)

### 입력
- Phase 1~3 산출물
- GPT 산출물 (밤새 생기는 파일들 — 끝나면 commit log 확인)
- LAUNCH_PLAN.md 최종본
- 30일_실행계획.md decision log

### 출력
`mvp/SESSION_HANDOFF_2026-05-14.md`

### 구조 (이전 `SESSION_HANDOFF_2026-05-13.md` 패턴 참고)
1. **읽을 문서 순서**: LAUNCH_PLAN → 이 핸드오프 → GPT 산출물 → 30일_실행계획
2. **우리 위치 한 줄**: "결정론 stop + AI L2 escrow 구조 완성. needs_ai_l2 30 lane 라우팅 준비. cost 시나리오 월 $X."
3. **GPT + main 산출물 통합 요약** (표 형식, 각 산출물 1줄)
4. **다음 액션 우선순위 5개**:
   - (a) GPT FK migration DDL 실제 적용 결정 (MJ owner)
   - (b) AI L2 dry-run 실행 후 production 활성 결정
   - (c) needs_more_mining lane 보강 실행 (Phase 1 (a) 라벨 lane)
   - (d) Owner decision 항목 답 받기 (switch_oled bundle 등)
   - (e) UI/Auth/결제 launch gate 작업 시작
5. **알려진 함정** (Codex/Claude 양쪽 함정 경험 기록)
6. **검증 명령어** (lane-replay / diagnose:parser / test:core)
7. **MJ 결정 대기 항목** 일괄

---

## 8. Sub-agent 활용 정책 (원칙 8/10 준수)

- **1줄 미션 가능하면 사용**, 못 쓰면 쪼개기
- 동시 4개 이하
- **read-only만** (Phase 1~3 모두 분석 작업이라 적합)
- 산출물은 main이 spot check (숫자 ≥ 3개) 후 LAUNCH_PLAN/HANDOFF 반영
- catalog/parser/pipeline/ai-l2-policy 편집 위임 ❌

**추천 sub-agent 시나리오:**
- Phase 1: 5 lane 진단 분담 (sub-agent 1~2개에 분담 또는 main 직접)
- Phase 2: 측정은 **main 직접** (sub-agent 위임 시 측정값 spot check 비용 ↑)
- Phase 3: 비용 계산은 **main 직접** (숫자 정확성 critical)
- 사용자 정의 추가 가능, 단 위 원칙 준수

---

## 9. 매 phase 끝나면 commit

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp
git add <changed files>
git commit -m "overnight phase N: <summary>"
```

LAUNCH_PLAN.md 작업 로그 행 추가:
```
| 2026-05-14 | overnight phase N: <summary> | <key result> | <next> |
```

---

## 10. 막힘 / risk 대응

- **새벽에 막히면 멈춤.** 추측 진행 금지 (원칙 9).
- Phase 끝까지 못 가면 부분 산출물이라도 handoff에 명시.
- **GPT 작업 결과가 예상과 다르면** (예: catalog 측정값 크게 달라짐) Phase 2 측정 한 번 더, board 다시 정렬.
- **측정값 의심되면** spot check 매물 10건 직접 본다 (원칙 10).
- 정책 미정의 발견 시 (예: 어떤 lane이 deterministic_ready_stop vs precision_stop인지 모호) → handoff §MJ 결정 대기 항목에 추가.

---

## 11. 끝났을 때 체크리스트

- [ ] `OVERNIGHT_PHASE1_MINING_DIAGNOSIS.md` 작성 (5 lane × 200~600자)
- [ ] `OVERNIGHT_PHASE2_LANE_BOARD.md` 작성 + 측정 raw `reports/lane-replay-overnight-20260514.json`
- [ ] `LAUNCH_PLAN.md §1.6a` 갱신 + 작업 로그 4행 추가
- [ ] `OVERNIGHT_PHASE3_AI_L2_COST.md` 작성
- [ ] `SESSION_HANDOFF_2026-05-14.md` 작성 (다음 세션 인수)
- [ ] commit 최소 4개 (phase별)
- [ ] `30일_실행계획.md`는 **갱신 안 함** (GPT 갱신 중)
- [ ] `src/lib/*.ts`는 **건드리지 않음** (충돌 차단)

---

## 12. 시작 명령 (이 문서 받고 처음 할 일)

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp

# 1. LAUNCH_PLAN 원칙 다시 읽기
cat LAUNCH_PLAN.md | head -120

# 2. GPT 현재 commit log 확인 (어디까지 진행 중?)
git log --oneline -20

# 3. Phase 2 baseline 한 번 측정 (Phase 1 시작 전)
npx tsx scripts/lane-replay-readiness.ts > /tmp/lane-replay-start.txt 2>&1

# 4. Phase 1 시작
```

---

## 한 줄 미션 (잊으면 안 됨)

> **결정론 무한 튜닝 멈춤. SKU/lane별로 "여기까지 결정론, 여기부터 AI" 고정. 산출물은 측정 기반 + 라우팅 board + cost 시나리오 + handoff. 충돌 0.**

LAUNCH_PLAN 원칙 5/12b/12c가 흔들리면 즉시 멈추고 원칙 재확인.
