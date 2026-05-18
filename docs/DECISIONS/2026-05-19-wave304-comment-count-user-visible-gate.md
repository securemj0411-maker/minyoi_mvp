# 2026-05-19 Wave 304 — comment count user-visible gate

## Context

사용자가 `/me` 추천 보관함에서 댓글 18개 매물이 그대로 보이는 문제를 지적했다.

기존 정책은 Wave 132에서 `num_comment >= 8`이면 pool 진입 차단이었다. 하지만 `/api/packs/me`는 `mvp_raw_listings.num_comment`를 읽지 않았고, 이미 reveal된 매물이 이후 댓글/번개톡 8개 이상으로 올라가도 사용자 보관함에서 자동 제외되지 않았다.

## Decisions

1. `/me` 응답에서도 `num_comment >= 8`을 사용자 노출 차단 기준으로 적용한다.
   - raw에 이미 `num_comment >= 8`이 박힌 reveal은 응답에서 제외한다.
   - 동시에 해당 reveal을 `hidden_at` soft-hide 처리하고, raw는 `pool_eligible=false`, `score_dirty=false`로 내려 future pool 재진입을 막는다.

2. `/me` live verify에서도 detail의 `commentCount >= 8`을 확인한다.
   - 판매완료/사라짐 확인과 같은 요청 시점 검증 경로에 얹었다.
   - detail에서 새로 8개 이상이 확인되면 candidate pool을 invalidated 처리하고 보관함에서 숨긴다.

3. pack open 직전에도 raw/detail 댓글 수를 재확인한다.
   - 이미 pool에 있던 후보라도 raw `num_comment`가 8 이상이면 reveal하지 않는다.
   - fresh하지 않아 detail verify를 타는 후보는 detail `commentCount`가 8 이상이면 reveal하지 않고 pool을 invalidated 처리한다.

## Verification

- `npx tsx --test tests/me-comment-count-gate-contract.test.ts`

## Deferred

- 아주 짧은 freshness window 안에 댓글이 8개 이상으로 급증한 후보는 pack open에서 detail verify를 생략할 수 있다. 이 경우 `/me` live verify에서 즉시 soft-hide된다. 토큰 차감 전 100% 방지를 원하면 pack open에서 댓글 기준 detail check를 항상 수행해야 하지만, API 비용/지연이 커져 별도 판단으로 남겼다.
