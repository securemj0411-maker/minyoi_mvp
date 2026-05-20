# 2026-05-20 — 댓글 8개 이상 매물 ready 누출 차단

## 배경

사용자 확인 매물 `408438635` (`미개봉 아이폰 17프로 맥스 256`)이 번개장터 상세에서 댓글 24개인데 운영자 pool ready에 남아 있었다.

## 원인

- DB raw 값은 `num_comment=1`, `detail_enriched_at=2026-05-16`으로 오래됐다.
- `candidate_pool`은 `status=ready`, `last_verified_at=2026-05-20T10:17:11Z`로 최신이었다.
- 번개 상세 API live 확인 결과 `commentCount=24`, `viewCount=208`, `favoriteCount=9`.
- `pool-warmer`가 detail을 가져와 alive 여부만 보고 `last_verified_at`을 갱신했지만, `detail.commentCount`를 raw에 저장하거나 댓글 8개 이상 ready를 invalidate하지 않았다.
- 그 결과 pack open은 `last_verified_at`이 fresh이고 raw 댓글 수가 존재한다고 판단해 live detail 확인을 생략할 수 있었다.

## 조치

- `pool-warmer`가 detail fetch 성공 시 raw `num_comment`와 `detail_enriched_at`을 갱신한다.
- `pool-warmer`에서 `commentCount >= 8`이면 `candidate_pool`을 `invalidated`로 내린다.
- pack open은 raw 댓글 수가 있어도 `detail_enriched_at`이 6시간 초과 stale이면 live detail을 다시 확인한다.
- 문제 pid `408438635`는 즉시 `num_comment=24`, `pool_eligible=false`, `candidate_pool.status=invalidated`로 수동 반영했다.

## 크론 점검 메모

- QStash 호출 자체는 들어오고 있다: tick/detail/lifecycle/market/pool-warmer/deep-crawl 최근 run 존재.
- 단 `deep-crawl`은 최근 다수 run이 `stale running run auto-marked after 3m`로 실패 처리되어 병목/timeout 의심.
- `mvp_source_health` 최신 상태는 `degraded`, reason은 `deep_crawl_failure_rate_high`.
- backlog: detail pending 31, detail failed 2498, lifecycle due 3039, market invalidation pending 966.
- Vercel CLI token은 invalid라 Vercel runtime 로그 직접 조회는 실패했다. DB run log 기준으로 후속 개선 필요.

## 보류

- `deep-crawl` timeout 원인 분해와 QStash/Vercel runtime log 직접 연결은 별도 운영 점검으로 이어간다.
