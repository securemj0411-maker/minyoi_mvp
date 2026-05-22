# 2026-05-22 — launch-43: stale invalidated 재평가 cron 진단 (측정 후 무 변경 결정)

## 배경

launch-42 / 42b 박은 후 사용자 짚음:
> "근데 매분 돌면 다른 크론이랑 충돌 안해?"

→ score_worker 부담 / 충돌 우려. 다른 세션과 협력하여 측정 기반 결정.

## 핵심 측정 결과 (LAUNCH_PLAN 원칙 9 준수)

### 1. score_worker 진짜 부담
- 1시간 39 runs, **avg 40s / p95 72s / max 88s / 13 failed (33%)**
- 90s lease 한계 근접
- Stage breakdown 미측정 (코드에 stage-level ms timing X)

### 2. recovery cron 가치 (launch-42b 이후)
- 1 sample run: `score_recovered_market_invalidated_pool_dirty_marked_rows: 206`
- 매 분 200+ 매물 score_dirty 마킹 = 작동 중
- 1h invalidated→ready 전환 = **115건** (recovery cron + 자체 메커니즘 합산)
- 마킹 → ready 전환 비율 ~1.4% (대부분 시세 회복 X = 정상)

### 3. market-worker capacity (옵션 B 검증)
- 매 시간 schedule, lease 90s
- 8 runs / 24h: **3 timeout, 4 lease 80%+, 1 overshoot 101.7%**
- → **이미 lease 한계**. 빈도 ↑ 박으면 timeout 더 자주 + 처리량 변화 X

### 4. market_invalidations 큐 enqueue vs 처리 (옵션 B 추가 검증)
| 일자 | enqueued | done | pending | pending % |
|---|---|---|---|---|
| 5/22 | 2,858 | 701 | 2,157 | 75.5% ← spike |
| 5/21 | 7,651 | 6,782 | 869 | 11.4% |
| 5/20 | 3,025 | 2,684 | 341 | 11.3% |
| 5/19-15 | 평균 1,500 | 평균 1,400 | 평균 100 | 평균 9% |

→ **평소 7-13% pending = 정상**. 4,022 backlog = 일시적 spike, 자연 해소.

### 5. 사업 KPI (다른 세션 측정)
- daily detail-access ~30 (베타 1-7 unique users)
- daily ready 증가 ~50건 (5/22 spike 97 포함, 평소 30-40)
- `max_exposure = 5` (ready 매물 100%)
- **capacity ratio = (50 × 5) / 30 = 8.3x 잉여**

## 결정 — 무 변경

### 옵션 별 폐기 사유

| 옵션 | 폐기 사유 |
|---|---|
| A. recovery cron 분리 | score_worker 33% 실패율의 root X. 마킹 → ready 전환률 1.4%, 그러나 절대값 (115/h) 좋음. capacity 8.3x 잉여라 emergency 아님. |
| B. market-worker 빈도 ↑ | lease util 75-100% capacity 한계. 빈도 ↑ 박아도 timeout 더 자주. backlog 자연 해소 (어제 87% 처리 입증). |
| G. DB-side PL/pgSQL | **사실상 비현실**. catalog.ts 8000줄 + 다른 세션이 catalog 매일 수정 중. SQL migration 동기화 불가. 검토 자체 무의미. |
| D. 무 변경 + 측정 더 | ✅ 채택. capacity ratio 8.3x = 현 시스템 충분. |

### launch-42 / 42b 의 현재 상태
- 작동 중. 매 분 200+ 매물 마킹, 1h 115건 ready 전환
- score_worker 부담 +5-10초 추정 (정확 측정 X)
- **유지** — capacity 잉여하니 score_worker 33% 실패 운영 지표 영향 0

## 다음 액션 (별 wave)

### 🔴 가장 중요 — ready 신선도 검증
다른 세션 발견:
- 5/14 (8일 묵은) ready 매물 **21건** still in pool
- 5/13 (9일+) ready 2건
- 5/10 (12일+) 거의 빠짐

가능 원인:
- lifecycle-worker 매 5분 worker 가 따라가지 못함 (backlog)
- launch-41 직전 joongna 매물 sold 누락
- bunjang lifecycle missing_suspect → disappeared 전환 lag

**진짜 risk**: 사용자가 8일 묵은 매물 reveal → sold 발견 → 신뢰 박살. **capacity 부족보다 더 critical**.

측정 plan:
- 8일+ ready 21건의 raw_listings.listing_state 분포 (active vs sold/disappeared)
- 그 매물들의 mvp_lifecycle_checks.next_check_at (cron 큐 상태)
- 별 wave 사용자 reveal 시 sold 감지율 측정

### 🟡 architecture refactor plan (10x traffic 도달 전)

**옵션 E (event-driven scheduled retry)** — 장기 best:
- `mvp_raw_listings.next_score_check_at` 컬럼 추가
- invalidate 시점 미래 시간 박음 (사유별: 시세 6h, parser 24h)
- score-worker 가 score_dirty=true OR next_score_check_at 만료 매물 처리
- recovery cron 자체 폐기
- 비용: migration + invalidatePoolEntries 호출처 ~10-15곳 수정

**옵션 F (worker split)** — 단기 best:
- score-worker 분해:
  - fast (scoring 본업, 매 분, lease 30s)
  - cleanup (unscorable cleanup, residue, 매 5분)
  - recover (market recovery, parser recovery, 매 5분)
- 각자 자체 lease + 책임
- Vercel 병렬 효과 (Supabase connection 부담 점검 필요)
- 비용: 새 cron route 2개 + vercel.json schedule 2개

**추천 순서**: 사용자 traffic 5-10x 도달 시 F 먼저 (단기), E 그 후 (장기).

## 메모리 룰
- 측정 없는 plan 금지 (LAUNCH_PLAN 원칙 9) — 이번 wave 가 좋은 사례
- 1 sample 데이터로 결론 점프 금지
- 사업 KPI 와 운영 지표 구분 — 33% 실패율 ≠ emergency
- 다른 세션 협력 — 같은 wave 의 진단 nested review 가치
- capacity ratio = (daily_ready × max_exposure) / daily_detail_access — 미래 사용자 추적용 metric

## 영향
- 코드: 무 변경
- DB: 무 변경
- 메모리: 측정 기반 결정 사례 + 별 wave 후보 (E/F architecture, ready 신선도)
- decision log: 이 파일

## 향후 추적
- launch-42b 의 회복률 24-48h 후 재측정 (지금 1h 115건, 24h 추정 +2700)
- ready 8일+ 매물 카운트 추이
- daily detail-access vs daily ready 증가 ratio (capacity ratio) 추적
