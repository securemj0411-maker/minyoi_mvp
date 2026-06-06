# Wave 1200 — 예약 만료 후 입금확인 404 무한루프 안내 (audit P0)

날짜: 2026-06-06
관련: Wave 1199 audit P0 #2 (발견), membership-application-client.tsx
commit: da81dabf

## 문제 (audit P0 #2)
신규 예약은 생성 7분 후 서버가 자동 rejected(`expireUnpaidReservationsForUser`).
사용자가 토스로 **송금을 마친 뒤** 모달에서 "입금했어요"를 7분+ 지나 누르면:
- deposit-notify가 404 `no_pending_application`(route.ts:93) 반환
- 클라 `notifyDepositDone`이 모든 실패를 "입금 확인 요청을 보내지 못했어요. 잠시 후 다시 눌러주세요"로 뭉뚱그림
- row가 이미 영구 rejected라 **몇 번을 다시 눌러도 영원히 실패** → 돈 나간 채 화면서 갇힘.

## fix
`notifyDepositDone`(membership-application-client.tsx:322)에 404 별도 분기:
- 404면 "예약 시간이 만료됐어요. 아래 '기간/금액 변경'으로 다시 예약해주세요. 이미 송금하셨다면
  고객센터(🎧)로 알려주시면 바로 확인해 드려요."
- 그 외 실패는 "네트워크 확인 후 다시 눌러주세요"로 분리.
→ 만료 시 재예약 동선 + 송금자 고객센터 안내. 무한 실패 루프 해소.

## TS check
clean.
