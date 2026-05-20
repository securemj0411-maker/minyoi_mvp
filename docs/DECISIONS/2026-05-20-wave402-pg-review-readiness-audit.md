# 2026-05-20 Wave 402: PG 심사 대비 사이트 리스크 점검

## 기준
- PortOne PG 심사 가이드 기준으로 판매 상품, 판매금액, 사업자정보, 환불정책, 운영정책, 결제모듈 호출 가능 여부를 확인했다. (참고: https://guide.portone.io/6e20063c-1305-475f-a71a-c4d5cd5f3556)
- KG이니시스 V2 기준으로 PC 일반결제 필수 구매자 정보(`fullName`, `phoneNumber`, `email`)를 확인했다. (참고: https://developers.portone.io/opi/ko/integration/pg/v2/inicis-v2)

## 결정 및 수정
- 체크아웃에서 결제자 이메일, 이름, 휴대폰 번호를 모두 입력받고 PortOne `customer.email`, `customer.fullName`, `customer.phoneNumber`로 전달한다.
- 체크아웃에서 로그인 필요 시 `next=/billing/checkout?plan=...`을 붙여 결제 페이지로 복귀하도록 했다.
- 개인정보처리방침에 결제자 이름, 이메일 주소, 휴대폰 번호 수집 및 KG이니시스/포트원 결제 위탁을 반영했다.
- 이용약관의 크레딧 정의를 "사이버 머니"에서 "서비스 이용 단위"로 낮춰 결제상품 성격을 명확히 했다.
- 공개 화면의 "차익/수익" 톤을 "시세 차이/참고 정보" 중심으로 낮췄다.
- `/admin` 경로에 서버 측 로그인 + admin 검사를 추가했다.
- PG 심사 체크 항목을 `tests/pg-review-readiness.test.ts` 계약 테스트로 추가했다.

## 남은 심사 리스크
- footer 대표번호가 휴대폰 번호(`010-8168-5816`)다. PortOne 가이드상 사업자정보의 전화번호는 휴대폰 번호가 불가하므로 유선번호 또는 대표전화 대체 수단 확보가 필요하다.
- footer 통신판매업신고가 `신고 준비 중`이다. 일부 카드사 심사에서 통신판매업번호가 필수이므로 실제 신고번호 확보 후 교체해야 한다.
- 로그인 후 결제창 호출형 서비스이므로 PG 신청서/심사 요청 시 심사용 테스트 계정을 제공해야 한다.
- 운영 배포 전 `PORTONE_API_SECRET`을 production 환경변수에 설정해야 서버 결제 검증이 실제로 동작한다.
- 심사는 `test`, `dev`, `staging` 문구가 없는 실 URL에서 진행해야 한다.

## 검증
- `npm run lint -- src/app/billing/checkout/checkout-client.tsx src/app/admin/layout.tsx src/app/privacy/page.tsx src/app/terms/page.tsx src/app/refund-policy/page.tsx src/components/app-footer.tsx src/components/auth-form.tsx src/components/preview-masked-dashboard.tsx src/app/how-it-works/page.tsx tests/portone-billing-contract.test.ts tests/pg-review-readiness.test.ts` 통과. 기존 `<img>` 사용 warning 1건은 남음.
- `npx tsx --test tests/portone-billing-contract.test.ts tests/pg-review-readiness.test.ts` 통과.
- `git diff --check` 통과.
- 브라우저 확인: `/plans`, `/billing/checkout?plan=starter`, `/privacy`, `/refund-policy`, `/terms`에서 상품/금액, 결제자 필드, 환불정책, 사업자정보 footer 노출 확인.
