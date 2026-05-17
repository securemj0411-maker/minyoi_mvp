# 2026-05-17 보류 결정 — Plan agent 15 iter audit 후속

## 배경

Plan agent 가 15 iteration 으로 미뇨이 서버 로직 thorough audit 진행 (commit `4734176` 이후).
9 클루지 + 6 ground truth gap + 효율 win 발견. 사용자 검토 후 "파괴적 X + 무조건 좋은 것" 만 박음.
나머지는 trade-off 있어서 보류 — 이 log 에 사유 + 박을 조건 박음.

## P0 보류

### 1. PARSER_VERSION bump 후 자동 reparse cron (P0 #2)

**Agent 발견**: PARSER_VERSION v44 → v45 → v46 bump 시 옛 매물 자동 reparse 없음.
현재 manual `npm run reparse:listings -- --legacy=1` 만. 옛 21K 매물 stale.

**제안 fix**: housekeeper cron 에 `parser_version != CURRENT` 매물 N건/cycle reparse 박음 (limit 200, 점진).

**사용자 보류 사유**:
- AI L2 호출 비용 spike 우려 (모호 매물 일시적 catchup 시 1.5K → 5K/일 가능)
- 자동 cron 통제 어려움 — 운영자 결정 후 manual mass reparse 선호
- 자연 누적 (lifecycle worker 가 active 매물 재방문) 으로 점진 catchup 가능

**박을 조건**:
- 옛 stale 매물이 사용자 컴플레인 다수 받으면
- 또는 cron throttle 메커니즘 (max N/cycle, max $X/day) 추가 후

### 2. AI L2 score-stage condition_class sync (P0 #7 — Plan agent 추천)

**Agent 발견**: `classifyWithAi` (pipeline.ts:1407) prompt 가 Wave 141 에서 condition_class 분류 task 포함됨. 결과의 `conditionClass` 가 `AiClassification` type 에 있지만 **mvp_listing_parsed.condition_class 에 sync 안 됨**. dead data.

**Agent 추천**: 결과 활용 — score-stage AI L2 거친 ~290건/일 condition_class 정확도 ↑. 비용 0 (이미 호출 중).

**사용자 보류 사유**:
- 사용자가 "B (classifyWithAi) 일단 disable 할까?" 검토 단계
- B disable 대신 sync 박을지, B 자체 폐기할지 결정 보류
- B 역할 = 의심 매물 second-opinion (가짜/위조 catch). 비용 $5/월

**박을 조건**: B 유지 결정 시 sync 박음 (30분 작업).

## P1 보류

### 3. `mvp_candidate_pool.condition_class` column drop + parsed JOIN (P1 #2)

**Agent 발견**: condition_class 가 4 곳 저장 (parsed.column + pool.column + market_daily.column + (옛) parsed_json). pool reparse 후 sync 필요.

**제안 fix**: pool builder 가 pool row 에서 condition_class 빼고, 사용처 (pack-open, market-source 등) 가 parsed JOIN 으로 read.

**사용자 보류 사유**:
- 큰 schema 변경 + downtime 위험
- JOIN performance impact 검증 필요
- 이번 v46 cleanup 박은 후 자연 sync 깨질 때 다시 평가

**임시 대안**: 이번 SQL UPDATE 로 24건 sync 박음 (위 v46-cleanup batch log 참조).

### 4. low_batt + flawed 2-axis schema (P1 #6)

**Agent 발견**: condition_class = 단일 enum. low_batt 신호 + flawed 신호 동시 있으면 low_batt 만 표현됨 (v46 ordering). 가격 modifier 정보 정확히 표현 못함.

**제안 fix**: `damage_class` (clean/worn/flawed) + `battery_class` (ok/low) 2-axis schema.

**사용자 보류 사유**:
- migration 작업 큼 (column 추가 + 모든 reader 갱신)
- 현재 condition_class 단일 enum 으로 시세 grouping 작동 중 — 큰 정확도 손실 없음
- low_batt + flawed 동시 케이스 빈도 낮음

**박을 조건**: 사용자 코멘트에서 low_batt 분리 요청 다수 받으면.

## P2 보류

### 5. cron route 4개 boilerplate dedup (P2 클루지)

**Agent 발견**: 8 cron route (collect, detail-worker, market-worker, pool-warmer, tick, deep-crawl, housekeeper, lifecycle-worker, reference-price-refresh) 의 `requestMeta` / `firstForwardedIp` / `truncate` / `handleX` 90% 중복.

**제안 fix**: `withCronRunLogging(req, mode, handler)` shared helper 1개로 dedup.

**사용자 보류 사유**:
- 8 file 동시 변경 risk (typo / import 빠짐 → cron crash)
- "파괴적 X + 무조건 좋은 거" 정의에서 벗어남
- 효과: 코드 정리만 (런타임 영향 X)

**박을 조건**: cron 추가 시 또는 cron bug fix 시 한 곳에서 박을 필요 생기면.

### 6. `flawed` 한 통에 7종 함수결함 + bundle 묶임 (P2 클루지)

**Agent 발견**: FLAWED_NOTES 13종이 모두 condition_class = "flawed" 한 통. 시세 sample 차단/pool 차단 동일이지만 UI 디버깅 시 구분 불가.

**제안 fix**: FLAWED_NOTES 안 sub-class 분리 (functional/cosmetic/commercial 등).

**사용자 보류 사유**:
- UX 정확성 (사용자 디버깅) 만 win — 시세 정확도 영향 X
- 사용자 컴플레인 없음

**박을 조건**: 사용자가 flawed 매물 디버깅 어려움 호소 시.

### 7. regex context-blind mitigator (P2 ground truth)

**Agent 발견**: display_defect / cosmetic_wear regex 가 "미세하게/약간/거의" 같은 modifier 무시. pid 403616114 케이스 (액정 깨끗한데 골드기스 미세) → flawed false positive.

**제안 fix**:
- regex 에 mitigator 패턴 ("미세/약간") 검출 추가
- 또는 AI L2 (Wave 141 Layer B) ambiguous trigger 조건 확장 (display_defect 신호 + "미세/약간" 동시)

**사용자 보류 사유**: 
- pid 403616114 한 케이스만 발견. 빈도 검증 필요
- AI L2 trigger 확장 시 비용 spike 가능

**박을 조건**: 사용자 코멘트에서 flawed false positive 다수 보이면.

## P3 보류

### 8. `bunjang_condition_label` NULL 옛 매물 backfill (P3)

**Agent 발견**: detail-worker 가 매물당 1회만 detail fetch. 옛 매물 (#122 fix 박힌 5/16 이전 detail fetch) 는 `bunjang_condition_label = NULL`.

**제안 fix**: 7일+ 매물 강제 detail re-fetch cron (lifecycle 안 흡수).

**사용자 보류 사유**:
- bunjang detail API rate limit 압박 (현재 detail-worker throughput 박빵)
- lifecycle worker 가 active 매물 자연 재방문 — 옛 sold/missing 매물은 backfill 안 됨
- 사용자 컴플레인은 active 매물 위주

**박을 조건**: bunjang rate limit 여유 확보 후 또는 옛 매물 backfill 컴플레인 시.

## 큰 작업 보류 (별도 wave 후보)

### 9. catalog gap (TV/세탁기/냉장고 SKU 부족) — P1

**Agent 발견**: 226 SKU 중 신발 79 / 가방 35 / smartphone 81 vs monitor 9 / small_appliance 1 / desktop 7. **TV/세탁기/냉장고 카테고리 SKU 없음**.

**사용자 보류 사유**: 가전 카테고리 진입 = 별도 wave (Wave 130+ 신규 카테고리 진입과 동급). catalog 작성 + ground truth 검증 큰 작업.

### 10. `poolMaxExposure` 측정/A-B test 없음 (P1)

**Agent 발견**: `poolMaxExposure(band)` profit band 별 hardcode. 측정 / A/B / per-user dedup 없음.

**사용자 보류 사유**: 정책 변경 + 측정 인프라 필요. 별도 wave.

### 11. `mvp_raw_listings` schema 분리 (P1)

**Agent 발견**: staging + analytics 한 table. 18 column SELECT 무거움.

**사용자 보류 사유**: 큰 migration + downtime. 별도 wave.

### 12. `loadExistingPoolSellerCounts` cache (P2)

**Agent 발견**: 매 score-stage run 호출. Redis 5분 TTL cache 가능.

**사용자 보류 사유**: 5분 stale risk (새 매물 dedup 정확도 미세 ↓). 사용자 메모리: trade-off 있으면 안 박음.

### 13. pool `last_verified_at` filter (P2)

**Agent 발견**: profit 큰 매물 매 cron 재verify. fresh 한 매물에 detail API 낭비.

**제안 fix**: `last_verified_at >= 30분` filter 추가.

**사용자 보류 사유**: 의도 변경 (profit 큰 매물 자주 verify 정책). 미세 trade-off.

## 사용자 정책 다른 영역 응용 (Iter 5 — 미적용)

### 14. 시세 sample < N fallback p25 (vs 현재 active_median × 0.92)

**제안**: 사용자 conservative 정책 (보수적 등급 낮추기) 을 시세 산정에도 적용. sample 부족 시 active_median × 0.92 대신 p25 fallback.

**보류 사유**: 카테고리별 calibration 부재 (TODO 마킹 박혀 있음). 별도 wave (P2 ground truth #15).

### 15. pool 진입 worn 매물 expected_profit × 0.85 discount

**제안**: 셀러 인플레 가능성 고려, worn 매물 expected profit 디스카운트.

**보류 사유**: 정책 변경 + 측정 필요.

### 16. lifecycle 강제 detail re-fetch (7일+)

**제안**: `last_verified_at` 7일+ 매물 강제 detail re-fetch (description 변경 catchup).

**보류 사유**: bunjang rate limit 압박. 별도 정책 결정.

## 메모

- 이 log = "각 보류 결정의 사유" 보존. 향후 우선순위 재평가 시 reference.
- handoff memory "feedback_decision_log_required.md" 정합 — 보류도 로그.
- 향후 사용자가 우선순위 결정 시 이 log 참조 → 박을 조건 충족 여부 검토 후 박음.
