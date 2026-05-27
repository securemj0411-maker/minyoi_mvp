# Wave 775 — Daangn ingest: Category-firehose 모드 (미스매칭 80% → 20%↓ 예상)

- 시간: 2026-05-27 KST
- 트리거: 사용자 — "지금 80%정도가 firehose로 해서 카테고리 미스매칭임 (애초에 우리가 하지않는 sku들 대부분). 이걸 극복하려고 카테고리만 골라서".

## 발견 — 사용자 expert 분석 검증

기존 다른 세션 진단 잘못된 점:
1. ❌ "220s 고정" — 실제 병렬 (`Promise.all`, line 631)
2. ❌ "Round-robin 신선도 trade-off" — firehose 모드라 round-robin 의미 X
3. ❌ "maxCombos 5 = lambda 한도" — Vercel duration 아니라 **maxCombos 5 가 진짜 bottleneck**

진짜 현재 상태:
- `selectDaangnFirehoseCombos`: region 만 iterate, keyword/category filter X (sentinel id=0)
- 5 region × 1 fetch = 5 fetch/tick parallel
- 한 region 당 50+ 매물 통째 ingest → **80% 미스매칭** (식품/유아동/도서/생활용품 등 우리 catalog 외)
- 24h × 5 region × 288 tick = 1,440 region-hits → 267 region 풀 ≈ 4.4시간 신선도

## 사용자 mapping (catalog 100% cover)

| Daangn 카테고리 | ID | 우리 ready SKU |
|---|---|---|
| 디지털기기 | 1 | smartphone/tablet/earphone/laptop/smartwatch/desktop/speaker/camera/drone/monitor |
| 취미/게임/음반 | 2 | game_console/lego |
| 스포츠/레저 | 3 | sport_golf/shoe/bike |
| 여성의류 | 5 | clothing |
| 뷰티/미용 | 6 | perfume |
| 남성패션/잡화 | 14 | clothing/shoe/bag |
| 여성잡화 | 31 | bag |
| 생활가전 | 172 | home_appliance |

## 변경

### `src/lib/daangn.ts`
- **신규 `DAANGN_TARGET_CATEGORIES`** (8 카테고리, 사용자 mapping).
- 기존 `DAANGN_FASHION_CATEGORIES` (3개) 는 legacy keyword 모드용 유지.

### `src/lib/daangn-ingest.ts`
- **신규 `selectDaangnCategoryFirehoseCombos`** — region × 우리 카테고리 combo.
  - fetch 수 = `maxRegions × categories.length`
  - 예: 5 region × 8 카테고리 = 40 fetch parallel
- **신규 `useCategoryFirehose` option** default **ON** — 새 mode 가 기본.
- 옛 `useRegionFirehose` 는 fallback (`useCategoryFirehose=false` 시).
- 기존 keyword 모드 (`useRegionFirehose=false`) 도 fallback 유지.

## fetch 수 변화

| 모드 | 한 tick fetch | 5분 cycle 시간 | 신선도 | 매칭율 |
|---|---|---|---|---|
| 현재 (region-firehose) | 5 region × 1 = 5 fetch | ~50s | 4.4시간 | 20% (80% 미스매칭) |
| **Wave 775 (category-firehose, default ON)** | **5 region × 8 카테고리 = 40 fetch parallel** | ~50-80s 예상 | 4.4시간 동일 | **70%+ 예상** (catalog 매핑만) |

## Trade-off + 위험

- ✅ **신선도 동일** (병렬이라 fetch 수 8배 ↑여도 시간 비슷)
- ✅ **매칭율 ↑** — 80% drop → 예상 20% 이하
- ✅ **DB 부담 ↓** — 미스매칭 매물 자체 ingest 안 함
- ⚠️ **당근 rate-limit risk** — fetch 수 8배 (5 → 40/tick = 8/min)
  - 현재 안전 수준 (5/tick) 의 8배. 5 region × 8 cat = **같은 region 동시 8 fetch** = 한 IP 가 같은 region 으로 짧은 시간에 8 hit
  - 당근 IP 차단 임계치 미지 — production 첫 cycle 5분 후 source_health monitor 필수
- 🔄 **Rollback path**: `useCategoryFirehose=false` env 또는 option 으로 즉시 옛 firehose 복귀 (코드 변경 X)

## 검증

- `npx tsc --noEmit` 0 에러
- 코드 path 확인: `useCategoryFirehose ?? true` → default ON
- 옛 mode 보존: `useRegionFirehose` + keyword 모드 fallback 다 살아있음

## 다음 단계 (monitor 후 결정)

1. **첫 5분 cycle 후 monitor**:
   - `mvp_collect_runs` 의 latest run timing
   - `blockedSignals` (block 감지 시 즉시 rollback)
   - `mvp_raw_listings` 매칭율 (sku_id non-null %)
2. **안전 시 (1-2시간 후)**: 매칭율 ↑ 확인 → 유지
3. **block 발생 시**: `DAANGN_USE_CATEGORY_FIREHOSE=0` env 또는 option 박아서 즉시 rollback
4. **추후 maxCombos ramp-up**: 사용자 expert 안 — 1주일 모니터 후 5 → 10 → 15 (region 신선도 ↑)

## 위험 0

- 코드 변경 즉시 rollback 가능 (option flag)
- DB 변경 X
- 옛 mode 다 살아있음 (fallback)
