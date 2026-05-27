# Wave 776 — Daangn 전국 267 region (5분 신선도) + raw level 카테고리 필터

- 시간: 2026-05-27 KST
- 트리거: 사용자 — "전체 지역 카테고리 좁히고 trade-off 8배 인 방법". Wave 775 production 직배포 후 사용자 정정 → revert → 로컬 rate-limit 검증 → 진짜 최선 plan 발견.

## 로컬 rate-limit 검증 결과 (Wave 775 probe)

| Phase | fetch 수 | 결과 |
|---|---|---|
| 1 (10 region × 8 cat) | 80 | ✅ 100% OK, 1.9s |
| 2 (30 × 8) | 240 | ✅ 100% OK, 2.2s |
| 3 (100 × 8) | 800 | ❌ **100% 403** |
| 4 (267 × 8) | 2,136 | 미검증 (Phase 3 차단으로 cancel) |
| **5 (267 × 1 firehose)** | **267** | ✅ **100% OK, 4.3s** |

→ 당근 임계치 = 240~800 사이. **Phase 5 (267 firehose) 가 안전 max + 전국 cover**.

## 변경

### `src/lib/daangn-ingest.ts`

#### 1. `maxCombos` default 5 → **267** (전국)
```ts
const maxCombos = boundedInt(options.maxCombos, 267, 1, 300);  // before: 5
```

#### 2. `DAANGN_TARGET_CATEGORY_IDS` Set 신규 (8 카테고리)
- ["1", "2", "3", "5", "6", "14", "31", "172"]
- 사용자 mapping (Wave 775 검증): 디지털기기/취미게임음반/스포츠레저/여성의류/뷰티미용/남성패션잡화/여성잡화/생활가전

#### 3. raw_listings ingest 직전 `filteredArticles` filter 박음
```ts
const filteredArticles = allArticles.filter((article) => {
  const catId = article.category?.dbId;
  return catId != null && DAANGN_TARGET_CATEGORY_IDS.has(String(catId));
});
```
- firehose 한 region 검색 = 모든 카테고리 매물 섞임 → 8 카테고리 외 drop (식품/유아동/도서 등)
- `upsertDaangnRawListings(filteredArticles, ...)` 로 변경 (allArticles → filteredArticles)

## 효과

| 메트릭 | 현재 (Wave 776 전) | 후 |
|---|---|---|
| Region/tick | 5 | **267 (전체)** |
| fetch/tick | 5 | **267 parallel** (Phase 5 검증) |
| 신선도 | 4.4시간 | **5분** |
| 매칭율 (DB write) | 20% | **~100%** (filter 효과) |
| DB 부담 (잡화) | 80% 미스매칭 | **0** (raw drop) |
| Trade-off | — | fetch 수 53배 (5 → 267) but **검증된 안전 범위** |

## 검증

- `npx tsc --noEmit` 0 에러
- 로컬 probe Phase 5 통과 (267 fetch parallel, 100% OK)
- DB schema 변경 X
- 옛 mode 옵션 보존 (`useRegionFirehose=true` 그대로)

## 위험

- ⚠️ **267 fetch parallel** — 임계치 (240~800 사이) 의 안전 측. **production 첫 cycle 모니터 필수**.
- ⚠️ Vercel IP 와 로컬 IP 차이 — 로컬 검증이지만 Vercel IP 도 동일 임계치 가정 (residential vs data center IP 차이는 있을 수 있음).
- 🔄 Rollback: `DAANGN_MAX_COMBOS=5` env 또는 commit revert 즉시 가능.

## Monitor plan

배포 후 5-15분 안에:
1. `mvp_collect_runs` 최신 daangn_worker run timing 확인
2. `request_meta` `blockedSignals` 확인 → block 감지 시 즉시 revert
3. `mvp_raw_listings` daangn source inflow + sku 매칭율 확인 (Wave 775 효과)
4. 안전 시 1주일 monitor 유지

## 다음

- 1주일 후 매물 inflow + 매칭율 측정 → 효과 확인
- yield 가중 (핫셀 자주) — 별도 wave (1주일 데이터 쌓인 후)
- 카테고리 fetch URL multi-id 지원 재시도 — 당근 API 업데이트 시
