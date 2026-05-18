# Wave 193 — pool 분포 audit + 미해결 발견 + 정책 후보 (2026-05-18)

## 사용자 질문

> "최근 pool에 들어가는 애들 신발이나 이런건 별로 없고 너가 말한 고프로나 다른게 엄청 많은거같은데 테크기기쪽이?? 단순 cadence 자체가 여기가 압도적으로 많은건지 아니면 지금 검색 tick 크론 자체가 뭔가 문제가 있어서 가져오는건지 상태 파악해줘"

## 진단 결과 — cron 정상, 4가지 미해결 발견

### ✅ search/score cron 자체 정상

- `search_queries_due`: 매 tick 1,000~1,069건 (전체 1,339 중)
- `search_queries_scanned`: 매 tick 121~150건 (timeout 정상)
- `search_queries_skipped_by_cadence`: 270~323건 (정상 cadence)
- score 매 tick 17~62건 처리

### ✅ Wave 190 skipReason 로그 작동 확인

최근 3 tick의 poolSkipReasons:

| tick | profit_below_pack_band | 기타 | 총 skip | poolUpserted |
|------|------------------------|------|---------|--------------|
| 09:10 | **47** | qty/condition/price 10 | 57 | 5 |
| 09:05 | **23** | fraud_group 4, condition/price 3 | 30 | 0 |
| 09:00 | **14** | (그것뿐) | 14 | 3 |

**90%+ skip이 `profit_below_pack_band`** — 정상 작동 (매물가가 시세보다 비쌈 → 차단). 정확성 우선 정책 충족.

### 📊 pool ready 카테고리별 (2026-05-18 09:00 기준)

| category | ready | latest_update |
|----------|-------|---------------|
| earphone | 86 | 8:50 |
| smartwatch | 73 | 8:47 |
| smartphone | 69 | 9:00 |
| tablet | 66 | 9:00 |
| **shoe** | **43** | **4:26 (4시간 44분 멈춤)** |
| speaker | 7 | 6:23 |
| laptop | 6 | 7:25 |
| home_appliance | 4 | 6:26 |
| game_console | 2 | 7:25 |
| desktop | 1 | 8:25 |
| **drone** | **1** | 7:50 |

---

## 🚨 미해결 발견 (해결 안 됨, fix 후보)

### 1. 시세 daily 갱신 빈도 카테고리별 차이

| category | minutes_since_computed |
|----------|------------------------|
| smartphone | 52분 |
| tablet | 52분 |
| smartwatch | 52분 |
| earphone | 52분 |
| **shoe** | **111분 (2배 늦음)** |
| **home_appliance** | **172분 (3배 늦음)** |
| **drone** | **172분 (3배 늦음)** |

**영향**: 신발/드론/가전 시세가 늦게 갱신되면 새 매물 차익 계산이 부정확. 시세 변동 빠른 카테고리는 더 자주, 느린 카테고리는 덜 — 의도된 것일 수도 있지만 audit 필요.

**확인 필요**: market-worker / market_invalidation cron이 카테고리별로 분리되어 있는지. tick-pipeline.ts의 `enqueueMarketKeyInvalidations` 동작 분석.

### 2. score-stage가 fair rotation 안 함

`loadScorableRows(limit=800)` query:
```sql
WHERE score_dirty=true AND detail_status='done' AND listing_state='active' AND sku_id NOT NULL
ORDER BY last_seen_at DESC
LIMIT 800
```

`last_seen_at desc` 정렬 — 검색 빈도 높은 카테고리 (smartphone/tablet) 매물이 항상 우선.

**현재 dirty active+done+sku 매물**:
- shoe 13 (last_seen 모두 3분 전, 시세 invalidation 직후)
- laptop 4 / bag 2 / smartphone 2 / tablet 2 / 외 6
- **총 27건 — limit 800 안에 다 들어감** (당장 영향 없음)

**위험**: 향후 dirty 매물 800+ 누적 시 신발/laptop 같은 카테고리가 후순위 밀려 영영 처리 못 받을 수 있음 (Wave 191 같은 query rotation 부작용).

**정책 후보**: Wave 191 패턴 score-stage 확장 — last_seen_at 오래된 매물 우선 또는 카테고리별 quota 분배.

### 3. shoe 카테고리 query 1개만 등록 (queryFamily 미스분류)

`mvp_search_queries.category` 통계:
- **unknown: 792 query (57%)** — DEFAULT_SEARCH_QUERIES 신발 query 대부분 unknown으로 분류
- shoe: 1 query만
- bag/sport_golf/bike/watch/camera/game_console: 각 1 query

**원인 추정**: `queryFamily(query: string)` 함수가 신발 query 텍스트 ("나이키 덩크" 등) 를 카테고리 매핑 못 함. unknown fallback.

**영향**: 통계/로그에서 카테고리별 query 분포 misleading. 실제 운영엔 큰 문제 X (unknown도 검색은 됨).

**정책 후보**: queryFamily에 신발 brand prefix (나이키/아디다스/뉴발란스/컨버스/닥터마틴) 매핑 추가. cosmetic improvement.

### 4. drone/gopro raw 매물량이 신발의 2배

| category | raw 시간당 |
|----------|-----------|
| smartphone | 71건 |
| **drone+gopro** | **48건** |
| shoe | 24건 |

Wave 187/188/192에서 drone catalog 50+ SKU 추가하면서 catalogQueries 자동 생성. catalog query 비중 ↑ → raw 매물량 비중 ↑.

**사용자 화면 인상**: 사용자가 "고프로/드론 압도적" 이라 느끼는 건 raw 매물량 차이 + 신규 카테고리 SKU 이름이 reveal 카드에 새롭게 보여서.

**정책 후보**: catalogQueries 생성 시 카테고리별 cap (예: 카테고리당 max 30 query). 아니면 운영 후 사용자 노출 균형 측정 후 fine-tune.

### 5. 신발 pool 4시간 44분 멈춤 — 정상 동작이지만 사용자 체감 나쁨

신발 ready 43건 latest_update 284분 전. 4시간 동안 새 ready 0건.

**원인**: 새 신발 매물 들어와도 `profit_below_pack_band` 게이트 차단 (시세 대비 매물가 비쌈).

**정책 후보** (3가지 옵션):

**Option A — 신발 profit threshold 완화**
- `bandFromProfit()` 의 신발 카테고리 만 threshold 낮춤 (예: pack_band 1 → 0.5)
- 영향: recall ↑, precision ↓ (사용자 손해 risk)
- §12b 정책 위반 우려

**Option B — 신발 시세 sample 확대**
- 현재 신발은 total ≥ 2 허용 (Wave 173 / Wave 190)
- 시세 sample이 condition별로 분리되어 effective sample 작음 → median 정확도 ↓
- condition fallback: 매물 condition 시세 부족 시 모든 condition blended median 사용
- 영향: precision 변동 가능 but recall ↑

**Option C — 현 정책 유지 + UX 보강**
- profit_below_pack_band 차단 자체는 정확. 사용자가 "왜 신발 없냐" 묻는 게 진짜 문제.
- admin pool 에 "profit gate 차단 매물 수" 표시 → 사용자 운영 가시성 ↑
- 또는 신발 catalog 확장 (Wave 90 source 다양화 패턴 — 패션 brand 추가)

**기본 추천**: Option C (현 정책 유지). recall 손해보다 정확성 우선이 미뇨이 핵심 원칙 (§12b).

---

## 다음 액션

**24h 내**:
1. 시세 daily 갱신 빈도 audit (#1) — market-worker cron 분리 여부 확인
2. queryFamily 미스분류 fix (#3) — cosmetic but log 가시성 ↑

**1~2주 내**:
3. score-stage fair rotation 검토 (#2) — dirty 800+ 누적 시점 대비
4. catalog query 카테고리 cap 검토 (#4)
5. 신발 catalog 확장 후보 검토 (#5 Option C 변형)

**보류**:
- Option A (profit threshold 완화) — §12b 정책 충돌 가능
- Option B (condition fallback) — precision 영향 추가 측정 필요

---

## 정리

| 항목 | 상태 |
|------|------|
| Wave 187~192 fix | 작동 중 |
| pool 진입 0건 → 일부 진입 시작 | OK |
| 시세 갱신 빈도 균일성 | **미해결** |
| score-stage fair rotation | **미해결 (지금은 영향 X, 향후 위험)** |
| queryFamily 미스분류 | **미해결 (cosmetic)** |
| 신규 카테고리 매물량 vs 신발 | **관찰만 — 정책 결정 보류** |
| 신발 pool 4시간 멈춤 | **정상 동작 (profit gate)** — fix 안 함 |

**§12b 정확성 우선 정책 충돌 우려가 있는 정책 후보 (Option A/B)는 사용자 결정 받기 전 박지 X.**
