# Wave 254.4 (2026-05-20) — production cron NOT stuck (date confusion 정정)

## 발단

사용자 보고 — "production cron stuck 9h+ 즉시 진단 우선" + 이전 agent 분석 (Wave 254.5 step 1 commit message 내) "cron 멈춰있다" 가정.

## 진단 결과 — **cron은 정상 작동 중**

### root cause of perceived "9h+ stuck"

KST date (`2026-05-20`) vs UTC timestamps (`2026-05-19`) **직접 비교** 오류:
- 시스템 context: `Today's date is 2026-05-20` (KST, 한국 시간)
- DB clock: `2026-05-19 20:30:39+00` (UTC)
- KST 05:30 = UTC 20:30 (전날) — 9h gap 는 timezone 차이일 뿐

이전 분석에서 "`mvp_detail_queue` newest_update 2026-05-19 20:09" 가 KST 2026-05-20 새벽 기준으로는 stale 처럼 보이지만 실제 UTC 기준 21분 전 — **정상**.

### 실측 cron 활동 (UTC, last 5 min):
- `tick` (5min 주기): 20:30:03 시작, 58.4s duration, 성공
- `detail-worker` (3min 주기): 20:30:02 + 20:33:00 — 8s avg, 모두 성공
- `lifecycle-worker`: 20:28:40 succeeded
- `market-worker`: 20:22:01 succeeded (1h 주기)
- `pool-warmer`: 20:17:01 succeeded
- 1h 합계: 13 tick / 20 detail-worker / 17 lifecycle / **0 failures**

### Wave 254.3 / 252.B / 253 효과 발현 중:
- `mvp_detail_queue:done` 60건 / 5min (active processing)
- `mvp_listing_parsed clothing v7` 83 업데이트 / 5min (active reparse)
- `mvp_detail_queue:processing` 0 / `:pending` 109 (정상 대기열)

### 이전 9 tick 실패 (UTC 05:45~19:30):
- 모두 "stale running run auto-marked after 3m" — Vercel 3min function timeout
- 일부 heavy load run 이 3min 초과 → lock watchdog 가 auto-fail 처리
- 최근 1h 실패 0건 — 일시 부하 → 회복 완료

## 추가 발견 — Wave 254.5 step 1 deploy 진행 중

- commit `4b10017` push: 2026-05-19 **20:23:32 UTC**
- DB NOW: 2026-05-19 **20:34 UTC**
- 경과: **~10분** (Vercel build 보통 3-5분, deploy 직후 cron이 cold start 거침)

post-push activity:
- 20:23:32 ~ 20:27:10 사이 141 shoe matters parsed → 모두 **v7** (옛 코드, Vercel build 진행 중)
- 20:30+ 이후 shoe parse 0건 (cron load 분산 또는 build 완료 직전)
- v8 첫 record 미발현 — Vercel deploy 완료 대기 (5~10분 추가 예상)

## Wave 254.5 step 1 효과 발현 path

### 자연 reparse 영향 범위 (Wave 254.5 deploy 후)

| parser_version | total shoe | score_dirty=true (자연 reparse 가능) |
|---|---|---|
| `wave92-fashion-mobility-v3` | 9,109 | 4,655 (51.1%) |
| `wave92-fashion-mobility-v7` | 1,574 | 1 (0.1%) |
| `wave92-fashion-mobility-v2` | 659 | 659 (100%) |
| `wave92-fashion-mobility-v4` | 162 | **0** ⚠️ |

**자연 reparse 가능**: ~5,315건
**자연 reparse 불가** (score_dirty=false): ~5,569건 — Wave 252.B silent miss residual 영역

### 사용자 매물 pid 408858108 (가젤 볼드) 상태:
- `parser_version = wave92-fashion-mobility-v4` (희귀 v4)
- `condition_class = mint` (잘못 — fix 대상)
- `condition_score = 0.95`
- `condition_notes = []` (Wave 130 default — fix 후 채워질 예정)
- `score_dirty = false` — **자연 reparse 안 됨**
- `queue_status = done` (이미 처리됨)
- `last_seen_at = 12h 전` (alive 매물)

## 자율 진행 X — 사용자 결정 필요

사용자 정책 (오늘 prompt):
- ❌ "DB DELETE / DROP 박지 마라"
- ❌ "새 코드 fix 박지 마라"
- ❌ "destructive UPDATE 박지 마라"
- ✅ "진단 + cron 재시작 만"

→ cron 재시작 불필요 (정상). 추가 fix/UPDATE 안 함.

## 사용자 결정 대기 옵션

### A. 자연 reparse 만 의지 (보수적)
- Wave 254.5 deploy 완료 후 (~5-10분) v8 shoe 자동 등장
- score_dirty=true shoe 5,315건 → 다음 tick cycle 부터 자동 v8 reparse
- **pid 408858108 등 score_dirty=false 매물 5,569건은 안 됨** ⚠️
  → 사용자 매물 (pid 408858108) fix 안 발현 (이건 옛 v4 + dirty=false)

### B. Wave 252.B 식 manual rematch trigger (사용자 정책 명시 승인 시)
- `triggerRematchForParserVersions(['wave92-fashion-mobility-v3', 'v4', 'v7', 'v2'], reason)`
- shoe 10,884건 score_dirty=true 박힘 → cron 자동 reparse 보장
- Wave 253 helper 사용 (INSERT IGNORE detail_queue)
- 사용자 매물 pid 408858108 도 포함

### C. 사용자 매물 만 spot fix (pid 408858108)
- 단일 PATCH `score_dirty=true` for pid 408858108
- 다른 매물 영향 X
- 가장 안전 but 사용자 다른 매물 (다른 코멘트들) 미커버

## 미완 후속

- Wave 254.5 deploy 완료 확인 — 다음 측정 (5-10분 후) v8 shoe record 등장 여부
- 사용자 결정 (A/B/C) 받은 후 진행
- Wave 254.5 step 2 (bag) / step 3 (clothing) 대기
- 모니터링 개선 — cron stuck 자동 알림 / KST-UTC date 라벨링 (사람이 잘못 비교 방지)
