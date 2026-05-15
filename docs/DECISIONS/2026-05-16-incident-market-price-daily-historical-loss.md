# 사고 보고 — mvp_market_price_daily historical 1559 row delete (복원 불가)

## 1. 사고 요약

- 시간: 2026-05-15 19:23 UTC (= 2026-05-16 04:23 KST)
- 행동: `DELETE FROM mvp_market_price_daily WHERE condition_class = 'all'` (1559 row 삭제)
- 영향: 옛 historical 시세 데이터 (5/14 이전 30일치) 영영 잃음
- 복원: **불가능** (Daily Physical Backup 만, 5/14 22:14 UTC 가 최종, 21h 전 = 오늘 작업 다 잃음 위험. PITR add-on 안 박힘)

## 2. 결정 흐름 (잘못)

1. 사용자 코멘트 #95 처리: 옛 v43 매물 reparse + market-worker 호출 → 새 cc 별 daily row 생성 ✅
2. 옛 "all" row 1559 row 잔존 (wave 130 condition_class 추가 전 박힌 row)
3. 사용자: "시세 다시 잡자" — 의도 = 옛 cc 미분리 row 정리, 새 cc 별 row 만 남기기
4. 내가 옵션 A (delete) / B (자연 turnover) 제시 후 묻기
5. 사용자: "왜 쳐물어봐? 지금 당장" — 즉시 진행 지시
6. 내가 영향 명시 안 하고 즉시 DELETE 박음 ❌
7. 사용자가 "삭제한 거 sample 도 있었나?" 질문 → 영향 인지
8. 사용자가 시세 30일 차트 깨진 거 발견 (5/16 1일만 표시)
9. backup 확인 → 5/14 22:14 가 최종, restore 시 오늘 작업 다 잃음 → **받아들임**

## 3. 잘못한 점

1. **destructive 작업 전 영향 명시 안 함** — 옛 "all" row = historical chart 의 핵심 데이터인 거 미리 인지 못 했음. 매물별 sample_count + median + sold + active 등 다 잃음.
2. **사용자 모호한 지시 ("지금 당장") 받았을 때 한 번 더 묻기 안 함** — destructive 는 예외. "(영향 X 잃음. 진행 OK?)" 형태로 한 번 더 묻기 필요.
3. **Supabase backup 상태 사전 확인 안 함** — Daily Physical Backup 만 (download 불가, PITR 안 박힘) 인 거 사전 확인 했으면 destructive 더 신중.

## 4. 잃은 것

- mvp_market_price_daily 옛 condition_class='all' row 1559개 (5/14 이전 30일 historical 시세)
- 영향:
  - 시세 30일 추이 차트 (MarketHistoryChart) = 5/16 1일만 표시. 며칠 동안 정상 표시 안 됨.
  - 옛 시세 trends (어제 vs 오늘 비교) 추적 불가
  - 옛 시점의 active_sample_count / sold_sample_count 잃음

## 5. 복원 시도 결과 (실패)

- Supabase backup 상태:
  - Daily Backup: 5/14 22:14 UTC (= 5/15 07:14 KST) 가 최종. **5/15 backup 미생성** (around midnight = 매일 22:14 UTC 즈음, delete 시점은 다음 backup 전).
  - 모든 backup = **Physical** (download 불가, restore 만 가능)
  - **PITR add-on 미박힘** = 시점 복원 불가
- 복원 옵션:
  - A. 5/14 22:14 UTC 시점 전체 DB restore → 오늘 작업 (옛 v43 21k reparse + 11 narrow lane + market-source UI 3 fix + 다른 세션 wave 130~133) 다 잃음 = 너무 큰 비용
  - B. 부분 복원 (logical backup file 다운로드 → 옛 row 추출 → INSERT) → **불가능** (physical only)
  - C. 받아들임 → **선택**

## 6. 받아들임 + 회복 plan

- 옛 "all" row 1559개 영영 잃음
- 새 cc 별 row 524 (오늘 5/16 만) = 새 historical 시작점
- 매일 daily aggregate 누적 → 며칠 후 (5/30 즈음) 새 30일 historical 회복
- 그 동안 시세 30일 차트 깨짐 (5/16~ 만 표시) — 사용자 양해 필요

## 7. 재발 방지

- memory 박음: `feedback_destructive_actions_require_explicit_confirm.md`
- 다음 destructive 작업 (DELETE/DROP/TRUNCATE) 전:
  1. 영향 row count 측정
  2. 영향 컬럼/데이터 종류 명시
  3. 복원 가능성 평가
  4. 사용자에게 "(이거 delete 하면 X 잃음, 복원 가능성 Y) 진행?" 명시
- "지금 당장" / "ㄱㄱ" 같은 모호 지시도 destructive 면 한 번 더 묻기

## 8. 후속 (사용자 결정 후)

- PITR add-on 활성화 검토 (월 비용 발생, 향후 destructive 사고 방지)
- 미뇨이 시세 데이터 = 핵심 자산이므로 PITR 가치 클 가능성
