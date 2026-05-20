# 2026-05-20 Wave 401: 이니시스 V2 구매자 이름 필수 대응

## 배경
- 휴대폰 번호 필수값을 전달한 뒤, KG이니시스 V2 일반 결제창에서 구매자 이름 필수 오류가 추가로 확인됐다.
- PortOne Browser SDK V2의 `Customer` 타입에는 구매자 전체 이름 필드로 `fullName`이 제공된다.

## 결정
- 체크아웃 화면에서 결제자 이름을 직접 입력받는다.
- 입력된 이름은 공백을 정리한 뒤 PortOne `requestPayment`의 `customer.fullName`으로 전달한다.
- 반복 입력을 줄이기 위해 브라우저 로컬 저장소에 결제자 이름을 보관한다.
- Supabase/Kakao 사용자 메타데이터의 `full_name`, `name`, `nickname` 값이 있으면 로컬 저장값이 없을 때 초기값으로 사용한다.

## 보류
- 카카오 가입 단계에서 이름/전화번호 동의항목을 필수화하는 것은 결제 전환율과 개인정보 처리 정책을 보고 별도 결정한다.
- 서버 DB에 결제자 이름을 영구 저장하는 것은 현재 보류한다.
- 이니시스가 주소, 생년월일 등 추가 필수값을 요구할 경우 실제 결제창 오류와 PG 문서를 기준으로 최소 필드만 추가한다.

## 검증
- `npm run lint -- src/app/billing/checkout/checkout-client.tsx tests/portone-billing-contract.test.ts` 통과.
- `npx tsx --test tests/portone-billing-contract.test.ts` 통과.
- `git diff --check -- src/app/billing/checkout/checkout-client.tsx tests/portone-billing-contract.test.ts docs/DECISIONS/2026-05-20-wave401-inicis-buyer-name-required.md` 통과.
- `/billing/checkout?plan=starter` 브라우저 확인: 결제자 이름 입력란, 휴대폰 번호 입력란, 3,900원 결제 금액 표시 확인.
