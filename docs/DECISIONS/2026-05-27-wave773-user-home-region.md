# Wave 773 — 사용자 거주 동네 (GPS + Manual) + Pool 거리 필터

- 시간: 2026-05-27 KST
- 트리거: 사용자 "옵션 1이면 씨발 서울인데 제주 뜨면? 위치 GPS나 수동입력". 당근 매물 거리 제약 (자기 인증 동네 인근만 채팅 가능) 대응.

## 정책 답변 (사용자 결정)

- **Skip 차단** — 거주 동네 설정 필수 (당근 매물 절반 무의미 risk 큼)
- **GPS + 수동 dropdown 둘 다** 제공
- Kakao REST API key 사용 (env 에 박힘)

## 변경

### DB (migration `wave773_user_home_region`)
- 신규 `mvp_user_home_regions` 테이블
  - `user_id` (uuid, PK, FK auth.users)
  - `daangn_region_id`, `daangn_region_name`, `daangn_full_path`
  - `source` ('gps' | 'manual')
- RLS: deny all (service_role 우회로 API에서만 write)

### env
- `.env.local` 에 `KAKAO_REST_API_KEY` 추가 (REST API key, reverse geocode 용)

### 신규 helper 4개

1. `src/lib/kakao-reverse-geocode.ts` — Kakao Local API wrapper (위/경도 → 시도/시군구/동)
2. `src/lib/daangn-region-matcher.ts` — Kakao 결과 → 270 Daangn seed 매핑 (정확/시군구/시도 prefix 3단계)
3. `src/lib/user-home-region-loader.ts` — `loadUserHomeRegion(userId)` + `isDaangnRegionNearby(userPath, itemPath)` (시도 prefix 비교)
4. `src/components/home-region-onboarding.tsx` — UI: GPS 버튼 + 검색 dropdown

### 신규 API
- `src/app/api/user/home-region/route.ts`
  - `GET ?list=1` → 270 region dropdown options
  - `GET` → 사용자 현재 home region
  - `POST {lat, lng}` → GPS path (Kakao reverse geocode + matcher)
  - `POST {daangn_region_id}` → manual path (dropdown 선택)

### 신규 page
- `src/app/onboarding/home-region/page.tsx` — onboarding UI

### 통합

#### `src/app/page.tsx` (root)
- 로그인 사용자: `loadUserHomeRegion()` 체크 → 미설정이면 `/onboarding/home-region` redirect.

#### `src/app/api/packs/pool/route.ts`
- `loadUserHomeRegion()` 으로 사용자 home region 로드.
- `buildItems()` 함수에 `userHomeRegion` 인자 전달.
- pool item map 안: daangn 매물 + user home region 다른 시/도면 **null 반환 (hide)**.

## 흐름

```
[가입 완료]
  ↓
[/ 진입]
  ↓
[loadUserHomeRegion → null]
  ↓
[/onboarding/home-region redirect]
  ↓
[GPS 버튼 클릭]
  → navigator.geolocation.getCurrentPosition
  → POST /api/user/home-region {lat, lng}
  → Kakao reverse geocode
  → matchDaangnRegionByPath (정확/시군구/시도 prefix 3단계)
  → DB upsert
  → router.push("/explore" → "/")
  
[또는 검색 dropdown]
  → 270 region 중 선택
  → POST /api/user/home-region {daangn_region_id}
  → 동일 흐름
```

## 효과

- 서울 사용자: 서울 매물만 표시 (부산/제주 hide)
- 부산 사용자: 부산 매물만 표시
- bunjang/joongna 매물은 거리 무관 노출 유지 (전국 거래 가능)

## 검증

- `npx tsc --noEmit` Wave 773 신규/수정 파일 에러 0건
- DB migration 적용 성공

## 위험

- **Kakao API rate limit**: 무료 plan 월 30만 호출. 가입 시 1회만 호출 → 충분.
- **GPS 거부 사용자**: 수동 dropdown fallback. 강제 redirect라 한 번은 설정해야 진입.
- **GPS 정확도**: 시도 단위만 매칭하므로 ±1km 오차 허용.
- **신규 region**: Kakao 결과가 270 seed에 없으면 시군구/시도 prefix fallback. 그래도 못 잡으면 `daangn_region_id="0"` 저장 (사용자 거주지 자체는 known).

## 다음

- 사용자 home region 변경 UI (settings 페이지) — 별도 wave
- Pool 정렬 가중치 — 같은 시군구 매물 더 위로 (현재는 시도 단위 hide만)
- Joongna/Bunjang도 거리 정보 받아오면 필터링 가능 (현재는 전국 노출 유지)
