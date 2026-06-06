# Wave 1192f — "더 넓은 범위 찾기" 옵션 (6km → 10km)

날짜: 2026-06-06
관련: Wave 1192e (candidate_pool RPC), Wave 1189 (region 96 = 실질 6km)

## 배경

owner: 당근 피드 반경이 6km(region 96개)로 잘려서 7~10km ready 매물이 안 나옴.
owner 아이디어: 항상 10km 말고, **"더 넓은 범위 찾기" 버튼**으로 사용자가 선택 (당근 UX 패턴).

→ trade-off 없음: 기본 가까운(6km) 빠르게, 더 원하면 버튼. RPC(Wave 1192e)라 10km(region 412개)도 0.2초 유지.

## 변경

### 서버 (route.ts)
- 상수 `DAANGN_NEARBY_REGION_LIMIT_EXPANDED = 500` (10km 안 전체)
- query `expandRange=1` → `daangnExpandedRange` → nearby region limit 96 → 500
- options 체인 (nearby / loadPool) 에 `daangnExpandedRange` 전달
- in-memory cacheKey 에 `regionIds.length` (6km/10km 캐시 구분)
- 확장 모드는 server snapshot skip (`!daangnExpandedRange`, RPC 직접 0.2초)

### client (explore-client.tsx)
- state `daangnExpandedRange` + ref (setState 비동기 회피, loadPool 이 ref 읽음)
- loadPool URL 에 `expandRange=1`
- 피드 끝 (매물 다 봤을 때) 버튼:
  - 6km: "이 근처(약 6km)는 여기까지예요" + "🔍 더 넓은 범위에서 찾기 (10km)"
  - 10km: "가까운 동네만 보기 (6km)" 토글
- 당근 거리뷰(`isDaangnFocusedView`) 에서만 노출

## 동작
1. 기본 6km 피드 (빠름)
2. 끝까지 스크롤 → "더 넓은 범위 (10km)" 버튼
3. 누르면 → 10km region(412개) RPC 재조회 (0.2초)
4. "가까운 동네만 (6km)" 토글로 되돌림

## TS check
src/ 0 error (서버 + 클라).

## Sign-off
owner 아이디어 + 추천 채택. 배포 후 피드 끝 버튼 확인.
