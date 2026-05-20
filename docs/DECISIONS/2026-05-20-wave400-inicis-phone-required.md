# 2026-05-20 Wave 400: 이니시스 V2 휴대폰 번호 필수 대응

## 배경
- PortOne V2 + KG이니시스 일반 카드 결제창 호출 시 "구매자 휴대폰 번호는 필수 입력" 오류가 발생했다.
- 현재 크레딧 충전 흐름은 `/billing/checkout`에서 PortOne 결제창을 직접 호출한다.

## 결정
- 카카오 가입 단계의 전화번호 권한 추가를 즉시 선행하지 않는다.
- 체크아웃 화면에서 결제자 휴대폰 번호를 직접 입력받고, `01012345678` 형태의 국내 휴대폰 번호를 클라이언트에서 먼저 검증한다.
- 입력된 번호는 PortOne V2 `requestPayment`의 `customer.phoneNumber`로 전달한다.
- 사용자가 반복 입력하지 않도록 브라우저 로컬 저장소에 정규화된 번호를 보관한다.
- Supabase 사용자 메타데이터나 auth phone 값이 있으면 로컬 저장값이 없을 때 초기값으로 사용한다.

## 보류
- 카카오 `phone_number` 동의항목 추가 및 가입 시 자동 수집은 추후 전환율/마찰을 보고 별도 결정한다.
- 휴대폰 번호를 서버 DB 프로필에 저장하는 정책은 개인정보 보관 목적, 보관 기간, 삭제 기준을 정한 뒤 진행한다.
- 이니시스가 구매자 이름 등 추가 필수값을 요구할 경우 결제창 오류 기준으로 최소 필드만 추가한다.

## 검증
- `npm run lint -- src/app/billing/checkout/checkout-client.tsx tests/portone-billing-contract.test.ts` 통과.
- `npx tsx --test tests/portone-billing-contract.test.ts` 통과.
- `git diff --check -- src/app/billing/checkout/checkout-client.tsx tests/portone-billing-contract.test.ts docs/DECISIONS/2026-05-20-wave400-inicis-phone-required.md` 통과.
- `/billing/checkout?plan=starter` 브라우저 확인: 휴대폰 번호 입력란, KG이니시스 안내 문구, 3,900원 결제 금액 표시 확인.
