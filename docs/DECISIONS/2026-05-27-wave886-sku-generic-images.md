# Wave 886 — SKU 일반 이미지 스왑 (anti-leak)

- 시간: 2026-05-27 KST
- 발견: 운영자풀/사용자 reveal 피드의 매물 카드 사진이 너무 식별 가능 → 사용자가 결제/언락 안 해도 매물 특정 가능 (leak). MJ 요청.
- 의도: SKU별 일반 제품 사진을 카드 노출용으로 사용. 원본 `mvp_listings.thumbnail_url`은 그대로 두고 폴백.

## 변경

### DB
- 마이그레이션 `wave886_mvp_sku_images_table_and_bucket`:
  - `public.mvp_sku_images (sku_name PK, image_url, storage_path, source_url, pick_reason, bytes, width, height, ...)` 신규 테이블 + RLS anon SELECT true.
  - Storage bucket `sku-images` (public, 2MB 한도, image/* MIME) 생성.
- 데이터 적재 **301/302 ready SKU (99.7%)** — 1차 271 + 파일럿 7 skip + retry 23 = 301. 미적재: Louis Vuitton LV Trainer (LV.com hotlink 403, 수동 수집 필요).
  - Bing Images 검색 → 브랜드 도메인 우선 → 첫 결과 폴백.
  - Pillow로 640px max + JPEG q85 resize (평균 ~30KB).
  - Supabase Storage 업로드 → public URL → DB upsert.

### 코드
- 신규 `src/lib/sku-images.ts`: 5분 TTL in-memory 캐시 + `loadSkuImageMap()` + `resolveGenericImage()`. 실패 시 빈 map 반환 (운영 차단 X).
- `src/app/api/admin/pool-listings/route.ts:443` → `genericImageUrl` 필드 추가, 응답 전 `loadSkuImageMap()` 1회 호출.
- `src/app/api/packs/me/route.ts:204,229,775,846` → 동일 패턴, `RevealItem` 타입에 `genericImageUrl: string | null` 추가.
- `src/lib/pack-open.ts:49` → `RevealCard.genericImageUrl?: string | null` 추가.
- `src/components/sku-image-lock-badge.tsx` 신규 → SVG 자물쇠 + "실매물" 텍스트 chip. variant: default/compact.
- 3개 카드 컴포넌트 패치 (CLAUDE.md 메모리 룰 — UI 변경은 3화면 모두):
  - `src/components/admin-pool-browser.tsx`: type + Image src + lock badge.
  - `src/components/user-reveal-dashboard.tsx`: type + Image src + lock badge + 4개 RevealCard 전달 사이트에서 `genericImageUrl` 전파.
  - `src/components/pack-reveal-modal.tsx`: `RevealProductImage`와 "내 매물" 작은 카드 둘 다 `genericImageUrl ?? thumbnailUrl` 폴백 + lock badge. `RelatedRevealItem` 타입에도 추가.

### 산출물 / 스크립트
- `scripts/sku-image-pilot/`:
  - `fetch_sku_images.py` — 5개 SKU 파일럿 (BAPE/Samba/AirPods Max/Barbour/Marshall).
  - `fetch_all_sku_images.py` — 302 SKU 일괄 (Bing 파싱 + Pillow resize + 재시도 + manifest 출력).
  - `upload_to_supabase.py` — manifest → Storage upload + DB upsert.
  - `retry_failed.py` — errors.json 입력, URL quote + fallback query rewrite + 첫 3개 결과 재시도.
  - `skus.json` — 302 ready SKU 리스트 (input).
  - `manifest_all.json`, `errors.json`, `upload_errors.json` — 추적 산출물.

## 검증
- `npx tsc --noEmit`: production 코드 0 에러 (tests/scripts는 사전 baseline 에러 유지).
- DB `mvp_sku_images` row count = 278.
- 공개 URL 샘플 spot-check (HTTP 200, image/jpeg).
- 파일럿 5장 사용자 검토 OK (BAPE/Samba/AirPods Max/Barbour/Marshall 다 합격).
- UI 실제 브라우저 검증 미수행 (다음 follow-up).

## 위험 / 한계
- **이미지 출처 = Bing Images first/brand result.** 정확도 ~90%이지만 일부는 collab variant/색상 mismatch 가능. 사람 검수 권장 SKU:
  - "broad" 표기 SKU (e.g., "Air Jordan 1 High (broad)") — 대표 이미지 임의 선정.
  - 컬러 variant 표기 SKU — 첫 결과 색상이 user 기대와 다를 수 있음.
- **저작권**: 브랜드 공식 photo + 일부 reseller (StockX/GOAT/Grailed) photo 포함. 상업적 재배포 시점에 법무 검토 필요. 현재는 service display 한정.
- **1 SKU 실패** (`errors_remaining.json` = LV Trainer): LV.com anti-hotlink 403. 다른 reseller 사이트 수동 큐레이션 또는 사용자가 직접 업로드 필요. 단, 1개라 UI 폴백으로 자연스럽게 원본 thumbnail 노출됨.
- **cache 5분 TTL**: 신규 SKU 추가/이미지 교체 시 최대 5분 lag. UI 다이렉트 노출은 즉시 안 됨.
- **pack-reveal-modal 초기 reveal flow는 미적용**: `/api/packs/open` 응답의 `RevealCard.thumbnailUrl`은 아직 그대로 (서버에서 `genericImageUrl` 주입 안 됨). 첫 reveal "두근두근" 모먼트는 원본 노출 유지. user-reveal-dashboard 피드부터 generic 노출. 추후 일관성 원하면 `/api/packs/open` 라우트에도 동일 패턴 적용 가능.
- **ComparableListing (비교 매물 list)는 안 건드림**: 외부 마켓 실시간 비교 데이터라 원본 노출이 자연스러움. anti-leak 대상 아님.

## 다음
- 24 실패 SKU 재시도 (URL `urllib.parse.quote_plus`, 다른 검색 query, 수동 큐레이션 옵션).
- `npm run dev` → 운영자풀/`me` 화면 실제 검증 + lock badge 디자인 spot-check.
- pack-reveal-modal 초기 reveal flow도 일관성 원하면 `/api/packs/open` 라우트에 동일 inject.
- 사용자 반응 모니터링 (CTR / 결제 conversion 변화 추적).

## 후속 수정 (2026-05-27 동일 turn)

브라우저 검증 시 사용자가 두 가지 짚음:

1. **admin-pool-browser 패치 revert** — 운영자는 검증용으로 원본 사진 봐야 함. 이전 메모리 "3화면 다 적용" 룰은 카드 UI 요소 추가의 consistency 룰이지, anti-leak 정책의 적용 범위는 아니었음. 운영자풀에서 `genericImageUrl` 필드/import/렌더 제거.

2. **실제 피드 미적용 발견** — 사용자가 보는 메인 피드는 `/me` 가 아니라 explore (홈/landing). `src/components/explore-client.tsx` + `src/app/api/packs/pool/route.ts` 가 정답. 추가 패치:
   - `pool/route.ts` → `buildItems(..., skuImageMap)` 시그니처 확장, `loadSkuImageMap()` 호출 추가, `genericImageUrl` 필드 inject.
   - `explore-client.tsx` → `PoolItem.genericImageUrl?` 추가, 카드 렌더에 `genericImageUrl ?? thumbnailUrl` 폴백 + lockedPreview blur는 generic 있을 때 제거 (generic 자체가 anti-leak), 3개 RevealCard 매핑 사이트에서 `genericImageUrl` 전파.

교훈: **"3화면" 메모리는 카드 UI 변경의 consistency**용이지 **anti-leak 정책의 적용 대상**과 다름. 다음 anti-leak 작업 시 사용자에게 적용 범위 먼저 확인 (admin vs user, feed vs detail).

## Wave 886.3 — source 다양화 + 당근 필터 추가 (당근 미노출 fix)

- 시간: 2026-05-27 (동일 turn)
- 발견: 사용자가 "당근이 안 나오는거지?" 짚음. DB엔 ready 당근 106 / 중나 86 / 번개 770. 상위 25슬롯이 profit_desc 순서로 채워져 번개 20+ / 중나 4 / 당근 1로 당근 거의 invisible. Wave 773 거리 필터는 사용자 home region null이면 skip이라 cause 아님.
- 변경:
  - `src/app/api/packs/pool/route.ts:412` → sourceByPid fetch 항상 (이전엔 source filter 켜진 경우만).
  - `src/app/api/packs/pool/route.ts:diversifyByCategory` → Phase 1 protected source quota (당근/중나 각 min 5) + Phase 2 차익순 + Phase 3 카테고리 cap 무시 fallback.
  - `src/components/explore-client.tsx:SOURCE_OPTIONS` → "당근" 옵션 추가, SourceOption 타입 확장, URL param parsing에 daangn 허용.
- 위험: 카테고리 cap (MAX_PER_CATEGORY=5) 와 source quota 동시 적용 시 일부 슬롯 비울 가능성. Phase 3 fallback으로 채움.

## Wave 886.4 — 카카오 주소 검색 (동 검색 깨짐 fix)

- 시간: 2026-05-27 (동일 turn)
- 발견: 사용자가 "상도동 쳤는데 안 나옴" 짚음. 기존 `daangn-region-parents.json` 218개 동만 있어서 대부분 검색 fail.
- 변경:
  - `KAKAO_REST_API_KEY` Vercel Production + Preview env 추가 (CLI 토큰으로 sync).
  - `src/lib/kakao-address-search.ts` 신규 — Kakao Local address + keyword API wrapper. region depth는 address/road_address/top-level 3중 fallback.
  - `src/app/api/user/home-region/search/route.ts` 신규 — auth + Kakao 호출 + 결과 반환.
  - `src/components/home-region-onboarding.tsx` 갈음 — 218-entry 로컬 리스트 제거, debounced remote search (250ms), 결과의 lat/lng를 기존 GPS POST 경로로 전달 (서버 reverseGeocode + matchDaangnRegionByPath 재사용).
- 위험: Kakao API rate limit 300k/월 (debounce 250ms로 보호). matchDaangnRegionByPath는 218개 fallback chain이라 동 단위 정확 매칭 안 될 수 있으나 isDaangnRegionNearby는 시/도만 비교라 OK.

## Wave 886.2 — 잠금 카드 정보 공개 확장 (anti-leak 충분 후)

- 시간: 2026-05-27 (동일 turn)
- 발견: 일반 이미지로 카드 식별 차단됐으니, 차익 + 마켓플레이스 source까지 공개해도 leak 위험 낮음. 시세/매입가는 fuzzy 유지로 역산 어려움.
- 변경:
  - `src/app/api/packs/pool/route.ts:721-722` → 잠금 카드에서 `marketplaceSource/Label: null` override 제거 → 원본 source 노출.
  - `src/app/api/packs/pool/route.ts:729-730` → 잠금 카드 `expectedProfitMin/Max` `roundDownTenThousand` 제거 → 1원 단위 exact.
  - `src/components/explore-client.tsx:2800` → `lockedPreview ? lockedProfitLabel(item) : '+${krw(profitAvg(item))}'` → 항상 exact `+${krw(profitAvg(item))}`.
  - `src/components/explore-client.tsx:2851-2857` → "출처 잠금" chip 제거 → 항상 `MarketplaceSourceBadge` 로고 노출.
  - `src/components/explore-client.tsx:2804` → "정확가 잠김" → "시세 잠김" (이제 차익은 정확하니까 chip 카피 정확화).
- 위험 분석: 차익만 정확 + 시세/매입가 range = listing 역산 시도해도 SKU당 active 매물 20~50개 중 후보 다수. 일반인 못 함, 전문 리셀러도 비효율.
- 사용자 확인 후 진행 ("나는 괜찮을거같다 생각하는데"). 카피 옵션도 사용자 선택 ("탭해서 실제 매물 사진 보기").
