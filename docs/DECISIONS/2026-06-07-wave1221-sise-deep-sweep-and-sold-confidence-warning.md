# Wave 1221 — 시세 deep-sweep 감사 + 판매완료(sold) 표본 신뢰 경고

날짜: 2026-06-07 (KST)
계기: owner "매물 다 보고 시세 시스템 정확한지 deep sweep으로 버그 검토" → 전수 SQL 집계.

## Deep-sweep 결과 (전체 시세 + ready pool + fashion)
| 영역 | sold 0건(호가만) | sold 1~2 | sold ≥3(건강) |
|---|---|---|---|
| 전체 시세행 21,111 | **14,810 (70%)** | 3,119 (15%) | ~15% |
| tech ready(매칭 ~2,647) | 571 | 456 | → **~1,027(39%) ≤2 sold** |
| 의류 시세행 2,459 | 1,602 (65%) | 438 | **99 (4%)** |
| 신발 시세행 5,031 | 2,701 (54%) | 1,271 | 770 (15%) |

**핵심 발견 (systemic #1):** 시세의 다수가 **실거래(sold) 없이 호가(active)로만** 계산됨. 호가 > 실거래라 **과대평가 → 차익 과대 → 거짓 신호** (애플워치 clean: sold 1건 5만인데 시세 9.9만 = 매입8만이면 손해인데 차익난다고 표시 = §12b 위반). ~1,000개 tech + 의류 대부분 노출 중.
- **원인:** Wave 796 "표본<3 차단"이 `active+sold` **합산**을 봐서 호가-heavy 매물 통과 (sold만 봤어야 함).
- **공식은 정상:** sold가 있을 땐 blend 과대 거의 없음(49~77개뿐). 문제는 "sold 얇을 때 호가 지배"지 blend 식이 아님 (Wave 798c 식 안 건드림).

다른 발견: stale(tech ready 705개, Wave 1219 영역) · broad 버킷(NB992 색/사이즈, catalog 이슈, 위험 낮음).

## 결정 (owner): 차단(pool 축소) 대신 **정직 경고** (§12b + 일반인 친화)
sold 표본 기준 3단계로 "신뢰도 + 호가 기준 추정" 표시. blend/gate 미변경 = 안전.
- sold ≥3 → 정상
- sold 1~2 → ⚠️ "실거래 적음 · 신뢰도 낮음 — 호가 위주, 실제 거래가 다를 수 있음"
- sold 0 → 🚨 "판매완료 없음 — 현재 판매중(호가) 기준 추정, 실제 거래가 더 낮을 수 있음"

## 적용 (Wave 1221, 이번)
- **시세 근거 모달(market-source-debug.tsx)** 의 1220 요약 줄을 soldCount 기반 3단계 경고로 교체. TS clean. display-only.

## 미적용 (chip — 더 가시적 카드/reveal 배지)
- 카드(explore-client) + reveal(pack-reveal-modal) 시세 숫자 옆에 sold 기반 신뢰 배지. 데이터(card.marketBasis.soldSampleCount) 이미 있음. reveal 835~891줄 기존 "판매기록 부족" 톤과 통합. 메인 피드 다surface라 깨끗한 세션에서.

## 후속 (별개, 더 큰 결정 필요)
- (선택) thin-SOLD를 차단까지 갈지 = pool 축소 트레이드오프. 지금은 경고만(owner 결정).
- daangn freshness throughput(Wave 1219 후속 lever — marketStatsLimit 상향)으로 stale 줄이기.
