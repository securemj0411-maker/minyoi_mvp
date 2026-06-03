# 2026-06-04 Wave 1037 — 크레딧 UI 제거와 선공개 멤버십 신청 게이트

## 결정

- 유저가 보는 결제/가격 흐름은 크레딧 충전이 아니라 `선공개 300명 멤버십 신청`으로 전환한다.
- `/plans`는 결제 페이지가 아니라 신청 페이지로 사용한다. CTA 문구도 `결제하기`가 아니라 `신청하기`로 둔다.
- `/me`는 홈 지역 설정 후 멤버십 승인 상태를 확인하고, 미승인 계정은 `/plans?from=me`로 보낸다.
- 상세 열람 API는 기존 credit balance가 아니라 `getProStatus`의 `isPro/isAdmin/isBetaTester`를 무제한 상세 열람 source of truth로 본다.
- 기존 크레딧 ledger, manual billing route, legacy billing internals는 즉시 삭제하지 않고 숨겨진 호환 계층으로 유지한다.

## 구현

- `/plans`를 신청/심사형 멤버십 페이지로 교체했다.
- 신청 버튼은 `/api/membership/apply`로 운영자 텔레그램 알림을 보낸다.
- 상단 네비와 계정 패널에서 크레딧 잔액/충전 CTA를 제거하고 멤버십 언어로 바꿨다.
- 상세 paywall 문구와 fallback CTA를 멤버십 신청 기준으로 바꿨다.
- 회귀 테스트를 추가해 `/plans`, nav, account panel, detail access route가 예전 크레딧 충전 UI로 돌아가면 실패하게 했다.

## 보류

- 실제 300명 hard cap은 이번에 넣지 않았다. 현재는 광고/포지셔닝 표현으로만 사용한다.
- 신청 상태 저장용 DB 테이블은 만들지 않았다. 우선 텔레그램 접수 알림과 기존 `mvp_user_plans`/legacy pro 상태로 승인 여부를 운영한다.
- `/billing/manual` 등 숨겨진 legacy 결제 화면은 삭제하지 않았다. 완전 제거는 별도 정리 작업으로 진행한다.
