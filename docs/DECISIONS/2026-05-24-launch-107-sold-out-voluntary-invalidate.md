# launch-107 — sold_out 신고 즉시 임시 invalidate (voluntary cron Phase 2)

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: 사용자가 매물을 "거래 완료" 카테고리로 신고 시 즉시 풀에서 빠짐 + 운영자 결정으로 정식/복귀

## 배경

기존 흐름:
- 사용자 sold_out 신고 → `mvp_user_feedback` insert + 운영자 텔레그램 알림 + status=pending.
- 운영자 승인까지 매물 풀에 그대로 노출 → 다른 사용자도 그 매물 보고 클릭 → 시간 낭비.

사용자 요청 (Phase 2): 신고 즉시 풀에서 빼서 다른 사용자 보호, 운영자 거절 시 복귀.

## 변경

### 서버 1 — `/api/feedback/submit/route.ts`

**dedup check** (악용 방지):
- 같은 (`auth_user_id`, `pid`, `category=sold_out`) 24h 안 1회 제한.
- 중복이면 `duplicate_report` 429 응답.

**즉시 임시 invalidate**:
- `category === "sold_out"` && `pidValid != null` 이면 `mvp_candidate_pool.status='invalidated'` + `invalidated_reason='user_report_sold_pending:fb{id}'` PATCH.
- 다른 사용자한테 즉시 안 보임 (recovery-worker 화이트리스트에 없는 reason 이라 자동 복귀 차단).

**텔레그램 메시지 보강**:
- sold_out 만 "⚠ 즉시 풀 제외됨 — 거절 시 자동 복귀" 추가.

### 서버 2 — `/api/admin/feedback/decide/route.ts`

**approve + sold_out**:
- `invalidated_reason='user_report_sold_confirmed:fb{id}'` 로 정정.
- `mvp_raw_listings.listing_state='sold_confirmed'` + `sold_detected_at=now` 정식 마킹.
- 신고자 +20 크레딧 (기존).

**reject + sold_out**:
- `status='ready'` 복귀 (단, reason 정확 매칭 `user_report_sold_pending:fb{id}` 만 — 다른 cron 이유로 invalidate 됐으면 보존).
- `invalidated_reason=null`, `score_dirty=true`.

### UI

- cau `feedback-panel.tsx` (brief): sold_out row 에 `⚠ 풀 제외` 뱃지.
- `loss-reports/feedback-review-full.tsx`: sold_out + pending row 에 `⚠ 풀 제외 중` 뱃지 (운영자 빨리 결정 시그널).

## 자동 처리

`recovery-worker` 의 `RECOVERABLE_INVALIDATED_REASONS` 가 명시적 화이트리스트 방식 → `user_report_*` reason 은 자동 제외. 별도 차단 코드 불필요.

## 영향

- sold_out 신고 즉시 다른 사용자 보호 (운영자 결정 wait 안 함).
- 거짓 신고 → 운영자 거절 → 매물 자동 복귀 + 신고자 보상 0.
- 진짜 sold 신고 → 운영자 승인 → 정식 sold_confirmed + 신고자 +20.

## 후속

- Phase 3 (클릭/노출 카운터 + user-driven velocity signal) 별도 wave.
