# 2026-05-19 Wave 306 — comment count backfill gap

## Context

사용자가 `갤럭시 워치6 클래식47 실버` 매물이 댓글/번개톡 16개인데 왜 pool에 들어왔는지 지적했다.

확인 결과 해당 매물은 원본 업데이트 시간이 2025-12-07인 오래된 매물이고, 우리 DB의 detail enrichment는 2026-05-10에 끝났다. 댓글/번개톡 수를 `metrics.buntalkCount`로 매핑한 Wave 132b는 2026-05-16 04:38 KST에 들어왔기 때문에, 그 이전에 이미 `detail_status=done`이었던 row는 `num_comment`가 비어 있는 상태로 scoring/pool 경로에 들어갈 수 있었다.

즉 이번 케이스는 pool 진입 후 댓글이 하루 만에 폭주한 것이 아니라, 오래된 detail row의 `num_comment` backfill gap이다.

## Decisions

1. search/detail queue에서 Wave 132b 이전에 상세수집된 row 중 `num_comment`가 비어 있으면 다시 detail refresh 대상으로 본다.
   - `loadExistingRaw`가 `num_comment`를 읽도록 확장했다.
   - `needsDetailRefresh`가 `detail_enriched_at < Wave132b cutoff && num_comment is null`이면 재상세수집한다.

2. pack open 직전에도 `raw.num_comment`가 비어 있으면 fresh 후보라도 live detail verify를 강제한다.
   - 기존 fresh window는 판매완료 stale 방지용이었다.
   - 댓글/번개톡 gate는 user-visible 품질 gate라서 raw 값이 없으면 fresh로 간주하지 않는다.
   - live detail에서 `commentCount`를 받으면 raw `num_comment`도 backfill한다.

## Verification

- `npx tsx --test tests/me-comment-count-gate-contract.test.ts tests/wave132-num-comment-gate.test.ts`
- `npm run test:core`

## Deferred

- 기존 DB 전체의 `num_comment is null` row를 즉시 일괄 backfill하는 배치 작업은 보류했다. 이번 보강으로 search 재발견/pack open 경로에서 점진 보정되며, 필요하면 운영 스크립트로 ready/reserved pool부터 우선 backfill한다.
