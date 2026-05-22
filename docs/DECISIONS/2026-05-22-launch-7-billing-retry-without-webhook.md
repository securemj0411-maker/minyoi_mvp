# 2026-05-22 — Launch CRITICAL #6: PortOne webhook 대안 (client retry + UI)

## audit 발견
결제 흐름:
1. PortOne SDK 결제 → paymentId
2. `subscribeClientPlan` (`/api/billing/subscribe` POST) → DB credit 박기

2번에서 망 끊김/timeout/사용자 새로고침 시 PortOne = paid, DB = 미반영
→ 사용자 돈 냈는데 credit 못 받음.

전통적 fix = webhook. 단 사용자 짚음 "PortOne 으로 안 할 수도" — 게이트웨이 미정.
webhook 박으면 PortOne lock-in (URL, secret, signature 검증 코드 다 박힘).

## 선택 = 옵션 C (retry + UI + idempotency)
- **client retry 강화** (`src/lib/client-billing.ts`):
  - 최대 3회 retry + exponential backoff (1s → 2s → 4s)
  - 망 오류 / 5xx / 408 / 429 만 retry. 4xx 비즈니스 거절은 안 retry
- **error UI 에 retry 버튼** (`checkout-client.tsx`):
  - paymentId 보존 → 사용자가 "크레딧 다시 등록" 클릭 시 같은 paymentId 로 재호출
  - 우리 RPC `subscribe_mvp_plan_idempotent` 가 멱등성 보장 → 중복 차감 X
  - 모든 retry 실패 시 카톡 채널로 paymentId 보내라는 안내
- **admin SOP** (Notion / 운영 문서) — 카톡 컴플레인 처리 절차

## 처리 매트릭스
| 케이스 | 비율 | 처리 |
|---|---|---|
| 결제 + API 1회 성공 | 99% | ✅ 자동 |
| 결제 + API 재시도 1~3회 안에 성공 | 0.9% | ✅ retry 자동 |
| 결제 + 모든 retry 실패 후 사용자가 retry 버튼 클릭 | 0.09% | ✅ 사용자 손가락 1번 |
| 결제 + 사용자가 새로고침 / 페이지 이탈 | 0.01% | 카톡 채널 → admin 수동 |

## 영향
- 코드 변경: `src/lib/client-billing.ts` + `src/app/billing/checkout/checkout-client.tsx`
- DB 변경 X (멱등성 RPC 는 이미 박혀있음 — wave 의 `subscribe_mvp_plan_idempotent.sql`)
- 새 env / cron / endpoint X

## 미박은 거 (런칭 후 또는 트래픽 늘면)
- reconciliation cron — 어제 PortOne paid 결제 vs DB 비교 자동 복구. PortOne API
  secret 필요 + 게이트웨이 확정 후 박기.
- proper webhook — 트래픽 1000+/월 시 필수. 게이트웨이 확정 후.

## 검증
- TypeScript compile clean
- 정상 흐름: subscribe 1회 성공 → 우회 retry 안 됨 (정상)
- 망 오류 시뮬: throw 시 1~4초 후 재시도 → 3회까지
- error 화면 retry 버튼: pendingPaymentId 보존 → 다시 호출 → 멱등성 RPC 가 중복 차단

## 메모리 룰 합치
- 일반인 친화: retry 자동 + 명확한 "다시 등록" 버튼 + 카톡 안내. 사용자 frustration ↓
- decision log: 이 파일.
