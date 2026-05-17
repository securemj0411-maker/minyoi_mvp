# Wave 181 — Pool 부족 진단 (ready 263 → 목표 500)

- 시간: 2026-05-17 KST
- 발견: 사용자 매분 풀 200대 중후반 보고 500 유지 원함. 다른 카테고리 진입 로그 확인 + 과거 측정 (Wave 96 = 536 ready) 비교 후 종합 진단.

## 현재 풀 상태 (SQL 측정)

```
status        cnt
─────────  ─────
invalidated  2,473  (89.3%)
ready          263  ← 사용자가 보는 수치
spent           27
```

활성 ready 263 카테고리별:
```
airpods       79
applewatch    47
shoe          39
ipad          30
iphone        25
galaxy_s      14
earphone       8
galaxywatch    7
macbook        6
galaxy_tab     5
speaker        2
game_console   1
```

톱5 = 220 (83.6% 집중). **monitor/desktop/home_appliance/camera/bag/bike/casio = ready 0**.

## invalidated 사유 분포 (top, 누적)

| 사유 | 건수 | 비고 |
|---|---:|---|
| profit_below_pack_band | 1,080 | 차익 1만 미만. 정상 cut |
| **lifecycle_state_missing_suspect** | **254** | **100% still SELLING — 버그 명백** |
| wave99_thin_market_n_lt_5 | 138 | 시세 표본 < 5 |
| pool_warmer_healthy_sale_status_inactive | 116 | 정상 (sale_status 변화) |
| **num_comment_above_8** | **111** | 108 still SELLING (97%) — 정책 strict 유지 |
| lifecycle_state_sold_confirmed | 110 | 정상 (sold) |
| pool_warmer_degraded_sale_status_inactive | 74 | 정상 |
| **seller_above_1_listings** | **71** | 67 still SELLING (94%) — 정책 strict 유지 |

## False invalidate 분석 (정정됨)

### 처음 분석 (틀림)
`sale_status='SELLING'` 만 체크 → 254건 100% still SELLING → "버그" 진단.

### 정정 — listing_state 까지 보면

| 사유 | total | listing_state breakdown | 진짜 false invalidate |
|---|---:|---|---:|
| `lifecycle_state_missing_suspect` | 254 | disappeared 235 / missing_suspect 18 / **active 1** | **1건 (0.4%)** |
| `num_comment_above_8` | 111 | still SELLING 108 — 사기 의심 정책 (유지) | 0 (의도) |
| `seller_above_1_listings` | 71 | still SELLING 67 — 사기 의심 정책 (유지) | 0 (의도) |

**핵심**: sale_status=SELLING 은 raw search API 에서 stale 하게 남는 값. lifecycle worker 가 detail 3회 연속 fail 시 listing_state=disappeared 박음 = 진짜 사라진 매물. invalidated_reason 컬럼은 처음 박힌 사유만 기록 (`missing_suspect` 단계) → 그 후 disappeared 로 갱신돼도 reason 컬럼은 안 바뀜.

**결론**: lifecycle 정책 잘 작동 중. False invalidate root fix 불필요. 진단 정정.

## 카테고리 다양화 누수 (24h)

| 카테고리 | parsed | analyzed | in_pool | ready | 누수 원인 |
|---|---:|---:|---:|---:|---|
| laptop | 1,690 | 1,530 | 117 | **6** | 시세 trusted_keys 1 (macbook only) |
| bag | 410 | 265 | 0 | 0 | catalog 미박힘 |
| watch | 265 | 147 | 42 | 0 | blocked 정책 (casio) |
| game_console | 199 | 128 | 27 | 1 | internal_only |
| speaker | 97 | 72 | 5 | 2 | 시세 trusted_keys 0 |
| bike | 79 | 67 | 0 | 0 | catalog 미박힘 |
| desktop | 61 | 49 | 13 | 0 | 시세 trusted_keys 0 |
| sport_golf | 55 | 54 | 6 | 0 | internal_only |
| monitor | 37 | 20 | 1 | 0 | 시세 trusted_keys 0 |
| camera | 36 | 22 | 1 | 0 | internal_only / 시세 0 |
| home_appliance | 12 | 6 | 1 | 0 | 공급 부족 + 시세 0 |

시세 trusted_keys (today):
```
airpods    13   galaxy_s   13   shoe       7
ipad        6   applewatch  5   earphone   5
iphone      2   macbook     1   ipad       6
bag         0   monitor     0   speaker    0
desktop     0   camera      0   game_console 1
home_appliance 0   casio    0   bike       0
```

## Profit gate 분석

24h SELLING+active+parsed (4,402건) 차익 분포:
- **< 1만원: 3,990 (90.7%)** — 게이트 완화해도 효과 미미
- 1만-2만: 91
- 2만-4만: 121
- 4만-7만: 75
- 7만+: 125

**결론**: profit gate 1만 → 7천 완화는 사용자 가치 저하 risk 대비 효과 X. 권장 X.

## 옵션 결정 (사용자 답)

사용자 정정 답변:
> "위험하게 뭐 죽인 매물 살리는 거임?? 죽인건 이유가 다 있는거 아님?? 아니면 잘못 죽인 패턴 보고 살릴 수 있는 방향?"
> "지금처럼 strict 유지"

해석:
- 사기 의심 정책 (num_comment / seller_above_1) **유지**
- 명백한 버그 (missing_suspect 100% false SELLING) **root fix**
- profit gate 완화 X
- 카테고리 다양화 (시세 보강, catalog 확장) ← 진짜 추천할만한 500개로 가는 길

## 추가 진단 — laptop 시세 trusted lane 실측

```sql
SELECT bucket, COUNT(*) FROM (laptop_keys joined market_daily) GROUP BY bucket
```

| bucket | 개수 |
|---|---:|
| no_market_row (시세 row 자체 X) | **331** |
| sample < 3 | 41 |
| sample 3-4 | 8 |
| sample 5-9 | 3 |
| **sample 10+** | **1** |

**laptop 384 narrow lane 중 시세 trusted = 4개 (1%)**. 매물 풍부해도 그 narrow 조합 (RAM/SSD/screen) 시세 없어서 다 cut.

macbook_pro 917 parsed → pool 47 → ready **3**:
- wave99_thin_market_n_lt_5: 26 (시세 표본 < 5)
- profit_below_pack_band: 12
- wave106_low_confidence_thin_sample: 2
- blocked_market_stat_missing: 2

score_flags 분포 (analyzed 1530건):
- coarse_market_price 136 / market_stat_missing 76 / market_confidence_low 60 — 다 시세 신뢰도

## 다음 — 풀 500 도달 옵션 (trade-off)

| 옵션 | 즉시 효과 | 정확성 risk | 비용 | §12b 부합 |
|---|---|---|---|---|
| A. 시세 fallback chain 확장 (narrow → broad model/year) | +50~100 즉시 | 약간 (다른 RAM/SSD 매물 시세 섞임) | 코드 수술 (Wave 179b 패턴 확장) | △ |
| B. 시세 sample threshold 완화 (5 → 3) | +30~50 즉시 | 약간 (적은 표본 신뢰) | 한 줄 수정 | △ |
| C. 자연 시세 표본 확보 (collect 시간) | 24h~1주 후 점진 | 0 | 0 (현재 cron이 알아서) | ✓ |
| D. catalog 확장 (LG그램, 갤럭시북, 레노보 narrow lane 추가) | 1~2주 | 0 (정확) | 큰 작업 (mustContain/mustNotContain) | ✓ |
| E. fallback chain + UI 표시 ("approximate market") | +50~100 | 사용자 정직 표시로 보완 | 코드 + UX | △→✓ |
| F. comparable_key broader (RAM/SSD 빼기) | +100+ 즉시 | 큰 손해 | 한 줄 | ✗ |
| profit gate 1만 → 7천 | < +30 | 사용자 가치 저하 | 한 줄 | ✗ |

§12b "정확성 절대 우선" 원칙상 A/B/E는 정확도 risk. F/profit_gate는 명백한 위반.

C/D만으로는 시간 걸림. 사용자 결정 필요.

## 사용자 결정 필요

E 옵션 (fallback chain + UI 표시) 가 가장 균형. 풀 늘리되 사용자한테 정직히 "이 시세는 broader category median" 표시.

또는 C+D 병행 + 시간 기다림 (즉시 효과 포기).

## 위험

- A/E 박을 때 비교 키 시세 가치 흐려짐. 추천 정확도 risk.
- C/D만 가면 1~2주 ready 그대로 200대.
