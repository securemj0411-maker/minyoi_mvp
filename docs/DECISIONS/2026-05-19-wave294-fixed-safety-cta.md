# 2026-05-19 Wave 294 — 상세 하단 고정 안전 확인 CTA

## 배경
- `/me` 상세에서 안전/주의/위험 정보가 본문 안에만 있어 사용자가 번개장터로 나가기 직전에 다시 확인하기 어렵다.
- 사용자는 번개장터 바로가기 왼쪽에 fixed `안전 확인` 버튼을 두는 방향을 제안했다.

## 결정
- 상세 하단 fixed footer를 2컬럼으로 바꿨다.
- 왼쪽은 `안전 확인` 버튼, 오른쪽은 기존 `번개장터에서 확인하기` 버튼으로 둔다.
- 왼쪽 버튼은 기존 `RiskScoreBar`의 안전/주의/위험 dialog를 그대로 열어 기능 중복 없이 재사용한다.
- `RiskScoreBar`에 footer CTA처럼 쓸 수 있는 `containerClassName`, `triggerClassName`, `triggerLabel`, `hideChevron` 옵션을 추가했다.

## 보류
- 안전 버튼 문구를 위험도에 따라 `주의 확인`, `위험 확인`으로 바꾸는 것은 보류한다. footer에서는 사용자가 헷갈리지 않도록 항상 `안전 확인`이라는 명확한 액션으로 유지한다.
- footer 컬럼 비율은 현재 `0.86fr / 1.18fr`로 시작하고, 실제 모바일 캡처에서 글자 눌림이 있으면 다시 조정한다.

## 검증
- 계약 테스트에서 fixed footer의 안전 CTA와 번개장터 CTA가 함께 존재하는지 확인한다.
- `npm run build`로 Next typecheck를 통과해야 한다.
