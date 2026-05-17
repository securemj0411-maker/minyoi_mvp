# Wave 190 — admin pool API score_flags 경로 fix (RiskScoreBar 정확도)

## 문제

Wave 184 (Phase 0 L4) 에서 박은 admin pool API:
```ts
restFetch(`${tableUrl("mvp_listing_parsed")}?select=...,score_flags,...`)
```

**버그**: `mvp_listing_parsed` 에 `score_flags` 컬럼이 **없음**. Supabase information_schema 확인 결과:
- `mvp_listing_parsed` 컬럼: pid, comparable_key, parse_confidence, needs_review, condition_class, parsed_json (등) — **score_flags 없음**
- `mvp_listing_analysis` 컬럼: pid, score_flags, risk_hits, score, velocity (등) — score_flags **여기 있음**
- `mvp_listing_candidates` 컬럼: pid, score_flags, risk_hits, score (등) — 후보 매물만

→ admin pool API에서 score_flags fetch 시도 → 컬럼 무시 (PostgREST 가 unknown column 그냥 skip) → **항상 빈 배열 반환**.

결과:
- RiskScoreBar 의 `fraud axis` 신호 (ai_escrow_held / ai_escrow_pending / extreme_discount_review 등) **미작동**
- 운영자가 풀 매물 검수할 때 위험 신호 일부만 보임 → 보호 정확도 ↓

## 박은 것

### `/api/admin/pool-listings/route.ts` 수정

#### 변경 1: parsed 쿼리에서 score_flags 제거

```diff
- `mvp_listing_parsed?select=pid,comparable_key,parse_confidence,needs_review,condition_class,score_flags,parsed_json...`
+ `mvp_listing_parsed?select=pid,comparable_key,parse_confidence,needs_review,condition_class,parsed_json...`
```

#### 변경 2: 새 batch — mvp_listing_analysis

```ts
restFetch(
  `${tableUrl("mvp_listing_analysis")}?select=pid,score_flags,risk_hits&pid=in.(${pidsCsv})`,
  { headers: serviceHeaders() },
)
```

`risk_hits` 도 가져옴 — 향후 RiskScoreBar 정밀도 ↑ 후속 wave 활용 가능.

#### 변경 3: items.map 수정

```diff
- scoreFlags: Array.isArray(p.score_flags) ? p.score_flags as string[] : [],
+ scoreFlags: Array.isArray(a.score_flags) ? a.score_flags as string[] : [],
```

여기서 `a` 는 `analysisMap.get(pid)` 결과.

### 다른 worktree 위임 status

이전 Wave 184 에서 `mcp__ccd_session__spawn_task` 로 별도 worktree 위임했지만 아직 처리 안 됨 (확인: git log + 코드 grep). 본 wave 가 직접 처리.

## Trade-off

### Pros
- RiskScoreBar 의 fraud axis 정확도 ↑ — escrow held/pending + extreme_discount 신호 정상 작동
- pack-reveal-modal 에서는 이미 정확하게 작동 (RevealCard 가 별도 score_flags fetch X — 기존 코드도 빈 배열 fallback). 단 admin pool 에서만 fix.
- 추가 batch 1개만 — Promise.all 안 성능 영향 적음
- 비파괴적 (read 추가만)

### Cons
- API 응답 시간 약간 ↑ (batch 4 → 5) — 단 N+1 차단되어 한 번에 fetch
- mvp_listing_candidates 와 sync 안 됨 — 두 테이블 어느 게 최신인지 추가 검증 필요할 수 있음 (후속 wave)

## Test

`npm run test:core`: **369/370 pass** (1 skipped, 0 fail).

## Follow-up

1. **검증 — escrow_held 매물 admin 화면**: 실제 escrow_held 박힌 매물이 admin 풀에 있으면 RiskScoreBar 의 fraud axis 가 "🚨 AI 검수 보류" 로 표시되는지 확인
2. **mvp_listing_candidates vs mvp_listing_analysis** sync 검증 — 같은 pid 에 두 테이블 다 row 있을 때 score_flags 동일한지
3. **risk_hits 활용** — 새로 fetch 한 risk_hits 컬럼을 RiskScoreBar 의 정밀도 ↑ 신호로 활용 검토

## Linked

- `2026-05-17-l4-risk-score-chip.md` (원본 L4 작업)
- `2026-05-17-wave187-liquidity-curve-admin-pool.md` (이전 admin pool 확장)
