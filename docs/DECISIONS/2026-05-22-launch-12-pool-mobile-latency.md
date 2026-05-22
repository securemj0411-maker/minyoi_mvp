# 2026-05-22 — Launch CRITICAL #11: /api/packs/pool 모바일 지연 fix

## audit 발견
`/api/packs/pool/route.ts` 1 request 에 6 sequential REST + Cache-Control 없음.
- L254: `limit=5000` source-pid scan (full table)
- L267~344: candidate_pool / listings / raw_listings / marketBands / v7Sibling
- 3G 망 first paint 느림

## fix
1. **source-pid scan 한도 5000 → 2000**
   - 한 source (joongna / bunjang) 의 active pid 가 풀 매칭에 5000 다 필요 X
   - 2000 이면 모든 카테고리 충분 + DB scan 비용 ↓

2. **Cache-Control 헤더 추가** — refresh=false + free feed 일 때만:
   - `Cache-Control: private, max-age=15` (사용자별 15초 캐시)
   - 같은 사용자 새로고침 시 캐시 응답 → 부담 ↓
   - **`private`** = 사용자별 (CDN 공유 X — detailAccess 사용자별 정보 노출 차단)
   - **15초** = sold_out lag 허용 + 사용자 체감 빠름

3. **refresh=true 또는 credit feed = `no-store`**
   - DB write (last_free_browse_at upsert) 발생
   - 사용자별 카운터 갱신 — 캐시되면 안 됨

## 영향
- 코드: `src/app/api/packs/pool/route.ts` 1 파일
- DB: 영향 X (scan 한도만 축소)
- 사용자 영향:
  - 정상 사용 (refresh=false) → 같은 사용자 새로고침 시 빠름
  - refresh 또는 credit feed → 동일 (캐시 X)
  - sold_out 매물 15초 lag 가능 — 허용 (cron 분 단위라 영향 미미)

## 후순위 (별 step)
- DB query N+1 정리 (`preview-inventory` sequential chunked fetch)
- next/image 도입 (preview-detail hero LCP)
- bundle size 분석

## 검증
- TypeScript compile clean
- 같은 IP 로 `/api/packs/pool` 2번 빠르게 호출 → 2번째는 캐시 hit 확인 (production)
- refresh=true 시 캐시 안 걸림 확인

## 메모리 룰
- 일반인 친화: 모바일 첫 paint 빠르게 = 사용자 frustration ↓
- decision log: 이 파일
