# Wave 772 — 골프/게임 pool_eligible flag 누락 fix (Wave 760c 후속)

**날짜**: 2026-05-24
**Wave**: 772 (사용자 #8 보고: "골프 클럽 한번도 안들어왔는데 게임기도 안늘어남")

## 사용자 보고

"골프 클럽 한번도 안들어왔는데 너 tick 제대로 하는거 맞응ㅁ?? 게임기도 안늘어난거 같은데?"

## 진단

### 1. tick cron 정상 작동 ✓
- 지난 1h: bunjang 1,352건 + joongna 740건 ingest
- catalog SKU query (젤다 무쌍/티어스/야숨, 골프 풀세트) 도 raw 에 들어옴

### 2. parser 정상 작동 ✓
- 골프: 1,103건 parsed (지난 24h), 43 unique SKU
- 게임: 884건 parsed, 85 unique SKU
- needs_review 거의 0 (각 1건)
- sku_id 정상 박힘 (`sport-golf-full-set-broad` 등)

### 3. **pool 진입 0건 — 진짜 문제**
- sport_golf: ready 0 / invalidated 0 (한 번도 진입 시도 X)
- game_console: ready 2 / invalidated 15 (극소수만 진입)

### 4. 근본 원인 — `pool_eligible = false`

raw 매물 sample 조회:
```
pid 391532596 "캘러웨이 골프채 풀세트" → pool_eligible=false, score_dirty=false
pid 405042080 (차익 +90K 매물) → pool_eligible=false, score_dirty=false
```

전체 골프 매물 31건 중 pool_eligible=true 0건 (모두 false).

### 흐름 분석

1. **bunjang ingest** → `pool_eligible` 안 박음 (default false)
2. **detail-worker** → detail 완료 + score_dirty=true 박음
3. **score-worker** → score_dirty=true 처리 시 pool_eligible=false 보고 pool 진입 skip + score_dirty=false 박음
4. **결과**: 매물 stuck — parsed 됐지만 pool 진입 영원히 X

### 왜 의류/신발은 OK?
- joongna_ingest.ts:897 → joongna 매물은 pool_eligible=true 명시 박음
- bunjang fashion 매물 → `isStaleBunjangPoolEligibleFalse` 로 stale 처리 (public pool eligible)
- 근데 score-worker 가 stale 처리 안 하고 pool_eligible 직접 filter 하는 듯

### Wave 760c 관계
- Wave 760c (오늘 오전): game_console + sport_golf 카테고리 readiness `internal_only → ready`
- 카테고리 ready 풀었지만 **raw 의 pool_eligible flag 는 안 update**
- 그래서 카테고리만 ready 인 상태에서 raw flag 가 옛 internal_only 정책 그대로 false

## 즉시 Fix (DB update)

```sql
UPDATE mvp_raw_listings r
SET pool_eligible = true, score_dirty = true, updated_at = NOW()
FROM mvp_listing_parsed p
WHERE r.pid = p.pid
  AND p.category IN ('sport_golf', 'game_console')
  AND p.parsed_at >= NOW() - INTERVAL '7 days'
  AND r.detail_status = 'done'
  AND r.listing_state = 'active'
  AND r.listing_type = 'normal'
  AND r.pool_eligible IS DISTINCT FROM true;
```

결과: **1,347건 update** (sport_golf 1,000+ / game_console 300+).
다음 score-worker cron (5분) 에서 pool 진입 시작.

## 미해결 (별도 wave 권장)

**Systemic code fix 필요**:
1. bunjang ingest 또는 detail-worker 에서 카테고리 readiness 검사 후 `pool_eligible=true` 자동 박기
2. 또는 score-worker 가 `isRawPublicPoolEligible` 사용해서 stale bunjang false 도 처리하게 통일

현재는 raw flag 가 ready 카테고리 변경에 자동 반응 안 함 → 다음 game/golf 매물도 같은 stuck 가능.

## 안전성

- DB update 만 — 코드 변경 0
- 영향: game/golf 매물 1347건 score-worker 처리 큐 진입
- 다음 cron (5분) 에서 pool 진입 + ready/invalidated 분류

## 관련 commit

- `b99c41b2`: Wave 771 — AI hold 정책
- 본 commit: Wave 772 — game/golf pool_eligible DB fix (코드 systemic fix 별도 wave)
