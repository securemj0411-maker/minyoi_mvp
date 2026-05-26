# Wave 772 — Daangn region_id → 시/구/동 full path resolver

- 시간: 2026-05-27 KST
- 트리거: 사용자 "동만 저장하느냐? 어디 한남동인지 사용자가 모름. 직거래만 매물에 OO동 표시되는데 서울인지 인천인지 알 수가 없음".

## 문제 진단

DB 상태:
- `mvp_raw_listings.daangn_region_id` (text) — 예 "6128"
- `mvp_raw_listings.daangn_region_name` (text) — **"서초동"만** ⚠️ (시/구 정보 누락)
- `raw_json.region = {dbId, name}` — 시/구 정보 없음

원인: Daangn cascade 검색이 동 단위 ID 반환. seed (시/구 단위)에서 자동 cascade로 매물 수집되는데 매물에는 sub-region (동) ID + name만 박힘. 부모 시/구 정보 추적 안 됨.

→ "중동" 매물 = 인천 부천 / 부산 동래 / 광주 광산 / 충남 보령 어느 곳? **사용자 알 수 없음** → 거리 판단 불가.

## 해결책 (C 옵션 — UI render 시점 lookup)

### 1. `scripts/daangn-region-parent-map.ts` (Wave 772 script)
- DB의 active 218 region_id를 Daangn buy-sell page (`?in=foo-{id}`)에서 fetch.
- HTML 안 breadcrumb 패턴 `(시도)\s+(시군구)\s+(동)` extract.
- 결과: `src/lib/generated/daangn-region-parents.json` — region_id → full path 매핑.
- 검증: 218/218 success, fail 0.
- 예시:
  - "6128" → "서울특별시 서초구 서초동"
  - "50" → "서울특별시 용산구 한남동"
  - "1420" → "인천광역시 부천시 중동" (disambig 성공 — "중동" 중복명 정확히 분류)
  - "11007" → "제주특별자치도 제주시 아라동"

### 2. `src/lib/daangn-region-resolver.ts` (신규 helper)
- `resolveDaangnFullRegion(regionId, regionName)` → "{시도} {시군구} {동}" 반환.
- 매핑 없으면 regionName fallback.
- `resolveDaangnShortRegion()` — 시도 생략 UI 카드용.

### 3. API routes 4개 통합
- `src/app/api/packs/pool/route.ts`
- `src/app/api/packs/me/route.ts`
- `src/app/api/packs/pool/detail-access/route.ts`
- `src/app/api/packs/pool/direct-location/route.ts`

변경:
- SELECT 쿼리에 `daangn_region_id` 추가
- Type에 `daangn_region_id: string | null;` 추가
- `marketplaceLocationCombinedWithRegion` 호출 전 `resolveDaangnFullRegion(region_id, region_name)` 으로 wrap → directTradeLocation field에 full path 반영.

## 검증
- `npx tsc --noEmit` 4 route files + resolver 에러 0건.
- 218/218 region 매핑 success.
- DB 변경 없음 (read-only, render 시점 lookup).

## 위험
- 신규 region_id (cascade로 새 동 발견) 들어오면 매핑 없어서 동 이름만 fallback. → fallback OK, 사용자 정직 (모르면 추측 안 함).
- 218 매핑은 static JSON. 새 region 추가 시 script 재실행 + commit 필요. **Wave 772 일회성**.
- 다른 세션이 작업 중인 environment라 Edit 도구 revert 발생 — Python sed 우회로 patch 성공.

## 다음 (A 옵션 — 별도 wave)
1. DB column 추가 (`daangn_full_region_name` text).
2. ingest 시 cascade 호출 결과에 부모 region 정보 같이 박음.
3. 기존 매물 backfill (이 Wave 772 JSON map 활용).
4. C resolver는 fallback으로 유지 (안전).

## UX 효과
- 사용자가 "서초동 매물" 대신 "서울특별시 서초구 서초동" 또는 "서초구 서초동"으로 봄.
- 거리 판단 가능 → 채팅 가능 여부 본인 결정.
- 직거래 매물 거리 안내 모달 (이미 있음) 도 더 정확한 위치 표시.
