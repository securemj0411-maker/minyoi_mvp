# 2026-05-20 — 핫딜 텔레그램 알림 중복 발송 차단 P0

## 결정

`mvp_hotdeal_reservations`에 UNIQUE (pid, user_ref) 부재 + `claim_next_hotdeal_for_alert` RPC의 가드 버그로 같은 사용자에게 같은 매물 알림이 5일간 평균 42.9회 중복 발송. 즉시 RPC fix + DB cleanup + UNIQUE constraint.

## 사용자 피드백

> "텔레그램 운영자 알림이나 핫딜알림이나 dedupe 작업하자 진짜;;"

→ 운영자(admin) chat 한 명에게만 5일간 6,390건 알림. 149 distinct pids × avg 42.9 dup.

## 진단 — 정확한 버그

`claim_next_hotdeal_for_alert` v1의 NOT EXISTS 가드:
```sql
not exists (
  select 1 from mvp_hotdeal_reservations r2
  where r2.pid=p_pid and r2.user_ref=tb.user_ref
    and (r2.decision in ('opened','purchased','rejected')
         or (r2.decision = 'pending' and r2.expires_at >= v_now))
)
```

문제: **`decision='pending' AND expires_at < now` (만료된 pending)** 가드를 통과.

매 cron 호출 (30분 간격) 흐름:
1. 이전 reservation의 `expires_at` 지남 (HOTDEAL_RESERVE_WINDOW_SECONDS=900s 추정)
2. 만료된 pending 무시
3. 새 reservation INSERT + `notification_sent=true`
4. 텔레그램 메시지 재발송
5. 30분 후 반복

→ **5일 × 48 cron/day = 240회**. 실측 dup count 200+ 정확히 일치.

## 실측 데이터

| 지표 | 값 |
|---|---|
| 영향받은 사용자 | **1명** (auth:cd77f148... admin) |
| 영향받은 매물 | 149 distinct pids |
| 총 reservation rows | 6,390 |
| 평균 dup per (pid,user) | **42.9회** |
| 최대 dup (단일 pid) | **208회** (5/15 13:47 ~ 5/20 00:17) |
| 알림 발송 (notification_sent=true) | 6,389건 |
| 사용자 결정 (opened/purchased/rejected) | 0건 (다 pending 또는 expired) |

→ 일반 사용자 영향 X. admin 본인 chat만. 다만 5일간 6,389개 메시지 받음.

## 변경 (What)

### 1. Supabase RPC v2 (apply 완료)
`claim_next_hotdeal_for_alert` NOT EXISTS 가드 강화:
```sql
-- Before
and not exists (
  select 1 from mvp_hotdeal_reservations r2
  where r2.pid = p_pid and r2.user_ref = tb.user_ref
    and (r2.decision in ('opened','purchased','rejected')
         or (r2.decision = 'pending' and r2.expires_at >= v_now))
)

-- After (v2)
and not exists (
  select 1 from mvp_hotdeal_reservations r2
  where r2.pid = p_pid and r2.user_ref = tb.user_ref  -- 영구 차단. state 무관.
)
```

→ (pid, user_ref) 쌍 1회 발송만 허용.

### 2. Dup row cleanup (DELETE)
사용자 결정 옵션 A 진행:
```sql
WITH oldest_per_pair AS (
  SELECT id, pid, user_ref,
    ROW_NUMBER() OVER (PARTITION BY pid, user_ref ORDER BY sent_at ASC, id ASC) AS rn
  FROM mvp_hotdeal_reservations
)
DELETE FROM mvp_hotdeal_reservations
WHERE id IN (SELECT id FROM oldest_per_pair WHERE rn > 1);
```

- **6,241 row 삭제** (각 pair oldest 1 row 보존)
- 남은 149 row = 149 distinct pairs
- attempt_no history 일부 손실 (의도 — 사용자 결정)

### 3. UNIQUE constraint (DB-level 이중 안전망)
```sql
alter table public.mvp_hotdeal_reservations
  add constraint mvp_hotdeal_reservations_pid_user_unique
  unique (pid, user_ref);
```

→ RPC 가드(application-level) + UNIQUE(DB-level) 이중 안전망. race condition 또는 향후 코드 버그로 dup 시도해도 DB가 즉시 차단.

## 안전성

- DELETE는 **사용자 명시 confirm 후 실행** (옵션 A 선택). 메모리 "DELETE 사전 영향 명시 필수" 룰 준수
- 각 (pid, user) 쌍 oldest row 보존 → history 일부 유지 (첫 sent_at, attempt_no=1)
- 사용자 결정 row(decision != null) 없었음 (전부 pending 또는 expired) — 정보 손실 적음
- UNIQUE constraint 추가 시 conflict 없음 확인 (dup=0)
- RPC v2 + UNIQUE 이중 안전망 → 향후 race condition 방어

## 검증 (실측)

```
Before:  total_rows  6,390  / distinct_pairs   149  / dup_excess  6,241
After:   total_rows    149  / distinct_pairs   149  / dup_excess      0
         constraints: PK(id) + UNIQUE(pid,user_ref) + decision CHECK
```

## 후속 (P1)

1. **operator-brief / incident-watch 알림에도 dedup 검토** — 일일/사고 알림은 cadence 다르지만 cron 중복 실행 시 위험. cron-guard 확인
2. **`mvp_hotdeal_queue.status` lifecycle 점검** — `reserved` 상태에서 expires_at 지났을 때 자동 `available` 복귀 로직 있는지 / 의도된 행동인지
3. **알림 cadence rate-limit** — 단일 사용자 24h 알림 수 cap (예: 20건) 추가. recent_5 / last_24h weight는 이미 있으나 hard cap 없음
4. **operator-brief 같은 운영 알림** — kakao-memo-test 흐름 점검. 같은 패턴 dup 위험 있는지

## 관련

- 메모리: "DELETE/DROP 사전 영향 명시 필수" — 본 DELETE는 사용자 confirm 후 진행
- velocity P0-1 정직성 원칙 — 알림도 같은 원칙 (사용자 신뢰 영향)
- 메모리: "운영자가 매번 짚어줘야 하는 lapse 차단" — 5일간 6,389건 발송된 게 lapse. 본 fix로 차단
