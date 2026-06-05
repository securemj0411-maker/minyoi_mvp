# 2026-06-05 Launch Contract Cleanup

## 결정

- 크레딧/PG 결제 기반 약관 표면을 계좌이체 멤버십 기준으로 전환했다.
- `/billing/*`, `/api/billing/*`, `/api/credits/me` 레거시 크레딧 결제/조회 경로는 직접 접근해도 멤버십 신청으로 돌리거나 410으로 막는다.
- 관리자 수동 크레딧 지급/회수, 레거시 수동입금 승인, 레거시 수동입금 자동 승인 cron은 비활성화한다.
- 신고/피드백은 토큰/크레딧 보상 계약이 아니라 운영자 검토 후 시세·상태·모델 보정 데이터로 반영하는 흐름으로 정리한다.
- 멤버십 입금 텔레그램 승인 링크는 서명 secret이 비어도 저장된 one-time token fallback으로 세션 없이 처리될 수 있게 한다.
- 5분 자동승인은 Vercel cron뿐 아니라 멤버십 상태 polling에서도 만료 시점이 지나면 승인 시도하도록 보강한다.
- 피드에서 보인 회전률이 상세에서 사라지는 현상을 줄이기 위해 detail-access 응답에도 velocity basis를 재계산해 포함한다.

## 보류

- `mvp_user_credits`, `mvp_credit_ledger`, `compensation_granted_tokens` 같은 DB 컬럼은 기존 데이터/관리자 호환 때문에 이번 변경에서 삭제하지 않았다.
- mock 지역 티오는 실제 가입자 수와 연결하지 않는다. 실제 회원은 제한 없이 받을 수 있고, 티오 표시는 마케팅/신청 UX용으로 유지한다.
- lint warning 57개는 기존 unused/img 경고라 이번 런칭 차단 작업 범위에서는 에러 제거까지만 처리했다.

## 검증

- `npm run lint`: 0 errors, 57 warnings.
- `npm run build`: 성공.
