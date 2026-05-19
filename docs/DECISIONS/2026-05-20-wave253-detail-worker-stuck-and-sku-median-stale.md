# Wave 253 — detail-worker reparse stuck + sku_median stale 진단

- date: 2026-05-20
- type: production incident diagnostic (fix 전 사용자 보고)
- wave: 253
- 상태: 진단 완료, fix 후보 명시 — **사용자 결정 필요** (destructive UPDATE 자율 X)

## 사용자 보고 (Wave 253 trigger)

A. detail-worker 멈춤 (8h 전 마지막 process)
B. mvp_listings.sku_median 갱신 누락 (BAPE Tee #202 = 109,500 v3 mixed 값)
C. AI L2 hold 매물 ready 잔존 (별도 wave)

## 진단 결과

### A. detail-worker NOT 멈춤 — 그러나 queue 0건

```
mvp_collect_runs 최근 20건:
  - request_path: /api/cron/detail-worker?wait=1
  - 3분 간격 정상 실행 (마지막 2.5분 전)
  - 모두 status='succeeded'
  - enriched_count: 5-27건/tick (정상 1k+ 대비 0.5%)

mvp_detail_queue 상태:
  - pending: 0
  - failed: 175 (오래된 retry backoff)
  - done: 45,479
  - total: 45,654

mvp_raw_listings 상태 (listing_state='active'):
  - detail_status='pending': 14,177
  - score_dirty=true: 193,236
  - 둘 다: 14,103
```

**Root cause** — Wave 252.C `triggerRematchForParserVersions` helper 가 `mvp_raw_listings.detail_status='pending'` + `score_dirty=true` 만 PATCH, **`mvp_detail_queue` 에는 INSERT 안 함**. detail-worker 는 `claim_mvp_detail_queue` RPC 로만 작업 수신 — queue 비어있어 사실상 14,177 pending 매물 영원히 reparse 안 됨.

검증:
```sql
SELECT COUNT(*) FROM mvp_raw_listings 
WHERE detail_status='pending' AND listing_state='active' 
  AND pid NOT IN (SELECT pid FROM mvp_detail_queue WHERE status='pending');
-- → 14,177 (100% — 단 하나도 queue 에 없음)
```

**같은 bug 가 Wave 251.3 (2026-05-19) 부터 존재** — Wave 251.3 trigger 한 29 pids 도 24h 후 0건 reparse:
```sql
SELECT detail_status, COUNT(*) FROM mvp_raw_listings WHERE pid IN (Wave 251.3 의 29 pids) GROUP BY detail_status;
-- → pending: 29 (단 하나도 reparse 안 됨)
-- 단, mvp_listing_parsed.parser_version 은 v7 (자연 reparse — 다른 path 로 우연 갱신)
```

### B. sku_median 갱신 경로 추적

**갱신 path** (`mvp/src/lib/tick-pipeline.ts`):
1. `tick` cron (5분 주기, 별도 worker) 가 `scoreStage()` 실행
2. `loadScorableRows(800)` — `detail_status='done'` + `score_dirty=true` 필터
3. score 계산 → `upsertRows("mvp_listings", listingUpserts, "pid")` (line 4479) 가 `sku_median` 박음
4. skuMedian 우선순위:
   a. unopened → reference price (다나와)
   b. trustedMedian (`mvp_market_price_daily.blended_median_price` for comparable_key)
   c. batch fallbackMedian (≥5건, shoe ≥2건)
   d. 부족 → 0

**v3 매물 (BAPE Tee #202 류) sku_median=109,500 stale 원인**:
1. v3 시절 (mixed pool) 에 한 번 박힌 값 109,500
2. comparable_key 가 v3 형식 (`clothing|bape_tee|unknown_condition`)
3. v7 reparse 트리거 → `mvp_listing_parsed` 만 v7 으로 갱신 (search stage 자연 path)
4. `mvp_raw_listings.detail_status` 는 'pending' 으로 stuck → `loadScorableRows` 가 skip → score-stage 절대 진입 못 함 → `mvp_listings.sku_median` 갱신 안 됨

검증 — pid 384361091 (파타고니아 딥파일):
```
mvp_raw_listings.detail_status = 'pending'  ← stuck
mvp_listings.sku_median = 115,000  (v3 mixed 값)
mvp_listing_parsed.parser_version = 'wave216-clothing-v3' (parsed_at 2026-05-19 06:48)
                  .comparable_key = 'clothing|patagonia_retro_x|unknown_condition'
```

만약 detail_status='done' 이면 score-stage 진입 → v7 comparable_key 로 정확 시세 산정 → 갱신.

### Score-stage 처리량

```
tick cron 최근 10회 평균 scored_count: 33-322 (꽤 변동)
193k score_dirty backlog 처리에 필요 시간: 193,236 / 800/tick ≈ 242 tick = 1,210분 ≈ 20시간
실제 30분 후 dirty 감소: 0 (계속 새로 들어옴 / drain 속도 ≈ inflow 속도)
```

근본적으로 `loadScorableRows` 가 detail_status='done' 만 본다는 점은 정상 design — pending 행은 v7 reparse 후 처리하는 게 맞음. 문제는 **pending 이 영영 안 풀리는 것**.

## Fix 후보 (사용자 결정 필요 — 자율 X)

### 옵션 A — `triggerRematchForListings` helper 에 `mvp_detail_queue` INSERT 추가 (root fix)

수정 파일: `mvp/src/lib/rematch-helpers.ts`

`triggerRematchForListings` PATCH 직후 다음 코드 추가:
```ts
// PATCH 후 detail-worker 가 reparse 하도록 mvp_detail_queue 에 INSERT IGNORE.
const queueRows = chunk.map((pid) => ({
  pid: Number(pid),
  status: "pending",
  priority: 50,
  available_at: triggeredAt,
  locked_at: null,
  locked_until: null,
  last_error: null,
  updated_at: triggeredAt,
}));
await restFetch(`${tableUrl("mvp_detail_queue")}`, {
  method: "POST",
  headers: { ...serviceHeaders(), Prefer: "resolution=ignore-duplicates,return=minimal" },
  body: JSON.stringify(queueRows),
});
```

영향:
- Wave 251.3 / 252.B / 다음 모든 wave 자동 정상 동작
- 14,177 pending 매물 즉시 queue 진입 — detail-worker 가 ~30 tick 안 처리 (15분 ÷ 800/tick × 14k 매물 / c=15 ≈ 30분)
- 미래 catalog 변경 자동 reparse OK
- destructive 아님 (INSERT IGNORE — 중복 회피, 기존 데이터 보존)

리스크:
- 14k INSERT 즉시 → detail-worker 부하 burst 30분
- Bunjang detail API 부하 (probe c=20 OK 검증됨 — Wave 135). c=15 default 라 안전 margin 큼

검증 plan:
- helper code 수정 + commit
- 14,177 pending 매물 backfill queue (별도 1회 script `npx tsx scripts/wave253-backfill-detail-queue.ts`)
- 30분 후 queue drain 측정

### 옵션 B — 별도 backfill 스크립트만 (one-shot, root fix 안 함)

14,177 pending 매물 직접 INSERT INTO `mvp_detail_queue`. Wave 252.C helper 는 그대로 (bug 잔존).

```sql
INSERT INTO mvp_detail_queue (pid, status, priority, available_at, updated_at)
SELECT pid, 'pending', 50, NOW(), NOW() FROM mvp_raw_listings
WHERE detail_status='pending' AND listing_state='active'
ON CONFLICT (pid) DO UPDATE SET 
  status='pending', available_at=NOW(), locked_at=NULL, locked_until=NULL, updated_at=NOW();
```

영향:
- 즉시 해소
- 다음 wave catalog 변경 시 같은 bug 재발 (helper 그대로)

리스크:
- 사용자 명시: destructive UPDATE 자율 X. ON CONFLICT UPDATE 는 destructive (locked 상태 reset 등). 같은 부담.

### 옵션 C — Wave 252.B step 1 같은 부담 측정 우선 (no fix)

오늘 fix 보류. 사용자 확인 + 부담 측정 우선. 14,177 pending → 14,177 그대로 (영영 stuck).

영향:
- 사용자 발견한 BAPE Tee #202 류 sku_median stale 해결 안 됨
- 새 catalog 변경마다 bug 누적

### 운영자 권고

**옵션 A** 추천 — root fix + 즉시 해소. Bunjang 부하 c=15 (Wave 135 검증) 안전.

## 사용자 정책 준수

- 진단 우선, fix 전 사용자 보고 ✓
- destructive UPDATE 자율 X — 모든 fix 옵션 사용자 결정 후 진행 ✓
- decision log 즉시 (memory feedback_decision_log_required) ✓
- findings 즉시 박기 (memory feedback_log_findings_even_before_fix) ✓

## 후속 작업

1. **사용자 결정 대기** (옵션 A/B/C)
2. 결정 후:
   - 옵션 A: `rematch-helpers.ts` patch + backfill script + commit + push
   - 옵션 B: backfill 1회 + 다음 wave bug 재발 방지 별도 wave 등록
   - 옵션 C: 14k stuck 그대로 + AI L2 / sku_median 후속 대응
3. AI L2 24h shadow audit alert 대기 (별도 wave)
4. 사용자 #5 신뢰도 풀 진입 차단 별도 wave

## 참고 코드 위치

- `mvp/src/app/api/cron/detail-worker/route.ts` — detail-worker entry
- `mvp/src/lib/tick-pipeline.ts:1518` — `claimDetailQueue()`
- `mvp/src/lib/tick-pipeline.ts:1502` — search-stage 의 유일한 `mvp_detail_queue` INSERT path
- `mvp/src/lib/rematch-helpers.ts:122,189` — Wave 252.C helper (bug — queue INSERT 누락)
- `mvp/src/lib/tick-pipeline.ts:4166-4479` — scoreStage + sku_median write
- `mvp/src/lib/tick-pipeline.ts:1902` — `loadScorableRows` detail_status='done' 필터
