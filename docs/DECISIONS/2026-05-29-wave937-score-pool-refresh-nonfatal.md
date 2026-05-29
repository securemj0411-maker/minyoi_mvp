# 2026-05-29 Wave 937 — score pool refresh chunk 실패 non-fatal 처리

## 배경

당근 score 3-shard 적용 후 최근 실패 로그를 확인하니 A score worker가 간헐적으로
`mvp_raw_listings` REST 500에서 실패했다.

실패 지점은 새 raw candidate를 점수화하는 핵심 경로가 아니라, 기존 `mvp_candidate_pool`
행을 다시 읽어 최신 계산으로 갱신하는 `loadDirtyPoolScorableRows` 보조 경로였다.

## 결정

- `loadDirtyPoolScorableRows`의 raw listing chunk fetch가 실패하면 해당 chunk만 넘기고
  score run 전체는 계속 진행한다.
- 이 경로는 다음 cron에서 다시 시도 가능한 pool refresh 성격이므로, 전체 worker 실패보다
  non-fatal skip이 운영상 안전하다.

## 기대 효과

- Supabase REST가 일시적으로 500을 반환해도 A score worker 전체 실패를 줄인다.
- 당근 A/B/C score 처리량이 한 chunk 오류 때문에 끊기지 않는다.

## 보류

- REST 500의 근본 원인(index/쿼리 플랜/DB 부하)은 별도 관찰한다.
- score batch size 증설은 3-shard 안정화 후 다시 판단한다.
