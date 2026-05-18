# 2026-05-18 Wave 240 — Pack reveals soft-hide

## 배경

`/me`의 선택 삭제/전체 삭제는 사용자가 대시보드를 정리하려는 행동이다. 하지만 기존 API는 `mvp_pack_reveals`와 `mvp_reveal_feedback`를 둘 다 hard delete했다.

이 방식은 화면에서는 깔끔하지만, 신고/매수/관심/포기 같은 retention 학습 신호와 운영자 검수 기록을 같이 잃는다. Wave 238에서 feedback type scope를 분리한 목적과도 충돌한다.

## 결정

1. `mvp_pack_reveals`에 `hidden_at`, `hidden_reason`, `hidden_source`를 추가한다.
2. `/api/packs/reveals/delete`는 더 이상 DELETE하지 않고 `mvp_pack_reveals`를 PATCH한다.
3. `mvp_reveal_feedback`은 삭제하지 않는다.
4. `/api/packs/me`는 `hidden_at is null`인 reveal만 조회한다.
5. hidden row도 `unique(user_ref, pid)`와 dedupe 대상에는 계속 남긴다. 사용자가 숨긴 같은 매물을 다시 추천받지 않게 하기 위함이다.

## 보류

1. 숨김 복구 UI는 보류한다. 지금 사용자 니즈는 "삭제/숨기기 버튼"으로 정리하는 흐름이다.
2. 숨김 상품 별도 탭/아카이브는 보류한다.
3. tombstone 전용 숨김 사유 UI는 추후 거래 상태 rail과 함께 정리한다.

## 검증

- `/me` contract test에 soft-hide 조건을 추가했다.
- `git diff --check`
- `npx tsx --test tests/me-page-contract.test.ts`
- `npm run test:core`
- `npm run build`

