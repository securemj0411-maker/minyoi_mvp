# 2026-05-20 Wave 399 — PortOne V2 KG이니시스 테스트 결제창 연동

## 결정

- 기존 `/billing/checkout`의 `tossmock_*` 모의 결제 흐름을 PortOne V2 SDK 결제창 호출로 교체했다.
- 사용 채널은 현재 확인된 득템잡이 PortOne 테스트 채널로 잡았다.
  - Store ID: `store-670b9708-35fd-4e46-9cd0-48b5c0e56f6a`
  - Channel key: `channel-key-69134205-c63b-46d9-b389-aff785c8dfe3`
  - PG: KG이니시스 V2 테스트 채널
- 클라이언트는 `@portone/browser-sdk/v2`의 `requestPayment()`를 호출한다.
  - `paymentId`: 득템잡이에서 생성한 40자 이하 ASCII 주문 식별자
  - `orderName`: `득템잡이 N 크레딧 충전권`
  - `totalAmount`: `plan.priceKrw`
  - `currency`: `CURRENCY_KRW`
  - `payMethod`: `CARD`
- 결제 성공 응답의 `paymentId`를 서버 `/api/billing/subscribe`로 보내고, 서버가 크레딧 지급 RPC를 호출한다.
- 서버는 `PORTONE_API_SECRET`이 있으면 PortOne V2 결제 단건 조회 API로 `PAID` 상태와 결제 금액을 검증한 뒤 크레딧을 지급한다.
- 로컬 개발에서 API Secret이 없을 때는 검증을 `skipped_dev_no_secret`으로 표시하며 통과시킨다. production에서는 `PORTONE_API_SECRET` 또는 명시적 `PORTONE_SKIP_VERIFY=1` 없이 통과하지 않는다.

## 보류

- 실제 운영 배포 전 `PORTONE_API_SECRET`을 배포 환경에 반드시 넣어야 한다.
- 모바일 리디렉션 결제 완료 처리(`redirectUrl`)는 아직 별도 라우트로 분리하지 않았다. 현재는 PC/팝업 반환 흐름 중심이다.
- 웹훅 기반 최종 대사, 결제 취소/환불 API 연동, 결제 이벤트 테이블의 provider 명칭 정리는 후속 작업으로 남긴다.

## 검증

- `tests/portone-billing-contract.test.ts`로 PortOne SDK 호출, 서버 검증 호출, 테스트 채널 설정을 고정했다.
- `npm run lint -- src/app/billing/checkout/checkout-client.tsx src/app/api/billing/subscribe/route.ts src/lib/client-billing.ts src/lib/portone-config.ts src/lib/portone-server.ts tests/portone-billing-contract.test.ts` 통과.
- `npx tsx --test tests/portone-billing-contract.test.ts` 통과.
- 기존 dev server(`localhost:3000`)에서 `/billing/checkout?plan=starter`가 SDK import 후 정상 렌더링되는 것을 브라우저로 확인했다.
