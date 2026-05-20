# 2026-05-20 Wave 403 — 가입 직후 예산 선택 전 매물 조회 가드

## 배경
- 사용자가 `/me` 첫 진입 시 “환영해요, 내가 살 만한 매물만 보여드릴게요” 예산 모달이 단순 모달이면, 모달 답변 전 `/api/packs/pool`이 먼저 호출되어 무의미한 첫 30개 DB 조회가 생길 수 있다고 지적했다.
- 코드 의도는 `awaitingInitialPrefs`로 첫 fetch를 막는 것이었지만, localStorage 확인 전 초기값이 `false`라 첫 effect pass에서 pool/stat fetch가 먼저 나갈 여지가 있었다.
- 예산 저장 버튼도 `loadPool(false, newPrefs)`를 직접 호출한 뒤 모달 close가 `awaitingInitialPrefs=false`로 바뀌며 자동 effect를 다시 트리거할 수 있어 중복 조회 가능성이 있었다.

## 결정
- `ExploreClient`에 `prefsInitialized` 상태를 추가해 localStorage 선호값 확인이 끝나기 전에는 `/api/packs/pool`과 `/api/stats/pool`을 호출하지 않는다.
- 신규 가입자처럼 선호값이 없으면 예산 모달 답변 또는 건너뛰기 전까지 매물/통계 DB 조회를 보류한다.
- 예산 저장 버튼에서는 직접 `loadPool(false, newPrefs)`를 호출하지 않고, 선호값 state 반영 후 가드된 자동 effect가 1회만 조회하도록 했다.

## 보류
- `/api/packs/welcome` endpoint와 `mvp_welcome_grants` 테이블은 과거 히스토리 유지 목적으로 남겨둔다. 실제 `/me` 진입 경로에서는 호출하지 않는다.
- 예산 선호값은 현재 localStorage 기반이다. 기기 간 동일 선호를 원하면 추후 사용자 프로필 테이블 저장으로 확장한다.
