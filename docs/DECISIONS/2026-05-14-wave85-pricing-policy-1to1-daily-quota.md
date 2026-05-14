# Wave 85 — 가격/노출 정책 owner 결정 (1:1 + 일 토큰 한도)

> Status: **owner 결정 확정. 구현 대기.** 코드/DB 변경 0 (결정만 박음).

CLAUDE.md 6 필드 포맷.

## 0.1 owner 결정 확정

- 시간: 2026-05-14 KST
- 발견: Wave 77에서 가격/노출 정책 옵션 분석 (Standard 16k / Pro 39k / Power 79k + 1:1 vs 1:2 노출 + 일/5h 한도). owner 결정 대기 중이었음.
- 변경 (정책 확정, 코드 변경 0):
  - **노출 비율: 1:1 유지** — 매물 1개를 1명에게만 노출. 무결성 원칙 우선.
  - **한도 정책: 일 토큰 수 제한만** — 5h rolling window 안 도입. 단순화.
  - **5h 한도 폐기 사유**: 사용자 복잡도 증가 + 무결성 1:1 유지로 hard cap 충분.
- 검증: 결정만 박음. 코드 변경 시 별도 wave.
- 위험:
  - 1:1 노출 hard ceiling = 동접 ~500명 (Wave 77 §2 측정 기반: 일 ready inflow 500 × 30크레딧/유저/월 = 월 15,000 노출 / 1유저 30매물 = 500유저).
  - 동접 500 도달 후엔 waitlist 또는 매물 capacity 확장 (카테고리 신규 / 신규 SKU)으로만 해결.
  - 5h 한도 미도입 → 사용자가 일 한도를 1시간에 다 쓰는 burst 가능. peak 매물 쏠림 risk.
- 다음:
  - Standard/Pro/Power 일 한도 숫자 owner 결정 (Wave 77 제안: 8/25/80) — 추가 owner sign-off 필요.
  - 구현은 별도 wave (DB schema + API quota check + dashboard 표시).

## 1. 남은 결정 사항 (이번 wave 범위 밖)

| 사안 | 상태 |
|---|---|
| Standard/Pro/Power 가격 (16k/39k/79k) | owner 추가 sign-off 필요 |
| 일 한도 숫자 (8/25/80) | owner 추가 sign-off 필요 |
| Trial 5크레딧 가입 시 | owner 추가 sign-off 필요 |
| 시계/골프/카메라 ready 승격 | Wave 86 브리핑 후 결정 |
| 닌텐도 OLED 정책 | **보류** (오너 결정) |
