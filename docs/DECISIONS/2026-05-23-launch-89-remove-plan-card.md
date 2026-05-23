# launch-89 — 내 계정 패널 "현재 플랜" 카드 제거 (구독제 없음)

## 사용자 정정

> "모바일이랑 PC 에 내 계정 그거 보기하면 내 플랜 나오는데 우리 지금 구독제 없어서 플랜이란게 없음;"

## Before

`account-panel.tsx` 2 카드:
1. 크레딧 사용 (보유/사용량 + bar + 설명)
2. **현재 플랜** (planLabel="Free" + 갱신/종료 시점 + "탭해서 크레딧 충전")

문제:
- "현재 플랜 / Free / 갱신 시점" 표현이 구독제 메타. 우리는 크레딧 패키지만 판매 (구독 X).
- 모든 사용자가 `planKey !== "starter"|"plus"|"pro"` → `isPaidPlan=false` → `planLabel="Free"` default.
- 구독제 없는데 "Free 플랜" 표시 = 사용자 혼동.

## After

- **"현재 플랜" 카드 통째로 제거**.
- 크레딧 카드 하단에 "크레딧 충전하기" CTA 버튼 통합 (`href="/plans"`).
- `formatPeriodEnd` helper 도 unused 라 제거.

## 영향

- 사용자가 `/me` → 계정 패널 진입 시 카드 1개 (크레딧)만 표시 + 충전 버튼.
- "Free" 라벨 / "갱신 N월" 표현 다 사라짐 — 구독제 없는 사실과 일치.
- `/plans` 페이지 자체는 그대로 — 크레딧 패키지 충전 페이지로 동작.

## 검증

- [x] TS 컴파일 통과 — account-panel.tsx 에러 0
- [ ] 모바일 + PC 계정 패널에 플랜 카드 안 보임 (사용자)

Owner: caulee1227@gmail.com / 2026-05-23
