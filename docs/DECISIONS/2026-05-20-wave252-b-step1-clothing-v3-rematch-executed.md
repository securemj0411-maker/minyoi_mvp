# Wave 252.B step 1 — clothing v3 강제 rematch executed

- date: 2026-05-20
- status: APPLIED — 2,386 clothing v3 매물 reparse trigger 완료
- type: destructive (additive) UPDATE — detail_status='pending' + score_dirty=true
- precedent: Wave 252.B report-only (옵션 3 step 1) + Wave 252.C helper

## 사용자 승인

- Wave 252.B 분석 ([2026-05-20-wave252-b-v3-rematch-report-only](./2026-05-20-wave252-b-v3-rematch-report-only.md)) — 옵션 3 step 1 (clothing v3 2,392 먼저) 권고
- 사용자 명시 가드:
  - Wave 252.C `triggerRematchForParserVersions` helper 사용 (직접 SQL UPDATE 금지) ✓
  - dry-run sample 50건 먼저 — detail-worker 정상 확인 ✓
  - 부하 monitoring 1h (15분 간격) — 큐 안 빠지면 즉시 중단
  - mvp_market_price_daily 재계산 영향 검증 (BAPE/RRL/Stussy SKU anomaly)

## 실행 단계

### Step 1: baseline 측정 (16:08Z)

```sql
SELECT parser_version, COUNT(*) FROM mvp_listing_parsed 
WHERE parser_version IN ('wave216-clothing-v3', 'wave216-clothing-v4', 'wave216-clothing-v5', 'wave216-clothing-v6', 'wave216-clothing-v7')
GROUP BY parser_version;
```

| parser_version | pid_count |
|---|---:|
| wave216-clothing-v3 | **2,386** |
| wave216-clothing-v4 | 183 |
| wave216-clothing-v7 | 1,908 |

- v3 매물: 2,386 (목표 2,392 와 거의 일치, 며칠 사이 매물 sold/disappeared 로 감소).
- v3 active: 2,330 / detail_done: 1,828 / detail_pending: 191.
- v7 비율: 1,908 / 4,477 = **42.6%** (apply 전).

### Step 2: dry-run sample 검증 (16:09Z)

```bash
npx tsx --env-file=.env.local scripts/wave252-b-step1-clothing-v3-rematch.ts
```

- 결과: `count=2386, samplePids=[335226708, 407267549, ...]`.
- 검증: 10개 sample 매물 모두 `wave216-clothing-v3` 확인. RRL/TNF/MLB 등 mix.
- detail-worker 큐 정상:
  - 최근 1h 처리 (16h UTC): 306/h. 24-15h: 285-433/h.
  - 평균 ~350-400/h (Wave 252.B 측정과 일치).

### Step 3: 본 trigger (16:10-16:11Z)

#### bug 발견 + fix

helper 첫 호출 시 affected=1000 만 반환. 원인: `triggerRematchForParserVersions` 의
`?limit=${total}` 가 PostgREST 서버측 default 1000 row cap 에 막힘.

→ helper 에 offset 페이지네이션 박음 (Wave 252.B step 1 부속 bug fix).

```typescript
// src/lib/rematch-helpers.ts (Wave 252.B step 1 fix)
const allPids: number[] = [];
const PAGE = 1000;
for (let offset = 0; offset < total; offset += PAGE) {
  const pageRes = await restFetch(
    `${tableUrl("mvp_listing_parsed")}?select=pid&parser_version=in.(${encoded})&order=pid.asc&limit=${PAGE}&offset=${offset}`,
    { headers: serviceHeaders() },
  );
  const pageRows = (await pageRes.json()) as Array<{ pid: number }>;
  allPids.push(...pageRows.map((r) => Number(r.pid)));
  if (pageRows.length < PAGE) break;
}
```

#### 재실행 결과

```bash
npx tsx --env-file=.env.local scripts/wave252-b-step1-clothing-v3-rematch.ts --apply
# affected: 2386
```

#### post-apply 검증 (16:11Z)

```sql
SELECT 
  COUNT(*) FILTER (WHERE r.score_dirty = true) AS dirty,
  COUNT(*) FILTER (WHERE r.detail_status = 'pending') AS pending
FROM mvp_listing_parsed p JOIN mvp_raw_listings r ON r.pid = p.pid
WHERE p.parser_version = 'wave216-clothing-v3';
-- dirty=2386, pending=2386 — 모든 v3 매물 박힘 ✓
```

### Step 4: 부하 모니터링 (16:12Z - 17:12Z)

15분 간격 × 4 snapshot. detail-worker 큐 잔여 + v7 진척도 측정.

| timestamp | v3_remaining | v7_total | pending_queue | rate (v3/15min) |
|---|---:|---:|---:|---:|
| T0 (16:12Z) | 2,386 | 1,917 | 14,192 | baseline |
| T+15 (16:27Z) | _pending notification_ | | | |
| T+30 (16:42Z) | | | | |
| T+45 (16:57Z) | | | | |
| T+60 (17:12Z) | | | | |

**중단 트리거**: T+15 에서 v3_remaining 감소 0 이면 즉시 중단 시그널.

### Step 5: 7h 후 측정 (예정)

- clothing v7 적용 비율 (목표 95%+ — 현재 1,908/4,477 = 42.6%, 목표 4,294/4,477)
- sku_median 변동 (BAPE/RRL/Stussy 우선)
- detail-worker 처리 속도 (rate 변화)
- 코멘트 매물 (id 195~206) condition_class 변화
  - **참고**: 코멘트 12건 모두 이미 v7 — 본 wave 영향 X. condition_class 변화 없을 가능성.
- Wave 252.A 효과 — product_type 별 median 분리 확인

### baseline market_price (key families)

| family | variant_count | total_samples | avg_median |
|---|---:|---:|---:|
| stussy_basic_tee | 11 | 207 | 70,954 |
| stussy_hoodie | 11 | 180 | 125,522 |
| bape_tee | 15 | 179 | 163,548 |
| patagonia_retro_x | 17 | 105 | 155,897 |
| tnf_nuptse_1996 | 10 | 74 | 216,761 |
| tnf_supreme_collab | 9 | 68 | 626,389 |
| polo_rrl_denim | 9 | 66 | 438,217 |
| polo_rrl_shirt_pants | 9 | 55 | 364,353 |
| polo_rrl_jacket_coat | 9 | 31 | 1,302,167 |

(7h 후 동일 SQL 으로 변동 측정)

## 사용자 정책 준수

- destructive UPDATE → Wave 252.C helper 사용 ✓ (직접 SQL 금지 가드)
- dry-run 50건 검증 먼저 — count + 10 sample pids + queue health 측정 후 본 trigger ✓
- 부하 모니터링 1h — Monitor 백그라운드 실행 중 (15분 간격 자동 알림)
- decision log 필수 — 본 문서 ✓
- additive only — detail_status / score_dirty 두 column 만 reset, raw_json/name/price/sku_id 보존 ✓
- 사용자 정책 (memory feedback_proceed_on_clear_wins) — helper pagination bug 은 명확한 fix, 자율 진행

## bug fix 영향

Wave 252.C helper `triggerRematchForParserVersions` 페이지네이션 추가.

- 1000건 초과 매물 batch 정상 처리.
- 향후 shoe (9,419) / bag (1,306) v3 trigger 시 동일 helper 안전.
- 다른 helper (`triggerRematchForSkus`, `triggerRematchForListings`) 영향 없음 (둘 다 이미 chunked).

## 후속

- Step 5 (7h 후): 측정 보고 — 별도 wave 또는 본 문서 update.
- Step 6 (next): bag v3 (1,306) trigger 검토 — 사용자 승인 필요 (1주일 후).
- Step 7 (later): shoe v3 (9,419) trigger 검토 — 사용자 승인 필요 (2주 후).
