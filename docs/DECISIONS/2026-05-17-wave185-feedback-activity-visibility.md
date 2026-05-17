# Wave 185 — 내 피드백 활동 가시화 (L7 / Loss Recovery compound loop)

## 컨텍스트

Wave 182c (정보 오류 신고 → 토큰 +3) + Wave 182 (운영자 검수 페이지) 박았지만 **사용자가 검수 결과 못 봄** → 신고 후 "어떻게 됐는지 모름" → 신고 동기 1회성.

사업 보고서 retention #6 (Loss Recovery 가시화) + L7 (Feedback Loop) — 가시화 없으면 compound loop 미작동.

```
[신고] → [토큰 +3] → [운영자 검수] → [???] ← 가시화 없음
```

가시화 후:
```
[신고] → [토큰 +3] → [운영자 검수] → [가시화] → [더 신고]
                                              ↓
                            [AI sample 증가 → 정확도 ↑ → 신뢰 ↑ → 더 사용]
```

## 박은 것

### 1. API — `/api/packs/me/feedback-activity` (GET)

`mvp_reveal_feedback` 에서 `feedback_type='inaccurate_report'` + `user_ref=<본인>` row fetch (최근 200건). 응답:

- `thisMonth`: 이번 달 신고 stats (totalCount/resolvedCount/pendingCount/dismissedCount/tokensReceived)
- `allTime`: 전체 기간 stats (동일 구조, 최근 200건 기반)
- `recentReports[]`: 최근 50건 list (자세히 보기 모달용) — listing meta 합침
- `monthLabel`: "2026년 5월"

추가 fetch 0 (이미 박힌 컬럼만 활용).

### 2. Component — `src/components/my-feedback-activity.tsx`

#### 카드 widget (대시보드 상단)
- 4 column 카운터: 신고 / ✅ 보정 / ⏳ 대기 / 🪙 토큰
- 누적 stats line (전체 기간 ≠ 이번 달 시)
- "자세히 보기" 버튼

#### 빈 상태 (allTime.totalCount === 0)
- 신고 권장 메시지 + 안내 ("매물 상세 → 🔍 정보 오류 신고 클릭 → 토큰 +3")

#### 자세히 보기 모달
- 필터: 전체 / ⏳ 대기 / ✅ 보정 / ❌ 기각
- 각 신고 카드:
  - 매물 thumbnail + 이름 + 신고 시간
  - status chip + 보상 토큰
  - 내 신고 (note prefix 카테고리 포함)
  - 운영자 응답 (있으면) — 시간 명시
  - 대기 상태일 때 "24h 안 응답" 안내

### 3. me-dashboard-client.tsx wire

`SavedMoneyCounter` 아래에 `MyFeedbackActivity` 박음. history view 진입 시 자동 표시.

## Trade-off

### Pros
- **compound retention loop 활성화** — feedback 가치 발현
- 운영자 응답 SOP 자동 압박 (사용자가 결과 보니까)
- "내가 사이트 보정에 기여" 자기효능감 → advocate 전환
- 추가 데이터 fetch 0 (기존 schema 활용)

### Cons
- 빈 상태 (allTime = 0) 가 대부분 사용자 — 초기 acquisition 단계
  → 빈 상태 메시지로 신고 유도 (긍정적)
- 운영자 응답 지연 시 사용자 클레임 가능
  → 운영자 SOP 강화 trigger (긍정적)

## Test 결과 (참고)

`npm run test:core`: 358/360 pass.
실패 2개 (`ipad-7`, `ipad-8`) 는 `tests/wave182-new-skus-parser.test.ts` — **다른 worktree (ipad SKU lane) 작업으로 추가된 새 테스트**. 본 wave 와 무관.
- 본 wave 새 파일/변경 영향 없음 (parser/test 미수정)
- ipad lane worktree 가 처리해야 함

## Follow-up

1. **운영자 응답 push 알림** — 사용자가 자세히 보기 안 들어가도 응답 인지. 알림 채널 결정 후
2. **신고 카테고리 별 dashboard** — 어떤 카테고리 신고 많은지 (price 부정확 다수 → 시세 mining 강화 등) 운영자 측 분석
3. **AI 자동 보조 보정** — resolved 신고 패턴 누적 → AI L2 가 비슷한 매물 자동 차단/보정
4. **사용자 leaderboard** — "이번 달 신고 top 10" — gamification (검토)

## Linked

- `2026-05-17-wave182-saved-money-counter-loss-report.md`
- `2026-05-17-wave182c-inaccurate-report-instead-of-loss-report.md`
- `2026-05-17-master-plan-deferred-items.md`
