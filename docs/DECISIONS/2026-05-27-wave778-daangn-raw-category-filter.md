# Wave 778 — daangn raw 카테고리 filter (DB 저장 전 거르기, 80% 잡화 drop)

## 사용자 결정

> "어차피 쓰지도 않을 카테고리인데 왜 가지고 있는거임? 버리면 안 됌? DB 저장 전에 거르면 문제 해결되는 거 아님? catalog SKU 에 없는 건 애초에 db 전에 거르는데 뭐가 문제라는거지?"

→ **trade-off 없음. 박는 게 정답**.

## 배경

Wave 777 (PR #39) 박은 후 상태:
- Fetch 267 region 전국 (firehose)
- 매물 유입 ~50K/h (이전 4K → 53배 ↑)
- **94% 잡화** (책/가구/식품/유아/도서) DB INSERT
- DB 부담 ~16GB/월 (한 달 후 Supabase Pro 8GB 한도 초과 위험)

사용자 의도:
- API limit 문제 X (Wave 777 검증)
- 진짜 문제 = DB 부담만
- catalog 매핑 안 되는 카테고리 = 진짜 무관 → DB 저장 전 거르기

## 변경

`src/lib/daangn-ingest.ts` (line ~762-805):

```typescript
const DAANGN_TARGET_CATEGORY_IDS = new Set(["1","2","3","5","6","14","31","172"]);

// DB write 전 filter
const filteredArticles = allArticles.filter((article) => {
  const catId = article.category?.dbId;
  return catId != null && DAANGN_TARGET_CATEGORY_IDS.has(String(catId));
});

const articlesDropped = allArticles.length - filteredArticles.length;
if (allArticles.length > 0) {
  const dropRatio = articlesDropped / allArticles.length;
  if (dropRatio >= 0.99) {
    console.warn(`[wave778] DROP RATIO ${(dropRatio*100).toFixed(1)}% — logic bug 의심?`);
  } else if (articlesDropped > 0) {
    console.log(`[wave778] filter: ${articlesDropped}/${allArticles.length} drop (${(dropRatio*100).toFixed(1)}%)`);
  }
}

if (!dryRun) {
  rawUpserted = await upsertDaangnRawListings(filteredArticles, detailRecords);
}
```

## 카테고리 매핑 (당근 ID → 우리 ready SKU)

| 당근 ID | 카테고리 | 우리 ready SKU |
|---|---|---|
| 1 | 디지털기기 | smartphone/tablet/earphone/laptop/smartwatch/desktop/speaker/camera/drone/monitor |
| 2 | 취미/게임/음반 | game_console/lego |
| 3 | 스포츠/레저 | sport_golf/shoe/bike |
| 5 | 여성의류 | clothing |
| 6 | 뷰티/미용 | perfume |
| 14 | 남성패션/잡화 | clothing/shoe/bag |
| 31 | 여성잡화 | bag |
| 172 | 생활가전 | home_appliance |

**8개 카테고리 = 우리 ready SKU 100% cover**.

Drop 카테고리 (DB 저장 X):
- 8 가구/인테리어
- 7 생활/주방
- 4 유아동, 173 유아도서
- 9 도서, 304 티켓, 517 e쿠폰
- 305 가공식품, 483 건강기능식품
- 16 반려동물용품, 139 식물, 13 기타 중고물품, 32 삽니다

## 효과

| | Wave 777 (지금) | Wave 778 (After) |
|---|---|---|
| Fetch | 267 region 전국 (5분 신선도) | **동일** |
| DB 저장량 | ~50K/h (94% 잡화) | **~10K/h (catalog 매물만)** |
| DB 부담 | ~16GB/월 | **~3.2GB/월** (80% ↓) |
| Supabase Pro 8GB 한도 | 한 달 후 초과 위험 | 안전 (3개월+ 여유) |
| Score-worker 부담 | sku_id=null 매물 skip | 그대로 |
| Market-worker 부담 | 분류된 매물만 처리 | 그대로 |
| Lifecycle / housekeeper | 모든 매물 처리 | **잡화 80% 없음 → 부담 ↓** |

## 비파괴 보장

- Fetch 동일 (Wave 777 그대로 — API limit 영향 0)
- Catalog 매핑 카테고리 매물 = 보존 (drop X)
- Drop = 진짜 무관 매물 (책/가구/식품 등)
- score-worker / market-worker / pool 진입 로직 변경 X

## Trade-off

- ✅ 거의 없음
- ⚠️ **`article.category.dbId` null 매물 일부 drop** — 당근이 카테고리 정보 안 박은 매물 (소수)
- ⚠️ **당근 측 분류 오류 매물 drop** — 예: 에어팟을 "기타 중고물품" 으로 박은 셀러 (소수)
- ⚠️ **catalog 확장 grace 없음** — 향후 도서/식품 등 새 카테고리 박으면 옛 매물 못 찾음 (재 ingest 가능)

위 셋 다 minor (1-5% 정도). DB 부담 80% ↓ 이득이 훨씬 큼.

## Safety guard

drop 비율 99% 초과 시 `console.warn` 박힘:
```
[wave778] DROP RATIO 99.5% (XXX/YYY) — logic bug 의심? category.dbId 측정 실패 가능성.
```

이 경고 나오면 즉시 revert (logic bug — 정상 매물도 drop 됨 의심).

## 검증 SQL (1시간 후)

```sql
-- 신규 daangn raw 매물 — catalog 카테고리만 들어옴
SELECT
  DATE_TRUNC('hour', first_seen_at) AS hour,
  COUNT(*) AS new_listings,
  COUNT(*) FILTER (WHERE sku_id IS NOT NULL) AS classified,
  ROUND(100.0 * COUNT(*) FILTER (WHERE sku_id IS NOT NULL) / COUNT(*), 1) AS classified_pct
FROM mvp_raw_listings
WHERE source = 'daangn' AND first_seen_at >= NOW() - INTERVAL '2 hours'
GROUP BY hour ORDER BY hour DESC;
```

기대 결과:
- new_listings = ~10K/h (이전 50K/h, 80% drop)
- classified_pct = 30-50%+ (이전 6%)

## History

- **Wave 776** (revert): 동일 logic 박았다가 9분 후 사용자 본인이 즉흥 revert. commit log 빈 (사유 불명).
- **Wave 777** (PR #39): maxCombos 5 → 267 (전국 fetch). raw filter 미박힘 → 94% 잡화 DB.
- **Wave 778** (이번 PR): raw filter 재박. Wave 776 = Wave 778 코드 동일. 사용자 재결정.

## 복원 가이드 (위험 신호 시)

**위험 신호**:
- 분류된 비율 (sku_id IS NOT NULL) 갑자기 0
- drop 비율 99%+ console.warn
- ready 매물 폭락

**즉시 fallback**:
```diff
- rawUpserted = await upsertDaangnRawListings(filteredArticles, detailRecords);
+ rawUpserted = await upsertDaangnRawListings(allArticles, detailRecords);
```
1줄 revert.

또는 DAANGN_TARGET_CATEGORY_IDS 에 카테고리 추가 (예: 8 가구 = `"8"` 추가).

## What Not To Do

- Fetch 단계에서 카테고리 filter 박지 X (Wave 776 시도 — 5x API call 위협). 우리는 fetch 후 DB write 전 filter.
- `category.dbId` 가 null 인 매물 keep 시도 X — 당근 분류 정보 없는 매물 = 거의 무관 (스팸/test 매물 등).
- `DAANGN_TARGET_CATEGORY_IDS` 무한 확장 X — ready SKU 카테고리만 keep. 새 카테고리 ready 진입 시 ID 추가.

## 관련 commits

- `e9a28976` feat(daangn): Wave 778 — raw 카테고리 filter
- PR #41 (merged)

## Related Waves

- Wave 776 (revert): 동일 logic 박았다가 사용자 즉흥 revert (사유 불명)
- Wave 777 (PR #39): maxCombos 267 (전국 fetch)
- **Wave 778 (now)**: raw 카테고리 filter (DB 저장 전 거름)
