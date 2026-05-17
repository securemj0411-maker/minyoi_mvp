# 2026-05-17 preview-masked: 신뢰 chip PC 우측 column 분리

## 사용자 지적

> "좀 오른쪽에 박아야지 존나 더럽게; 모바일이면 어쩔수없는데 pc는 좀 오른쪽에 놀수있잖아"

## 박은 변경 (commit `d99a17d`)

- info 영역 wrapper 추가:
  ```tsx
  flex flex-col items-start gap-2
  lg:flex-row lg:items-center lg:justify-between lg:gap-4
  ```
- **좌측** (lg): 카테고리 / 등급 chip / 이름 / 가격 / 차익
- **우측 column** (lg): 신뢰 시그널 chips (🆕 신규 / 무료배송 / 시세 신뢰)
- 모바일: stack (info 위, chips 아래)
- chip `whitespace-nowrap` 으로 한 줄 유지

## 효과

- PC: 카드 양쪽 균형 — info 왼쪽, signals 오른쪽 = 빈 공간 활용
- 모바일: 기존 stack 유지 (좁아서 어쩔 수 없음)

## Test

288/288 pass.
