# 2026-06-02 Wave 1024 — velocity UI 정직화와 category tail starvation 수정

## Trigger

사용자 질문: "회전률 계산도 프론트에 잘 보여주고 있음?? 판매주기도 정확함?"

## Findings

- 프론트 노출은 존재한다.
  - `/me`/피드 teaser: `velocitySignalLabel`
  - 상세 쉬운모드: "판매 속도" 단계와 "되팔 때 판매 주기" 카드
  - lookup: "시세 회전주기"
- 운영 DB 최신 velocity row는 존재한다.
  - 최신 `mvp_market_velocity_daily.date = 2026-06-02`
  - 최신 `computed_at = 2026-06-02T12:19:21Z`
  - 최근 `/api/cron/sync-market-velocity` 성공 run: 5,623 rows upsert
- 정확도 한계도 명확하다.
  - 현재 화면이 쓰는 velocity는 `condition_class=all` 중심이다.
  - source별/상태별 판매주기라기보다 같은 모델 전체 기준의 참고값이다.
  - lookup 문구가 "같은 등급 매물 기준"이라고 말해 실제 데이터보다 강하게 표현하고 있었다.
- cron 구조 한계:
  - 300s route deadline 때문에 최근 run은 앞쪽 category 10개 처리 후 tail 10개를 `skipped_route_deadline` 처리했다.
  - 기존 주석은 "다음 cron이 남은 category picks up"이라고 했지만, 실제 코드는 항상 같은 order로 시작해 tail category가 반복적으로 굶을 수 있었다.

## Decision / Changes

- 피드 velocity chip은 "보통 N일 내 팔림" 같은 보장성 톤을 제거했다.
  - `observed_sold_sample_count < 3`이면 chip 미표시.
  - high/medium은 `평균 N일 회전`, low는 `참고 N일 회전`.
- 상세 쉬운모드 low-confidence velocity는 "되팔면 보통..." 대신 참고용 톤으로 낮췄다.
- 쉬운모드 판매 주기 카드에 "같은 모델 전체 기준의 참고값" 안내를 추가했다.
- lookup "시세 회전주기" 문구를 `같은 모델 전체 기준`으로 수정했다.
- `sync-market-velocity` category order를 tail-rotation 방식으로 변경했다.
  - 핵심 category 6개(`clothing`, `shoe`, `smartphone`, `bag`, `earphone`, `tablet`)는 매 run 먼저 처리.
  - 나머지는 6h slot 기준으로 순서를 회전해 `watch/drone/lego/...` 등이 계속 skip되지 않게 했다.

## Deferred

- source-aware velocity: 당근/번개/중고나라별 판매주기 분리는 아직 미구현.
- condition-aware velocity: S급/A급/사용감 등 상태별 회전주기 분리는 아직 미구현.
- incremental velocity aggregate: 현재 category 전체 재집계 방식보다 lifecycle observation 기반 incremental 집계가 장기적으로 더 지속 가능하다.

## Verification Plan

- `npx tsx --test tests/detail-beginner-guide-contract.test.ts tests/free-plus-entitlement-contract.test.ts`
- `npm run build`
- 다음 sync-market-velocity run에서 `stage_stats.stages.sync_market_velocity.per_category` tail category 처리 여부 확인.
