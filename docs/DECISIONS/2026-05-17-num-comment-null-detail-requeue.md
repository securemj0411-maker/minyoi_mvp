# 2026-05-17 옛 매물 num_comment NULL — detail 재fetch 큐 enqueue

## 배경

사용자 코멘트 id 141 (pid 386071832) + id 142 (pid 356650189):
- "Apple watch ultra 2 49mm 댓글이 9개인데 왜 나온거지??"
- "댓글 28개인데 ???? 댓글을 인식을 못하는거야?"

**진단**: Wave 132 댓글 8+ pool 차단 로직 박혀있지만, `mvp_raw_listings.num_comment` 가 NULL 인 옛 매물엔 적용 안 됨.

DB 검증:
- 총 ready pool: 285건
- num_comment NULL: **103건 (36%)** ← 옛 매물, Wave 132 차단 미작동
- num_comment 채워진 매물 중 >= 8: 0건 (Wave 132 정상 작동 중 — 새 매물만)
- NULL 중 24h 최근: 18건 (lifecycle 자연 catchup 가능)

## 옵션 검토

1. **즉시 invalidate (36% 차단)** — 안전하지만 사용자 풀 큰 hit (285 → 182)
2. **detail 재fetch 큐 enqueue** ← 추천
3. **자연 누적 (lifecycle 회전)** — 며칠~몇 주

## 박은 변경

```sql
INSERT INTO mvp_detail_queue (pid, status, priority, available_at)
SELECT cp.pid, 'pending', 100, now()
FROM mvp_candidate_pool cp
JOIN mvp_raw_listings r USING(pid)
WHERE cp.status = 'ready' 
  AND r.num_comment IS NULL
ON CONFLICT (pid) DO UPDATE SET 
  status = 'pending',
  available_at = now(),
  attempts = 0,
  last_error = null,
  locked_until = null,
  updated_at = now()
WHERE mvp_detail_queue.status IN ('done', 'failed');
```

**결과**: 102건 enqueue (이미 pending/processing 인 1건 skip).

## 효과 + Trade-off

- detail-worker 가 1-2 cycle (5-10분) 안 처리
- bunjang detail API +102 호출 (1회성)
- 처리 후 `num_comment` 채워짐 → Wave 132 차단 자동 작동
- 사용자 풀에 다음 score-stage cycle 부터 정확한 차단 반영
- **id 141/142 매물 둘 다 포함** — 처리 후 즉시 차단될 것

## 부수 효과

이번 enqueue 로 NULL 매물의 `bunjang_condition_label` 도 같이 fetch 됨 (옛 매물 backfill 부분 효과).
- handoff "다음 세션 후보 1번 — 옛 매물 detail re-fetch backfill" 의 102 건 부분 처리

근본 fix (자동 backfill cron) 는 보류 — deferred-decisions log 의 P3 참조.

## 마킹

id 141 + id 142 는 detail-worker 처리 + score-stage 차단 확인 후 mark. 현재 임시 처리 단계.
