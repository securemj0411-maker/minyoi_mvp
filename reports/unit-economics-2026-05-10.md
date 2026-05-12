# 미뇨이 단위경제성 리포트

- 생성 시각: 2026. 5. 11. 오전 1:39:49
- 분석 구간: 최근 24시간 (2026-05-09T16:39:49.476Z 이후)
- 안정 구간: 최근 2시간 (2026-05-10T14:39:49.476Z 이후)
- 데이터 소스: Supabase 운영 로그, 후보팩 기록, AI 분류 비용 기록

## 한 줄 결론

주의 신호 1개가 있습니다: 전체 24시간 실패율은 41.1%지만 최근 2시간은 1.1%라 과거 스키마/설정 실패 영향 가능성이 큼.

## 안정 구간 판정

| 항목 | 전체 24h | 최근 2h | 판정 |
| --- | --- | --- | --- |
| cron 실패율 | 41.1% | 1.1% | 최근 안정 |
| QStash/day | 885 | 744 | free 안쪽 |
| detail claim/day | 13,086 | 24,804 | 처리량 기준 |
| score/day | 82,932 | 123,072 | pool 공급 기준 |
| pool upsert/day | 29,420 | 38,532 | 후보 공급 기준 |

### 실패 원인 Top

| 구간 | 원인 | count |
| --- | --- | --- |
| 전체 24h | supabase_schema_cache | 379 |
| 전체 24h | fetch_failed | 27 |
| 전체 24h | Supabase REST failed 400: {"code":"22P02","details":null,"hint":null,"message":"invalid in | 4 |
| 전체 24h | Supabase REST failed 500: {"code":"40P01","details":"Process 142976 waits for ShareLock on | 1 |
| 최근 2h | Supabase REST failed 500: {"code":"40P01","details":"Process 142976 waits for ShareLock on | 1 |

## 운영 처리량

| 항목 | 최근 구간 | 일 환산 | 월 환산/참고 |
| --- | --- | --- | --- |
| cron/worker 실행 | 1,000 | 1,000 | 실패율 41.1% |
| QStash 메시지 | 885 | 885 | free 1,000/day 기준 |
| 검색 API 호출 | 4,872 | 4,872 | 번개장터 rate-limit 예산 |
| 수집된 검색 row | 552,264 | 552,264 | 중복 포함 observation |
| detail claim | 13,086 | 13,086 | 성공 12,817 / 실패 131 |
| score 계산 | 82,932 | 82,932 | pool upsert 29,420 |
| 함수 실행 시간 | 24695.0초 | 24695.0초/day | p95 42.6초 |

## Worker별 병목

| worker | runs | fail | avg sec | search calls | queued | detail | scored | pool | AI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tick | 579 | 403 | 24.5 | 3,926 | 26,703 | 66/80 | 52,800 | 3,130 | 442 (1,264 cache) |
| detail-worker | 251 | 0 | 33.7 | 0 | 0 | 9,408/9,575 | 0 | 0 | 0 (0 cache) |
| deep-crawl | 48 | 3 | 24.3 | 946 | 15,970 | 0/0 | 0 | 0 | 0 (0 cache) |
| housekeeper | 38 | 0 | 0.3 | 0 | 0 | 0/0 | 0 | 0 | 0 (0 cache) |
| market-worker | 38 | 5 | 2.0 | 0 | 0 | 1,955/1,955 | 30,132 | 26,290 | 0 (0 cache) |
| pool-warmer | 27 | 0 | 20.2 | 0 | 0 | 1,020/1,095 | 0 | 0 | 0 (0 cache) |
| lifecycle-worker | 18 | 0 | 12.0 | 0 | 0 | 368/381 | 0 | 0 | 0 (0 cache) |
| /api/cron/collect?wait=1&pages=1&detailLimit=0&aiTopN=0 | 1 | 0 | 17.4 | 0 | 0 | 0/0 | 0 | 0 | 0 (0 cache) |

## 비용 모델

| 비용 항목 | 최근 구간 | 일 환산 | 월 환산 | 해석 |
| --- | --- | --- | --- | --- |
| OpenAI 분류 비용 | $0.007526 | $0.007526 | $0.2258 | DB 기록값; 118개 row, 45,995 input / 8,159 output tokens |
| QStash 초과 비용 추정 | $0.000000 | $0.000000 | $0.0000 | free 1,000/day 초과분만 $1/100k 가정 |
| Vercel 함수 비용 | 금액 미산정 | 24695.0초/day | 740850.8초/month | 플랜/메모리별 과금이라 시간 예산으로 추적 |
| Supabase 비용 | 금액 미산정 | 17,958 주요 API/day | DB row/read/write 별도 관찰 | 현재는 저장소/쿼리 병목 지표로 관리 |

비용 가정:
- OpenAI 분류 모델 기본 단가: input $0.4/1M tokens, output $1.6/1M tokens. 실제 운영 단가는 `OPENAI_CLASSIFIER_INPUT_USD_PER_1M`, `OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M` 환경변수로 덮어쓸 수 있습니다.
- QStash 기본 가정: free 1,000/day, 초과 $1/100k messages.
- Vercel/Supabase는 플랜별 과금 구조가 달라 지금은 금액보다 runtime seconds, API/detail calls, DB queue depth를 추적합니다.

## 카드팩 지표

| 항목 | 값 |
| --- | --- |
| 팩 오픈 | 14 |
| 성공 / 환불 / 실패 | 14 / 0 / 0 |
| 성공률 | 100.0% |
| 시도 카드 / 공개 카드 | 28 / 28 |
| 토큰 사용 / 환불 / 순사용 | 24 / 0 / 24 |
| 팩당 평균 OpenAI 비용 | $0.000538 |
| 팩당 평균 함수 시간 | 1763.9초 |

## 후보 풀 / 큐 상태

| 항목 | 값 |
| --- | --- |
| ready pool | 90건 |
| ready 평균 예상 순익 | 61,744원 |
| detail queue | done 991, failed 5, pending 4 |
| market key queue | done 697, pending 112 |
| market invalidation event | 2,977 |

### Pool by Band

| band:status | count |
| --- | --- |
| band1:invalidated | 78 |
| band2:invalidated | 47 |
| band1:ready | 34 |
| band3:invalidated | 34 |
| band2:ready | 29 |
| band3:ready | 27 |
| band3:spent | 4 |

### Pool by Category

| category:status | count |
| --- | --- |
| smartwatch:invalidated | 83 |
| earphone:invalidated | 72 |
| earphone:ready | 65 |
| smartwatch:ready | 25 |
| smartphone:invalidated | 3 |
| earphone:spent | 2 |
| smartwatch:spent | 2 |
| laptop:invalidated | 1 |

## 사용자 피드백

| feedback | count |
| --- | --- |
| interested | 4 |
| bad_pick | 1 |

## 리스크 플래그

- 전체 24시간 실패율은 41.1%지만 최근 2시간은 1.1%라 과거 스키마/설정 실패 영향 가능성이 큼

## 다음 액션

1. QStash 1~2시간 누적 후 이 리포트를 다시 실행해서 QStash/day, detail/day, pool ready 증가율을 비교합니다.
2. ready pool이 얕으면 수집량을 늘리는 게 아니라 comparable_key 시세 품질과 카테고리 readiness를 먼저 봅니다.
3. 팩 오픈 표본이 쌓이면 토큰 가격은 "팩당 실제 비용 + 환불률 + 부정 피드백률" 기준으로 재산정합니다.
