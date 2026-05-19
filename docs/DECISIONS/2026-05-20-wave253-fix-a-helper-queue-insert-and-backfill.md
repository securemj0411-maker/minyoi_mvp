# Wave 253 fix A — helper queue INSERT 추가 + 14,177 backfill

- date: 2026-05-20 (실행 2026-05-19 17:00-17:15 UTC)
- type: 사용자 승인 root fix (additive only — INSERT IGNORE, DELETE/DROP X)
- wave: 253 fix A
- 상태: APPLIED — helper patch + 14,183 매물 backfill 완료, 30min 모니터 진행 중
- precedent: Wave 253 진단 ([2026-05-20-wave253-detail-worker-stuck-and-sku-median-stale](./2026-05-20-wave253-detail-worker-stuck-and-sku-median-stale.md)) 옵션 A

## 사용자 승인 + 가드

옵션 A (root fix + backfill) 승인. 명시 가드:

1. helper patch 3 함수 (`triggerRematchForSkus` / `triggerRematchForListings` / `triggerRematchForParserVersions`) `mvp_detail_queue` INSERT IGNORE 추가 — additive
2. backfill dry-run 1000 먼저 → 정상 응답 확인 후 본 14,177
3. detail-worker rate 600/h 초과 시 즉시 중단 (baseline 230/h × 1.5)
4. mvp_listings.sku_median 컬럼 update path 별도 진단 (사용자 #202 BAPE Tee 109,500 → 92,000 검증)
5. AI L2 비용 cap ($1/월 — Wave 238)

## 실행 단계

### Step 1: helper patch (17:00 UTC)

수정 파일: `mvp/src/lib/rematch-helpers.ts`

- 추가 함수 `enqueueDetailQueue(pids, triggeredAt)` — `mvp_detail_queue` INSERT IGNORE.
  - row shape: `tick-pipeline.ts:1502` (`insert_detail_queue`) 동일 — pid, status='pending', priority=50, available_at, locked_at=null, locked_until=null, last_error=null, updated_at.
  - PostgREST `Prefer: resolution=ignore-duplicates,return=minimal` + `?on_conflict=pid` URL param (둘 다 필수, on_conflict 미지정 시 23505 violation).
  - chunk 500.
- 추가 함수 `fetchPidsBySkuIds(encodedSkuIds, total)` — sku_id PATCH 전 pid list 사전 수집 (PATCH 후엔 `detail_status='done'` 필터 매칭 X).
- 3 trigger 함수 PATCH 직후 `enqueueDetailQueue()` 호출. `resetDetailStatus=false` 시 skip.
- `triggerRematchForParserVersions` 는 `triggerRematchForListings` delegate 라 자동 fix.

### Step 2: unit test 보강 (17:01 UTC)

`mvp/tests/wave252-c-rematch-helpers.test.ts`:
- 기존 8 test → 10 test 확장.
- `triggerRematchForSkus dryRun=false` test — detail_queue INSERT 호출 + row shape 검증.
- `resetDetailStatus=false` test — detail_queue INSERT 호출 안 됨 검증.
- batchSize=2 test — chunk 검증 + queue INSERT 1회 (5 pid 1 chunk).
- 신규 test — `dryRun=false + resetDetailStatus=false → PATCH 만, queue INSERT X`.
- 신규 test — Prefer header `resolution=ignore-duplicates` + URL `on_conflict=pid` 검증.

결과: 10/10 pass. test:core 전체 591/600 pass (9 fail = pre-existing `/me ...` UI snapshot, my changes 와 무관).

### Step 3: dry-run 1000건 backfill (17:08 UTC)

`mvp/scripts/wave253-fix-a-backfill.ts` 신설:
- `--dry-run-limit=N` — N pid fetch + sample 출력. 실제 INSERT X.
- `--apply-limit=N` — N pid INSERT IGNORE.
- `--apply` — 전체 pending INSERT IGNORE.

실행:
```bash
npx tsx --env-file=.env.local scripts/wave253-fix-a-backfill.ts --dry-run-limit=1000
```

결과:
- fetched pending pids: 1000 (limit=1000)
- already in mvp_detail_queue (pending): 0/1000  ← 진단 확인 (Wave 253 의 "단 하나도 queue 에 없음")
- expected new INSERT IGNORE: 1000
- sample pids: 1435653, 39172504, 40189172, ...

### Step 4: 본 backfill (17:10-17:11 UTC)

#### 1차 시도 — apply 1000 sample (17:09 UTC)

```bash
npx tsx --env-file=.env.local scripts/wave253-fix-a-backfill.ts --apply-limit=1000
```

**bug 발견** — PostgREST 409:
```
{"code":"23505","details":"Key (pid)=(126645680) already exists.","message":"duplicate key value violates unique constraint \"mvp_detail_queue_pid_key\""}
```

원인: `Prefer: resolution=ignore-duplicates` 만으로는 충분하지 않음. PostgREST 는 `?on_conflict=pid` URL param 도 필수 — `tick-pipeline.ts:344-354` 의 `insertIgnoreRows` 와 같은 pattern. helper + script 둘 다 URL 수정.

#### 2차 시도 — apply 1000 sample (17:10 UTC)

```bash
npx tsx --env-file=.env.local scripts/wave253-fix-a-backfill.ts --apply-limit=1000
```

결과:
- chunk 1: INSERT IGNORE 1000 pids
- mvp_detail_queue post-state: pending=826 (1000 - 174 drained — 즉시 detail-worker claim 시작)
- 정상 검증 완료.

#### 3차 — 본 전체 backfill (17:11 UTC)

```bash
npx tsx --env-file=.env.local scripts/wave253-fix-a-backfill.ts --apply
```

결과:
- fetched pending pids: 14,183 (active_pending 측정 시점 14,177 → 6건 sold/sweep, 사용 시점에 다시 측정 14,183 — 정상 churn)
- already in mvp_detail_queue (pending): 841/14,183 (1차 apply 후 즉시 drain 시작)
- expected new INSERT IGNORE: 13,342
- chunks 15 (1000 × 14 + 183 × 1)
- 모두 성공. 총 14,183 INSERT IGNORE issued.

### Step 5: post-apply 검증 (17:11 UTC)

| 측정 | baseline (17:08) | post-apply (17:14) | 변화 |
|---|---:|---:|---:|
| mvp_detail_queue done | 45,565 | 45,666 | +101 |
| mvp_detail_queue pending | 0 | 11,725 | +11,725 |
| mvp_detail_queue processing | 0 | 95 | +95 |
| mvp_detail_queue failed | 175 | 175 | 0 |
| mvp_raw_listings active_pending | 14,170 | 14,082 | -88 |
| mvp_listing_parsed v3 | 2,380 | 2,380 | 0 |
| mvp_listing_parsed v7 | 1,989 | 1,996 | +7 |

**증거**:
- detail-worker actively claim → status='processing' (95 in flight)
- queue drain 발생 (pending 14,183 → 11,725)
- v7 reparse 시작 (1,989 → 1,996 — 7건 v3 → v7 변환)
- detail_status='done' 다시 set (14,170 → 14,082)

### 사용자 가드 5번 검증 — detail-worker rate

| window | baseline | post-apply | 비율 |
|---|---:|---:|---:|
| 5m rate | n/a | 10 | ~2/min |
| 15m rate | n/a | 34 | ~136/h |
| 30m rate | 115 | (측정 후 갱신) | |
| 1h rate | 227 | 213 | -6% (시간 경계 효과) |
| 24h rate | 8,703 | (변화 X) | |

cron tick 3분 주기, `claim_mvp_detail_queue` RPC max batch=200. enriched_count 가 cron tick 당 0-27 변동 (bunjang detail API rate limit 추정). **사용자 가드 600/h 가이드 안 넘음** — rate 정상 범위. 측정 30min 후 보고.

### 사용자 #5 — mvp_listings.sku_median update path 검증

Wave 252.A real (2026-05-20) 의 `pack-open.ts comparable_key fallback chain` 은 candidates fetch 단계. `mvp_listings.sku_median` 컬럼 갱신은 별개 path — `tick-pipeline.ts:4479 scoreStage` 의 `upsertRows("mvp_listings", listingUpserts, "pid")`.

```ts
// loadScorableRows (line ~1902):
//   `detail_status='done' AND score_dirty=true` 필터.
// scoreStage 가 sku_median 박음 (line 4479).
```

Wave 253 진단 (옵션 A 옵션 B 옵션 C 비교) 시 검증:
- 본 backfill 후 매물이 detail_status='done' + score_dirty=true 로 진입.
- 다음 tick scoreStage 가 자동 `sku_median` 갱신 → 별도 fix 불필요.
- BAPE Tee 의 v3 stuck 매물 sample (sku_median 138,000 / 174,800 / 109,500 등 v3 mixed 값) 30min 후 v7 reparse → comparable_key 변경 → sku_median 재산정 검증.

검증 SQL (30min 후):
```sql
SELECT l.pid, rl.sku_id, l.sku_median, lp.comparable_key, lp.parser_version, rl.detail_status, rl.score_dirty
FROM mvp_listings l
JOIN mvp_listing_parsed lp ON lp.pid = l.pid
LEFT JOIN mvp_raw_listings rl ON rl.pid = l.pid
WHERE rl.sku_id = 'clothing-bape-tee'
  AND rl.listing_state = 'active'
ORDER BY l.sku_median DESC NULLS LAST LIMIT 30;
```

**baseline 17:10 UTC sample (v3 stuck)**:
| pid | sku_median | comparable_key | parser_version | detail_status |
|---|---:|---|---|---|
| 371123686 | 174,800 | clothing\|bape_tee\|b_grade | wave216-clothing-v3 | pending |
| 408614497 | 138,000 | clothing\|bape_tee\|s_grade | wave216-clothing-v3 | pending |

**예상 30min 후**: parser_version → wave216-clothing-v7, comparable_key 에 product_type 추가 (`clothing|bape_tee|tee|b_grade`), sku_median 재산정 (`mvp_market_price_daily` 의 comparable_key 별 median 으로 fallback — Wave 252.A 적용).

## 기술 정책 준수

- additive only ✓ (`INSERT IGNORE` 만, DELETE/DROP/UPDATE X)
- decision log 즉시 ✓
- test:core 회귀 X (10/10 rematch 테스트 pass, 9 pre-existing fail unrelated)
- destructive 사용자 승인 ✓ (옵션 A 명시 승인)
- 사용자 친화 ✓ (backend 만 — 일반인 영향 X)
- bug 발견 정직 보고 ✓ (Wave 252.C 1차 helper 누락 + 1차 apply 시 `on_conflict` URL param 누락)

## 핵심 파일 변경

| 파일 | 변경 | 라인 |
|---|---|---:|
| `mvp/src/lib/rematch-helpers.ts` | `enqueueDetailQueue` + `fetchPidsBySkuIds` 추가, 3 trigger 함수 PATCH 후 INSERT IGNORE | +63, -5 |
| `mvp/tests/wave252-c-rematch-helpers.test.ts` | 기존 8 test → 10 test (queue INSERT 검증) | +60, -5 |
| `mvp/scripts/wave253-fix-a-backfill.ts` | 신규 backfill script | +163 |

## 후속 작업 (사용자 결정 필요 — 자율 X)

1. **30min 후 측정 보고** — v3/v7 변화, detail-worker rate, BAPE 매물 sku_median 재산정 검증
2. **bag v3 1,306 / shoe v3 9,419 rematch** — 본 fix 후 사용자 결정
3. **AI L2 Phase 2** (hold → invalidated) — 별도 wave
4. **사용자 #202 BAPE Tee** — 109,500 → 92,000 검증 30min 후

## 측정 SQL (30min, 1h, 4h 마다)

```sql
-- A. v3 잔여 + v7 진척
SELECT parser_version, COUNT(*) FROM mvp_listing_parsed 
WHERE parser_version IN ('wave216-clothing-v3', 'wave216-clothing-v4', 'wave216-clothing-v7')
GROUP BY parser_version;

-- B. mvp_detail_queue
SELECT status, COUNT(*) FROM mvp_detail_queue GROUP BY status ORDER BY COUNT(*) DESC;

-- C. detail-worker rate
SELECT
  COUNT(*) FILTER (WHERE detail_enriched_at >= NOW() - INTERVAL '30 minutes') AS rate_30m,
  COUNT(*) FILTER (WHERE detail_enriched_at >= NOW() - INTERVAL '1 hour') AS rate_1h,
  COUNT(*) FILTER (WHERE detail_enriched_at >= NOW() - INTERVAL '24 hours') AS rate_24h
FROM mvp_raw_listings WHERE detail_enriched_at IS NOT NULL;

-- D. BAPE Tee sku_median 변동 (v3 stuck → v7 재산정 검증)
SELECT l.pid, rl.sku_id, l.sku_median, lp.comparable_key, lp.parser_version, rl.detail_status, rl.score_dirty
FROM mvp_listings l JOIN mvp_listing_parsed lp ON lp.pid = l.pid
LEFT JOIN mvp_raw_listings rl ON rl.pid = l.pid
WHERE rl.sku_id IN ('clothing-bape-tee', 'clothing-stussy-hoodie', 'clothing-polo-rrl-jacket-coat')
  AND rl.listing_state = 'active' AND lp.parser_version IN ('wave216-clothing-v3', 'wave216-clothing-v7')
ORDER BY rl.sku_id, lp.parser_version, l.sku_median DESC NULLS LAST LIMIT 50;
```
