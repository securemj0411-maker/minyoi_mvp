# Wave 1201 — /plans 갇힘 탈출구 + 거주지 미저장 가드 (audit P0 #1, #3)

날짜: 2026-06-06
관련: Wave 1199 audit, plans-application-flow.tsx
owner 결정: 비멤버 탈출은 "나가기/로그아웃 버튼만" (유료 정책 유지, 갇힘만 해소).

## #1 — 비멤버 /plans 영구 갇힘 (owner "영원히 못 나감"의 실체)

### 문제
- 로그인 비멤버는 `/`·`/me`·`/lookup` 모두 `/plans`로 redirect.
- `/plans` 전체화면(z-75)이 nav·햄버거·로그아웃(z-40~60)을 덮어 클릭 불가.
- 뒤로가기 → 서버가 다시 `/plans`로 → 도로 갇힘. 플로우 내 탈출 링크 0.

### fix
- `handleExit()` 추가: `supabase.auth.signOut()` → `window.location.href="/"`.
  (비멤버는 로그아웃 안 하면 `/`도 `/plans`로 튕기므로 signOut 필수 → 비로그인 공개 마스킹 피드로 탈출.)
- footer의 `canGoBack`(=step>0) false인 **step 0**(첫 진입, "이전" 없던 자리)에 **isAuthed면 "나가기" 버튼** 노출.
  - step 0: [나가기] [진행] / step 1·2: [이전] [진행] (이전으로 step 0 도달 → 나가기).
- 비멤버 피드 차단 정책은 유지 (owner 결정). 탈출구만 추가.

## #3 — 거주지 "지도 탭만" 하면 미저장 → 중복 온보딩

### 문제
- step 0에서 지도 시/도 탭 → `mapZoomed=true` + `setHomeRegionDraft(null)`.
- 세부 동네 미선택(draft=null)인데 footer "이 지역으로 계속" 활성 → `saveHomeRegionDraft()`가
  `if (!homeRegionDraft) return true`로 **미저장인데 통과** → 결제·승인 후 `/onboarding/home-region`이
  "동네 미설정"으로 또 떠 중복 온보딩.

### fix (3중)
- `saveHomeRegionDraft`: `!homeRegionDraft`면 `return true` → **`return false`** (안전망, 미저장 진행 차단).
- footer 진행 버튼 `disabled`에 `(mapZoomed && !homeRegionDraft)` 추가 → 세부 미선택 시 비활성.
- 진행 버튼 라벨: mapZoomed인데 draft 없으면 "이 지역으로 계속" → **"지도에서 우리 동네를 선택하세요"** (이유 명확).
  - locationError(안내 텍스트)는 수동검색 패널 안에만 렌더돼 지도 화면엔 안 보임 → 버튼 라벨로 유도.

## TS check
clean (plans-application-flow.tsx 0 error).

## 남은 audit 항목 (후속)
- P1: 홈동네 조회 DB 실패 시 정상멤버 온보딩 튕김(user-home-region-loader 에러/없음 구분), 멤버십 연장 업그레이드 무한대기, 이메일 가입 재전송 버튼.
- 죽은 코드: /billing/* 3페이지 + API 4개 (삭제 or 복원계획).
- 정책 확인: 가입폼 "무료 2개" 카피 vs 유료 게이트.

## Sign-off
owner 우려 핵심(#1 갇힘) + 중복 온보딩(#3) 해소. #2(돈 루프)는 Wave 1200 완료.
