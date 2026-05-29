# 2026-05-30 wave957 - Credit Abuse Audit And Guards

## Trigger
- 사용자 질문: "크레딧 부분 버그나 악용 소지 있는지?"
- 범위: 상세보기 차감, 카카오 공유 보너스, 계좌입금 승인, 레퍼럴/운영자 지급.

## Findings
- 상세보기 차감 RPC(`spend_mvp_user_credits`) 자체는 atomic update라 음수 잔액/동시 차감 붕괴는 막혀 있었다.
- 단, `consumeDetailAccess`가 `markOpenedPid`를 먼저 박고 그 뒤 차감해서, 0크레딧 계정이 같은 pid에 병렬 요청을 쏠 때 한 요청이 `already_opened`로 오인될 수 있었다.
- `/api/packs/pool/share-bonus` POST는 클라이언트에서 이미 폐기됐지만 서버에는 즉시 지급 코드가 남아 있었다. 인증 사용자가 직접 호출하면 24h 1회 +2크레딧을 받을 수 있는 free-credit 표면이었다.
- 운영 DB 확인상 최근 manual deposit 3건에서 같은 request_id가 ledger에 중복 지급된 흔적은 없었다.
- `is_beta_tester=true` 4계정은 의도적으로 상세보기 무제한이다. "잔액 0/낮은데 계속 열림" 류는 이 플래그일 가능성이 높다.

## Applied
- `src/lib/detail-access.ts`
  - free quota disabled 상태에서는 먼저 1크레딧을 atomic spend한다.
  - 그 다음 pid opened mark를 박는다.
  - 같은 pid 병렬 요청이 이미 열린 상태로 판정되면 방금 쓴 1크레딧을 즉시 refund한다.
  - mark 실패 시에도 refund를 시도한다.
- `src/app/api/packs/pool/share-bonus/route.ts`
  - GET cooldown 조회는 유지.
  - POST 즉시 지급은 410 `deprecated`로 차단.
- `src/components/explore-client.tsx`
  - 카카오 공유 CTA 설명을 실제 정책(+2)과 webhook 지급 구조에 맞게 정리.
- `tests/credit-abuse-guards.test.ts`
  - 상세보기 spend-before-mark 계약과 share-bonus POST 차단 계약 추가.

## Deferred
- Manual deposit 승인은 여전히 REST read-modify-write 기반이라, 관리자 승인과 자동 승인 사이의 극단적 race를 DB transaction 하나로 완전히 묶는 작업은 남아 있다.
- 권장 후속: `approve_mvp_manual_deposit_request` RPC를 추가해 `UPDATE request WHERE status='pending' RETURNING` + `UPDATE mvp_user_credits SET balance = balance + amount` + ledger insert를 한 transaction으로 처리한다.
- 레퍼럴 보상과 카카오 webhook 지급도 read-modify-write increment라, 트래픽이 늘면 generic atomic grant RPC로 합치는 것이 좋다.

## Verification Plan
- `npx tsx --test tests/credit-abuse-guards.test.ts`
- `npx eslint src/lib/detail-access.ts src/app/api/packs/pool/share-bonus/route.ts src/components/explore-client.tsx tests/credit-abuse-guards.test.ts`
- `npm run build`
