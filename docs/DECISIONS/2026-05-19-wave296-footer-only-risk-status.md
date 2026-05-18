# 2026-05-19 Wave 296 — 안전 상태 footer 단일화

## 배경
- Wave 294에서 하단 fixed footer에 `안전 확인` CTA를 추가했지만, 본문 중간에도 `안전 확인` 카드가 남아 중복 노출됐다.
- footer CTA 문구도 항상 `안전 확인`이라 실제 위험도(`안전`, `주의 N건`, `위험 N건`)가 바로 보이지 않았다.

## 결정
- `/me` 상세 본문 중간의 `ProductSafetyPanel`을 제거했다.
- 안전/주의/위험 상태는 하단 fixed footer 왼쪽 CTA 한 곳에서만 노출한다.
- footer CTA 라벨은 `buildRiskScore()` 결과의 `score.label`을 사용해 `안전`, `주의 N건`, `위험 N건`으로 표시한다.
- footer CTA 색상도 tone에 따라 safe=green, caution=amber, danger=rose로 바꾼다.

## 보류
- footer에서 `확인` 단어를 다시 붙이는 작업은 보류한다. 현재는 상태 자체가 버튼 텍스트가 되고, 버튼 클릭으로 상세 설명이 뜨는 구조가 더 짧고 명확하다.
- 위험도 계산 입력을 더 넓히는 작업(scoreFlags/photoCount 등)은 별도 데이터 매핑 점검 후 진행한다.

## 검증
- 계약 테스트에서 중간 안전 패널이 사라지고, footer가 `safetyScore.label`을 쓰는지 확인한다.
- `npm run build`로 배포 가능 상태를 확인한다.
