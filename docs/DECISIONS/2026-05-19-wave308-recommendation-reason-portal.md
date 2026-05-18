# Wave 308 — 추천 이유 근거 모달 viewport 고정

## Context
- `/me` 상품 상세에서 `왜 이 상품을 추천했나요?`의 `근거 보기`를 아래쪽에서 누르면, 근거 모달이 현재 눈높이가 아니라 위쪽/스크롤 위치에 묶여 보이는 문제가 있었다.
- `RevealCardItem`에 진입 애니메이션용 transform이 걸려 있어 내부 `fixed` 레이어가 브라우저에서 viewport 기준이 아니라 transform 부모 기준으로 동작할 수 있었다.

## Decision
- 추천 이유 상세 레이어를 `document.body`로 portal 렌더링한다.
- 모바일/데스크톱 모두 `top-1/2`, `-translate-y-1/2`의 viewport 중앙 고정 레이어로 띄운다.
- 상세 내용은 레이어 내부에서만 스크롤되도록 `max-height`를 유지한다.
- ESC 키로 닫을 수 있게 한다.

## Verification
- `/me` 계약 테스트에 body portal, viewport center fixed, 기존 `top-[72px]` 회귀 방지 assertion을 추가했다.

## Deferred
- 시각 QA는 배포 후 실제 iPhone mini Safari에서 한 번 더 확인한다.
