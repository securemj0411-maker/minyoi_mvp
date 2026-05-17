# Wave 194 — 운영자 응답 toast + 카드 unread 배지

## 사용자 결정

> "1. 이건 사이트 내 알림에서 해야될듯..??알림 기능 만들자 ㅇㅋ?? 아니면 알림까지는 너무 오바면 /me페이지 들어갈때 toast??이런걸로 제대로 알려주던가"

→ **B 옵션**: /me toast + 카드 🔴 배지. 1~2일.

## 박은 것

### 1. DB 마이그레이션 — `wave194_reveal_feedback_user_seen_at`

```sql
ALTER TABLE mvp_reveal_feedback ADD COLUMN IF NOT EXISTS user_seen_at TIMESTAMPTZ;

CREATE INDEX mvp_reveal_feedback_user_unread_idx
  ON mvp_reveal_feedback (user_ref, admin_responded_at DESC)
  WHERE feedback_type = 'inaccurate_report' AND admin_responded_at IS NOT NULL;
```

nullable + IF NOT EXISTS — 비파괴.

### 2. unread 정의
```ts
unread = admin_responded_at != null
       && (user_seen_at == null || user_seen_at < admin_responded_at)
```

### 3. API 변경

#### `/api/packs/me/feedback-activity` — unreadCount + 각 row unread 박음
- 응답에 `unreadCount: number` 추가
- `recentReports[]` 의 각 row 에 `userSeenAt`, `unread: boolean` 추가

#### `/api/packs/me/feedback-mark-seen` (POST, **새 endpoint**)
- 사용자 inaccurate_report 중 admin_responded_at 박힌 row 전체 → `user_seen_at = now()` PATCH
- 호출 시점: MyFeedbackActivity 자세히 보기 모달 열 때 (자동)
- 비파괴 — user_seen_at 만 update

### 4. UI — `MyFeedbackActivity`

#### widget (대시보드 상단)
- 제목 옆 🔴 N 배지 (unreadCount > 0)
- "자세히 보기 →" 버튼이 unread > 0일 때:
  - rose 색 배경
  - 라벨 "🔴 운영자 응답 {N}건 확인 →"
  - 클릭 시 자동 mark-seen 호출 + 로컬 unreadCount = 0

#### 자세히 보기 모달 — 각 신고 카드
- 운영자 응답 박스가 unread 일 때:
  - rose 색 + ring 2 (강조)
  - 라벨 "🆕 운영자 응답:" prefix

### 5. 첫 진입 Toast

대시보드 history view 진입 시 (MyFeedbackActivity 첫 fetch 후):
```
unreadCount > 0 → 5초 floating toast
"🔔 운영자가 회원님 신고에 응답했어요 (N건)
 아래 [내 피드백 활동] → 응답 N건 확인 클릭."
```
- 우측 X 닫기 버튼
- 5초 자동 사라짐 (cancel-able)
- z-index 60 (모달보다 낮음, 카드보다 높음)

## 비파괴 검토

- ADD COLUMN nullable — 기존 row 영향 0
- mark-seen API: user_seen_at 만 update — 다른 컬럼 영향 0
- UI: 기존 동작 그대로 + unread 추가 표시만
- 자동 mark-seen: 모달 열 때만 (사용자 의도 명확)

## Trade-off

### Pros
- 사용자 응답 확인 marsupial loop 완성 (Wave 185 compound retention)
- 알림 기능 (헤더 drawer) 만들지 않고도 충분한 UX
- 운영자 SOP 압박 — 사용자 본 후 응답 quality 자동 ↑

### Cons
- 한 화면 (/me history view) 에만 표시 — 다른 화면에서 알 수 없음
- 핸드폰 잠금 화면 푸시 알림 X — 사이트 들어와야 인지
- mark-seen over-mark — admin_responded_at 박힌 모든 row 일괄 처리 (per-row 정밀 X). 영향 미미.

## Test

`npm run test:core`: **375/375 pass** (이전 fail 도 다른 worktree 가 처리한 듯).

## Follow-up

1. **헤더 알림 drawer** (Option A) — 알림 종류 늘어나면 통합
2. **per-row mark-seen** — 특정 신고만 mark (현재는 전체 일괄)
3. **사용자 push 알림** (텔레그램) — 사이트 안 들어와도 인지 (Daily Brief 와 같이)
4. **toast UX 개선** — animation / 위치 옵션

## Linked

- `2026-05-17-wave185-feedback-activity-visibility.md`
- `2026-05-17-wave182c-inaccurate-report-instead-of-loss-report.md`
