# Wave 755 — 직거래 location modal teaser pid fix

- 시간: 2026-05-26 KST
- 트리거: 사용자 보고 — "노스페이스 패딩 사이즈 105사이즈" (당근 source, ready, daangn_region_name="범어동") 인데 modal 에 "아직 동네 정보를 가져오지 못했어요" 표시.

## 발견

`pack-reveal-modal` 직거래 매물 확인 modal 의 location fetch flow:

1. Feed teaser locked 매물 → `buildTeaserFeedItems()` 가 **synthetic pid** 발급 (real pid 노출 방지, encrypted accessToken 박음)
2. PoolItem 에 `pid = synthetic`, `accessToken = encrypted_token` 박혀 있음
3. 사용자가 "직거래만 가능한 매물" modal 열면 → DirectTradeConfirm modal
4. modal 이 `body: JSON.stringify({ pid: activePid })` 로 fetch
5. **여기서 buggy** — `activePid = synthetic`. API 가 `mvp_raw_listings where pid=synthetic` → 0 rows → 404
6. UI: "아직 동네 정보를 가져오지 못했어요"

비교 대상: `detail-access/route.ts` 는 `{ accessToken }` 받아 `decodePoolAccessToken` 으로 real pid 복원. direct-location 만 누락.

## 변경

### `src/app/api/packs/pool/direct-location/route.ts`
- `decodePoolAccessToken` import 추가
- body 에서 `accessToken` 옵션 받기. 있으면 decode → real pid. 없으면 `pid` fallback (admin/내 매물 화면처럼 real pid 직접 받는 path 호환).

### `src/components/explore-client.tsx::DirectTradeConfirm`
- `state.item.accessToken` 추출
- 있으면 `{ accessToken }` 전송, 없으면 `{ pid }` 전송
- useEffect deps array 에 `activeToken` 추가

## 검증
- `npx tsc --noEmit` 0 에러
- DB: pid 9000704184070 (노스페이스 패딩) → source=daangn, daangn_region_name="범어동", status=ready ✅
- 흐름: teaser modal → token 전송 → API decode → real pid → daangn fast-path → location="범어동" return → UI 표시

## 위험
- 0. fix-only. accessToken 없는 path 는 기존 동작 그대로.
- detail-access endpoint 와 동일 패턴이라 보안 risk 없음 (token 은 server secret 으로 암호화).

## 다음
- Wave 749~754 와 함께 다른 endpoint 들도 token-only path 가 누락된 곳 있는지 audit 권장.
- 같은 root cause 다른 endpoint: `share-bonus`, `analysis` 도 점검 가능.
