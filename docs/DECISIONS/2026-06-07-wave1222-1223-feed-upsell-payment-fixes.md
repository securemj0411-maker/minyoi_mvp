# Wave 1222/1223 — 피드 7만원 1년 업그레이드 오퍼 결제 흐름 버그 3종

날짜: 2026-06-07 (KST)
계기: owner 보고 — 피드 "7만원 1년 무제한 업그레이드" 특가 오퍼(explore-client `FeedMembershipUpsellCard`) 결제 흐름 3개 버그.

## Bug 1 (Wave 1222) — 버튼 문구 "계좌 보기"
- 모달 수락 버튼 "제안 수락하고 계좌 보기" → **"제안 수락하기"**. 수락하면 자연히 입금방법/계좌 노출되므로 "계좌 보기"는 혼란만.
- explore-client.tsx ~807. commit 9a75e704 (pushed).

## Bug 2+3 (Wave 1223) — 입금 후 모달 즉시 닫힘 + 승인 토스트 안 보임
증상: '입금했어요' 누르면 연장/첫가입처럼 5분 자동승인 카운트가 안 뜨고 모달 즉시 닫힘(2). 텔레그램 승인해도 완료 토스트 안 뜸(3).

**근본 원인 (정상 연장모달과 비교로 확정):**
- 정상 연장모달(membership-application-client.tsx:168)은 `if (payload.isMember && applicationStatus === "approved")` 만으로 닫음.
- FeedMembershipUpsellCard(explore-client.tsx:553)는 `if (payload.isMember && (approved || **activeApproved**))` — `activeApproved = (payload.activePlan?.applicationId === reservationApplicationId)` 라는 **추가 클로즈**가 있었음.
- **기존 멤버 업그레이드**는 `isMember`가 처음부터 true + 새 예약이 곧장 activePlan으로 잡혀 입금 직후 첫 폴링(2초)에 `activeApproved` 참 → **진짜 승인 전에 모달 닫힘(Bug2)**. 토스트(approvalToast)는 set되지만 close와 같은 렌더에서 5.2초 자동소멸과 race → 안 보임(Bug3).
- 공유 컴포넌트(membership-checkout.tsx)의 deposit_sent 카운트다운 렌더(231-249)는 정상 — 렌더 버그 아니었음.

**fix:** `activeApproved` 클로즈 제거 → 정상 연장모달과 동일하게 `isMember && (새 application.status === "approved")` 만으로 닫음. 입금 후 5분 카운트 정상 표시되고, 진짜 승인(텔레그램/5분 자동) 시에만 닫히며 토스트가 race 없이 뜸.
- explore-client.tsx 546-553. display/polling-layer only, 결제 API/금액 로직 미변경.

검증: tsc clean(explore-client 0 에러). 정상 연장모달 회귀 없음(그쪽은 미변경, 동일 로직으로 수렴).
권장 후속: 기존-멤버 계정으로 입금→5분카운트→승인→완료 토스트 실제 확인.
