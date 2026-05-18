# 2026-05-18 Wave 238 — Reveal feedback type scope

## 배경

`/me` retention 개선의 첫 단계로, 거래 상태 rail(`문의했어요 → 매수했어요 → 검수 완료 → 판매 완료`)을 붙이기 전에 feedback 데이터가 서로 덮어써지는 구조를 먼저 막았다.

기존 `mvp_reveal_feedback`은 `unique(user_ref, pid)`라서 같은 사용자가 같은 매물에 대해 하나의 feedback row만 가질 수 있었다. 이 구조에서는 `bought`, `watching`, `bad_pick`, `loss_report`, `inaccurate_report`가 같은 row를 두고 경쟁한다. 즉 정보 오류 신고가 매수 기록을 지우거나, 향후 매수 상태 CTA가 신고/보상 검수 row를 지울 수 있었다.

## 결정

1. `mvp_reveal_feedback` uniqueness를 `unique(user_ref, pid, feedback_type)`로 변경한다.
2. `submitRevealFeedback`, `loss-report`, `inaccurate-report` API upsert를 모두 `on_conflict=user_ref,pid,feedback_type`로 변경한다.
3. `loss_report`, `inaccurate_report`, admin 검수/보상 컬럼, `user_seen_at`을 schema/migration에 명시해 로컬 재현성을 맞춘다.
4. `/api/packs/me`는 한 pid에 여러 feedback row가 올 수 있으므로 표시용 feedback은 우선순위로 하나만 고른다.
   - `inaccurate_report`
   - `loss_report`
   - `bought`
   - `watching`
   - `interested`
   - `missed_sold`
   - `bad_pick`

## 보류

1. 거래 상태 rail 자체는 아직 붙이지 않았다. 이번 wave는 기반 데이터 보호가 목적이다.
2. append-only event ledger 또는 `mvp_reveal_status` 테이블은 보류했다. 지금은 기존 admin/feedback 화면 호환을 유지하기 위해 같은 테이블을 type-scoped로 확장하는 방식이 가장 안전하다.
3. SavedMoneyCounter의 `inaccurate_report` 보상 합산 수정은 다음 P0-2 작업으로 분리한다.
4. hard delete를 `hidden_at` soft-hide로 바꾸는 작업은 다음 P0-3으로 분리한다.

## 검증 계획

- `tests/me-page-contract.test.ts`에 type-scoped feedback contract를 추가했다.
- `git diff --check`
- `npx tsx --test tests/me-page-contract.test.ts`
- `npm run test:core`
- `npm run build`

