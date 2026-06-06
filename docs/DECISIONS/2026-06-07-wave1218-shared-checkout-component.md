# Wave 1218 — 멤버십 결제 UI 공유 컴포넌트 추출 (가입/연장 모달 ↔ 피드 1시간 특가 오퍼)

## 배경 / 발견

- 시간: 2026-06-07 KST
- 발견 (owner 지적): 피드의 "7만원 더 내면 1년 무제한" 업그레이드 오퍼(`explore-client.tsx`의 `FeedMembershipUpsellCard`)가
  가입/연장 모달(`membership-application-client.tsx`)과 **완전히 다른 컴포넌트**로 만들어져 색/레이아웃/카운트다운/신뢰배지가 제각각이었음.
  - 피드 오퍼: amber/emerald 테마, 입금했어요 = emerald h-11, 신뢰배지 없음, 계좌 복사 버튼 없음.
  - 가입 모달: blue(#3182f6/brand-accent) 테마, 입금했어요 = brand-accent h-14 2줄, 신뢰배지(사업자/실명/환불) 상시 노출, 계좌 복사 버튼 있음 (Wave 1195~1214에서 다듬은 canonical 룩).
  - owner 요구: "적어도 컴포넌트는 공유하고 문구만 약간 다르게, 7분 카운트가 아니라 1시간 카운트 쓰고 문구만 맞게."

## 변경

신규 파일 **`src/components/membership-checkout.tsx`** (presentational, 상태 없음):
- `MembershipCheckoutBody` — 입금방법 선택(토스/계좌) → 송금정보 → 입금했어요 CTA → 신뢰배지 → 자동승인 카운트다운 → PaymentTrustCard.
  - `showDepositCountdown = depositState === "sent"`, `showPaymentDetails = showDepositCountdown || paymentMethod !== null` (양쪽 부모 정의와 동일).
  - 가입 모달의 canonical 마크업(blue 테마)을 **그대로** 옮김. 예약/입금확인 API·상태머신은 각 부모가 소유하고 콜백/상태로 주입.
  - props: `planLabel, priceKrw, intent("new"|"renewal"), paymentMethod, depositState, autoApproveMsLeft, copyOk, busy, onChooseToss/Bank/ReopenToss/SwitchToBank/ResetMethod/CopyAccount/NotifyDeposit, note, noteTone`.
- `UrgencyCountdownCard` — 모달 헤더 우측 "남은 시간" 카운트다운 카드. 가입=7분 자리예약 만료, 피드=1시간 특가. value 문자열만 다르고 룩 동일.
- `countdownLabel` — m:ss 포맷 (양쪽에 중복돼 있던 것 단일화).

**`membership-application-client.tsx`** (canonical 소스 — 동작/룩 회귀 0):
- 헤더 7분 카운트다운 카드(기존 인라인 div) → `<UrgencyCountdownCard label="자리 예약 만료까지" .../>`.
- 본문 입금 UI 블록(method picker/details/CTA/badges/reset/note/trustcard) → `<MembershipCheckoutBody .../>`. 기존 핸들러/상태 1:1 매핑 (`selectedPaymentMethod`→paymentMethod, `depositNotifyState`("error"→"idle" 매핑)→depositState 등). 상단 error + 푸터(기간변경/취소)는 부모 유지.
- 로컬 `countdownLabel` 제거 → 공유 import. 미사용 import 제거(`TossPaymentLogo`/`KbankPaymentLogo`/`PaymentTrustCard`/`PAYMENT_ACCOUNT_HOLDER`/`PAYMENT_BANK_NAME`; `PAYMENT_ACCOUNT_NUMBER`는 copyAccountNumber에서 유지, `krw`는 PlanGrid에서 유지).

**`explore-client.tsx` `FeedMembershipUpsellCard`** (canonical 룩으로 통일):
- 모달 shell/헤더를 amber → canonical blue(#f5f8ff 헤더, border-blue-100, max-w-520, 닫기 버튼)로 교체.
- 헤더 카운트다운: 7분이 아니라 **1시간 특가**(`UrgencyCountdownCard value={formatCooldown(clamped)}`).
- 예약 후 입금 UI(amber/emerald 자체 구현) → `<MembershipCheckoutBody intent="renewal" .../>` 재사용. `requestState` union → `feedDepositState`("deposit_sent"→sent / "depositing"→sending / else idle)로 매핑.
- 헤더 badge/title/subtitle = canonical 연장 모달 흐름(상태별 카피). 예약 전엔 금액/절약 카드 + "제안 수락하고 계좌 보기"(brand-accent) 유지.
- 신규: `copyOk` state + `copyAccountNumber()` (공유 본문의 계좌 복사 버튼용). 피드는 기존에 복사 버튼이 없었음 → 공유로 획득.
- 로컬 `countdownLabel` 제거. 미사용 import 제거(동일 목록). 플랜 배열은 그대로 `RENEWAL_UPGRADE_PLANS`(`feedOfferPlansFor`).
- 피드 오퍼 위치(Wave 1216 피드 상단)·인라인 amber 프로모 배너는 유지 (배너는 피드 마케팅 entry, 모달이 공유 체크아웃).

부수 효과(의도된 일관화): 피드 오퍼가 이제 신뢰배지(사업자/실명/미승인 시 전액 환불), 계좌 복사 버튼, 2줄 brand-accent "입금했어요", 연장 문구("연장 승인 중") 획득.

## 검증

- `npx tsc --noEmit`: `src/` 에러 **0**. (전체 54 에러는 전부 사전 존재 `tests/`·`.next/types` 생성파일 — 이번 변경 무관.)
- `npx eslint` (3개 파일): clean.
- 런타임 컴파일 (dev :3000): `/plans`(가입 모달) HTTP 200, `/me`(피드) HTTP 200, compile-error 마커 0.
- 가입 모달 마크업은 공유 컴포넌트로 **byte-identical 이동** → 시각적 회귀 위험 0. 동작(reserveOffer/submitApplication/deposit-notify/7분 만료/취소/승인 폴링)은 각 부모에 그대로.

## 위험 / 보류

- 시각 e2e (실제 모달 스크린샷): 피드 오퍼는 member + active member offer 상태에서만 렌더돼 익명 dev 세션에서 미표시. 정적/컴파일 검증으로 갈음. owner가 라이브 확인 원하면 member-offer 상태 세팅 후 스크린샷 가능.
- **로직 dedup 보류**: 예약/입금확인 API 호출 함수(reserveOffer/submitApplication/notifyDepositDone)는 각 부모가 유지 (7분 자리예약 vs 1시간 특가, 상태머신/폴링 의미가 달라 hook 통합 시 회귀 위험 큼). owner "중복 입금 로직 제거"는 중복 **UI 렌더 로직** 제거로 해석 — 달성. 향후 `useMembershipCheckout` hook 통합은 별도 wave 후보.
- `intent` 2값(new/renewal)만 카피 분기. feed-upgrade는 renewal로 취급 (만료일 뒤 기간 추가 의미 동일).

## 다음

- (선택) member-offer 상태에서 피드 모달 라이브 스크린샷으로 가입 모달과 픽셀 일관 최종 확인.
- (선택) reserve/deposit-notify API 호출을 `useMembershipCheckout` hook으로 통합 (회귀 테스트 동반 시).
