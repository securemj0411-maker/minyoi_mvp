# 미뇨이 단위경제성 리포트

- 생성 시각: 2026. 5. 10. 오후 8:45:14
- 분석 구간: 최근 24시간 (2026-05-09T11:45:14.438Z 이후)
- 안정 구간: 최근 2시간 (2026-05-10T09:45:14.438Z 이후)
- 데이터 소스: Supabase 운영 로그, 후보팩 기록, AI 분류 비용 기록

## 한 줄 결론

주의 신호 1개가 있습니다: 전체 24시간 실패율은 61.9%지만 최근 2시간은 2.0%라 과거 스키마/설정 실패 영향 가능성이 큼.

## 안정 구간 판정

| 항목 | 전체 24h | 최근 2h | 판정 |
| --- | --- | --- | --- |
| cron 실패율 | 61.9% | 2.0% | 최근 안정 |
| QStash/day | 915 | 1,056 | free 초과 |
| detail claim/day | 7,296 | 30,516 | 처리량 기준 |
| score/day | 52,057 | 132,000 | pool 공급 기준 |
| pool upsert/day | 16,342 | 42,384 | 후보 공급 기준 |

### 실패 원인 Top

| 구간 | 원인 | count |
| --- | --- | --- |
| 전체 24h | supabase_schema_cache | 592 |
| 전체 24h | fetch_failed | 27 |
| 최근 2h | supabase_schema_cache | 2 |

## 운영 처리량

| 항목 | 최근 구간 | 일 환산 | 월 환산/참고 |
| --- | --- | --- | --- |
| cron/worker 실행 | 1,000 | 1,000 | 실패율 61.9% |
| QStash 메시지 | 915 | 915 | free 1,000/day 기준 |
| 검색 API 호출 | 1,986 | 1,986 | 번개장터 rate-limit 예산 |
| 수집된 검색 row | 278,787 | 278,787 | 중복 포함 observation |
| detail claim | 7,296 | 7,296 | 성공 7,149 / 실패 69 |
| score 계산 | 52,057 | 52,057 | pool upsert 16,342 |
| 함수 실행 시간 | 22717.2초 | 22717.2초/day | p95 34.9초 |

## Worker별 병목

| worker | runs | fail | avg sec | search calls | queued | detail | scored | pool | AI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tick | 730 | 611 | 23.6 | 1,664 | 15,327 | 66/80 | 35,400 | 1,804 | 329 (929 cache) |
| detail-worker | 156 | 0 | 30.0 | 0 | 0 | 5,654/5,735 | 0 | 0 | 0 (0 cache) |
| deep-crawl | 32 | 3 | 13.8 | 322 | 10,524 | 0/0 | 0 | 0 | 0 (0 cache) |
| housekeeper | 29 | 0 | 0.3 | 0 | 0 | 0/0 | 0 | 0 | 0 (0 cache) |
| market-worker | 28 | 5 | 1.7 | 0 | 0 | 793/793 | 16,657 | 14,538 | 0 (0 cache) |
| pool-warmer | 16 | 0 | 17.1 | 0 | 0 | 505/553 | 0 | 0 | 0 (0 cache) |
| lifecycle-worker | 9 | 0 | 7.9 | 0 | 0 | 131/135 | 0 | 0 | 0 (0 cache) |

## 비용 모델

| 비용 항목 | 최근 구간 | 일 환산 | 월 환산 | 해석 |
| --- | --- | --- | --- | --- |
| OpenAI 분류 비용 | $0.001090 | $0.001090 | $0.0327 | DB 기록값; 140개 row, 54,406 input / 9,675 output tokens |
| QStash 초과 비용 추정 | $0.000000 | $0.000000 | $0.0000 | free 1,000/day 초과분만 $1/100k 가정 |
| Vercel 함수 비용 | 금액 미산정 | 22717.2초/day | 681516.0초/month | 플랜/메모리별 과금이라 시간 예산으로 추적 |
| Supabase 비용 | 금액 미산정 | 9,282 주요 API/day | DB row/read/write 별도 관찰 | 현재는 저장소/쿼리 병목 지표로 관리 |

비용 가정:
- OpenAI 분류 모델 기본 단가: input $0.4/1M tokens, output $1.6/1M tokens. 실제 운영 단가는 `OPENAI_CLASSIFIER_INPUT_USD_PER_1M`, `OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M` 환경변수로 덮어쓸 수 있습니다.
- QStash 기본 가정: free 1,000/day, 초과 $1/100k messages.
- Vercel/Supabase는 플랜별 과금 구조가 달라 지금은 금액보다 runtime seconds, API/detail calls, DB queue depth를 추적합니다.

## 카드팩 지표

| 항목 | 값 |
| --- | --- |
| 팩 오픈 | 3 |
| 성공 / 환불 / 실패 | 3 / 0 / 0 |
| 성공률 | 100.0% |
| 시도 카드 / 공개 카드 | 6 / 6 |
| 토큰 사용 / 환불 / 순사용 | 6 / 0 / 6 |
| 팩당 평균 OpenAI 비용 | $0.000363 |
| 팩당 평균 함수 시간 | 7572.4초 |

## 후보 풀 / 큐 상태

| 항목 | 값 |
| --- | --- |
| ready pool | 56건 |
| ready 평균 예상 순익 | 63,395원 |
| detail queue | done 987, pending 8, failed 5 |
| market key queue | done 482 |
| market invalidation event | 1,361 |

### Pool by Band

| band:status | count |
| --- | --- |
| band1:invalidated | 47 |
| band2:ready | 25 |
| band3:invalidated | 24 |
| band2:invalidated | 22 |
| band1:ready | 18 |
| band3:ready | 13 |
| band3:spent | 2 |

### Pool by Category

| category:status | count |
| --- | --- |
| smartwatch:invalidated | 56 |
| earphone:ready | 38 |
| earphone:invalidated | 33 |
| smartwatch:ready | 18 |
| smartphone:invalidated | 3 |
| earphone:spent | 2 |
| laptop:invalidated | 1 |

## 사용자 피드백

| feedback | count |
| --- | --- |
| interested | 1 |

## 리스크 플래그

- 전체 24시간 실패율은 61.9%지만 최근 2시간은 2.0%라 과거 스키마/설정 실패 영향 가능성이 큼

## 다음 액션

1. QStash 1~2시간 누적 후 이 리포트를 다시 실행해서 QStash/day, detail/day, pool ready 증가율을 비교합니다.
2. ready pool이 얕으면 수집량을 늘리는 게 아니라 comparable_key 시세 품질과 카테고리 readiness를 먼저 봅니다.
3. 팩 오픈 표본이 쌓이면 토큰 가격은 "팩당 실제 비용 + 환불률 + 부정 피드백률" 기준으로 재산정합니다.
