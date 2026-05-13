# Wave 55 — 4 cron 가전·테크·IT lane coverage 검증

> Status: **measure-only.** DB write 0, candidate_pool write 0, public promotion 0, DDL 0, PS5 patch 0. 4 cron(tick/detail/lifecycle/housekeeper) 가동 후 신규 lane 수집/파싱 실제 분포 측정 + DEFAULT_SEARCH_QUERIES / queryFamily 갭 정리.

## 1. 4 cron 60분 활동 (mvp_collect_runs)

trigger_source는 Upstash-QStash 단일. mode 기준 분해:

| mode | runs | ok | not_ok | collected | enriched | scored | upserted |
|---|---:|---:|---:|---:|---:|---:|---:|
| tick | 11 | 7 | 4 (3 fail + 1 running) | 7,488 | 0 | 1,024 | 990 |
| detail_worker | 17 | 17 | 0 | 0 | 183 | 0 | 101 |
| lifecycle_worker | 3 | 3 | 0 | 0 | 51 | 0 | 6 |
| lifecycle_terminal_recheck | 3 | 3 | 0 | 0 | 29 | 0 | 23 |
| housekeeper | 2 | 2 | 0 | 0 | 0 | 0 | 133 |

→ **4 cron 모두 실제 firing 중**. tick fail 3건은 세션 전반 동일 transient `mvp_sellers fetch failed`.

## 2. 60분 raw + parsed delta

| Metric | Value |
|---|---:|
| new_raw_rows (first_seen_at) | **46** |
| distinct sku_id (matched) | 5 |
| distinct query | 15 |
| new_parsed_rows (parsed_at) | 197 |
| new_parsed v31 비율 | 197 / 197 = 100% |
| needs_review=true | 80 / 197 |

(parsed > raw 차이는 lifecycle/score path가 기존 raw row를 재파싱하는 정상 동작.)

## 3. 신규 raw 분포 — 쿼리/카테고리 별

| query | rows |
|---|---:|
| 에어팟 | 11 |
| 갤럭시 S23 | 8 |
| 갤럭시 S24 | 5+1 |
| 아이폰 13/15/16 | 3+2+2 |
| 아이폰 14 | 1 |
| 갤럭시 S25 | 2 |
| 아이패드 프로/에어/미니 | 1+1+1+1 |
| 갤럭시워치 | 2 |
| 애플워치 | 1 |
| 맥북에어/맥북프로 | 1+2+1 |

→ **smartphone / tablet / laptop / earphone / smartwatch** 5 family로 100% 분포. **0 monitor, 0 JBL/speaker, 0 Sony WH/Bose 헤드폰, 0 게임콘솔, 0 가전, 0 desktop**.

## 4. 신규 parsed 분포 — family별

| family | rows | needs_review |
|---|---:|---:|
| airpods | 39 | 3 |
| ipad | 26 | 6 |
| iphone | 15 | 1 |
| macbook | 14 | 6 |
| applewatch | 13 | 0 |
| monitor | **7** | 0 |
| galaxy_s | 7 | 0 |
| speaker | **6** | 0 |
| galaxywatch | 4 | 0 |
| galaxy_tab | 2 | 0 |

monitor 7 / speaker 6은 자연 수집 아님 — Wave 54 cap=16 acquisition apply가 직전에 들어가서 parsed에 반영된 결과. 자연 cron만 보면 monitor/speaker = **0**.

## 5. Internal-ready lane 자연 수집 여부

| lane | 자연 inflow (60분) | 평가 |
|---|---:|---|
| monitor_exact_model_code (LG 27UP850N, BenQ XL2540K…) | 0 | **uncovered** |
| speaker_jbl_flip6 | 0 | **uncovered** |
| airpods_max_usbc | 일부 (에어팟 11건 중 max 변형 포함 가능) | 부분 coverage |
| sony_headphone_xm4_ch520 / bose_qc_ultra / bose_qc45 | 0 | **uncovered** |
| galaxy_buds_3_pro | 0 (에어팟 query만) | **uncovered** |
| ipad_pro_11_m4_256_wifi | 부분 (아이패드 프로 1건) | 부분 coverage |
| switch_oled_base_unit_only | 0 | **uncovered** |
| ps5_disc_basic / ps5_digital_basic / ps5_slim_* | 0 | **uncovered** |
| desktop (iMac/Mac mini/Mac Studio) | 0 | **uncovered** |
| home_appliance (Dyson/Roborock) | 0 | **uncovered** |

→ **8개 lane 자연 cron 0 coverage**. 부분 coverage 2개.

## 6. DEFAULT_SEARCH_QUERIES (src/lib/pipeline-config.ts:1) 갭

현재 39개 query:
- earphone (5): 에어팟, 에어팟 프로, 에어팟 프로2, 에어팟 4세대, 에어팟 맥스
- smartwatch (8): 애플워치 (+SE/9/10/Ultra), 갤럭시워치 (+6/7/Ultra)
- laptop (2): 맥북프로, 맥북에어
- smartphone (16): 아이폰 13~16 series + 갤럭시 S23~25 series
- tablet (8): 아이패드 프로/에어/미니/10세대 + 갤럭시탭 S8~10

**누락 (자연 cron coverage 부재)**:

| 카테고리 | 권고 query 후보 (예시) |
|---|---|
| monitor | "모니터", "LG 모니터", "BenQ 모니터", "27인치 모니터", "LG 27UP850N", "BenQ XL2540K", "벤큐 조위", "울트라기어" |
| speaker (JBL) | "JBL 스피커", "JBL Flip", "JBL 플립", "Marshall 스피커", "보스 스피커" |
| headphone (Bose/Sony WH) | "Bose 헤드폰", "보스 큐씨", "Bose QC", "Sony 헤드폰", "WH-1000XM", "WH 1000XM5", "소니 헤드폰", "비츠 헤드폰" |
| game_console | "PS5", "플스5", "플레이스테이션 5", "닌텐도 스위치", "스위치 OLED", "PS5 슬림" |
| home_appliance | "다이슨", "Dyson 청소기", "로보락", "Roborock", "샤크 청소기" |
| desktop | "맥미니", "Mac mini", "iMac", "맥스튜디오", "Mac Studio" |

가전·테크·IT 자연 coverage 확보를 위해 **최소 6 카테고리 × 평균 3 query = 18 query 추가** 권고.

## 7. queryFamily / cadence 동작 확인

- `src/lib/search-query-cadence.ts:30 queryFamily`: 에어팟/워치/아이폰·갤럭시 S/아이패드·갤럭시탭/맥북 5 family만 매핑. 나머지는 **"unknown"** 반환.
- `decideCadence` (line 91-100): unknown family이면 `mode=gather, cadence=5m` 강제. 따라서 추가 query를 unknown으로 등록해도 downrank 없이 5분 주기 가동 ✓.
- 즉 query만 추가하면 cadence 로직은 정상 작동. **queryFamily 코드 변경 없이 갭 해소 가능**.
- 단 cadence가 5m이라 일 cost 영향 발생 — 추가 18 query × 5m × ready 기여 시작 시점까지 gather 모드. 측정 후 자동 downrank.

## 8. mvp_search_queries 등록 현황

| category | enabled queries | observed sum | pool_ready sum |
|---|---:|---:|---:|
| smartphone | 16 | 5,943 | 0 |
| smartwatch | 9 | 3,084 | 44 |
| tablet | 7 | 2,859 | 69 |
| earphone | 5 | 2,335 | 22 |
| laptop | 2 | 895 | 7 |
| **unknown** | 21 (synthetic boost/acquisition queries) | 159 | 24 |

unknown 21건은 `wave*_boost:` / `internal_acquisition:` 패턴의 internal tag — Bunjang에 직접 검색되는 자연어 아님. 자연 cron coverage에는 기여 안 함.

## 9. 권고 (no patch, design 정리만)

1. **DEFAULT_SEARCH_QUERIES 18~24 query 추가** (Wave 56 사인오프 별도):
   - monitor 4: "모니터", "LG 모니터", "BenQ 모니터", "27인치 모니터"
   - speaker 3: "JBL 스피커", "JBL Flip", "보스 스피커"
   - headphone 4: "Bose QC", "보스 큐씨", "WH-1000XM", "소니 헤드폰"
   - game_console 4: "PS5", "플스5", "닌텐도 스위치", "스위치 OLED"
   - home_appliance 3: "다이슨", "로보락", "샤크 청소기"
   - desktop 3: "맥미니", "iMac", "맥스튜디오"
2. **queryFamily 확장 (선택)**: 추가 카테고리에 family 매핑 부여하면 cadence 자동 평가 가능. unknown으로 두면 영구 5m gather. data 누적 후 평가.
3. **mvp_search_queries 동기화**: code 변경 + DB upsert 필요 (downrank logic에 들어가야).

## 10. 원칙 ack
- DB write 금지: ✓ (read-only)
- candidate_pool write 금지: ✓
- public promotion 금지: ✓
- DDL 금지: ✓
- PS5 patch 금지: ✓

## 11. 변경/검증/위험
- 변경: 없음 (분석만)
- 검증: 5 SQL read + 2 source code grep + 1 cadence 함수 trace
- 위험: 없음
- 다음: Wave 56 — owner 사인오프 후 DEFAULT_SEARCH_QUERIES 추가 + (optional) queryFamily 매핑 확장. PS5 root cause는 Wave 55와 별개로 owner 결정 대기.

## 12. 남은 blocker (재정렬)
1. R3 contentHash 더블체크 path
2. needs-owner 407 stale row 사인오프
3. Phase A backup table DROP (2026-05-21+)
4. PS5 lanes 21 rows owner decision (Wave 55 분석 별도 issue로 유지)
5. **DEFAULT_SEARCH_QUERIES 가전·테크·IT 갭** (본 wave 신규)

→ **남은 blocker 5건.**
