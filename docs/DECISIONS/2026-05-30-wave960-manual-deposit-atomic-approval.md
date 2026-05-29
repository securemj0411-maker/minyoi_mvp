# Wave 960 — Manual Deposit Atomic Approval

## 결정

- 계좌입금 승인 경로의 `read balance -> write absolute balance -> mark request` 흐름을 중단하고, `approve_mvp_manual_deposit_request` DB RPC로 승인/잔액 증가/ledger 기록을 한 트랜잭션에 묶었다.
- RPC는 `mvp_manual_deposit_requests.status = 'pending'`인 row 하나만 claim한다. 운영자 승인과 3분 자동 승인 cron이 겹쳐도 먼저 claim한 한쪽만 실제 크레딧을 지급한다.
- 같은 결정이 네트워크 retry로 재호출되면 이미 처리된 같은 상태를 idempotent success로 돌려주되, `granted=false`로 반환해 추천인 보너스가 다시 실행되지 않게 했다.
- 거절도 `id`만 PATCH하지 않고 `id + status=pending` 조건으로만 변경한다. 자동 승인 직후 늦은 거절 클릭이 승인된 row를 `rejected`로 덮지 못하게 했다.

## 보류

- 추천 보너스, 운영자 회수, 카카오 공유 webhook 등 다른 credit grant 경로의 공통 atomic grant RPC화는 다음 wave로 보류했다.
- 텔레그램 승인 GET 링크의 CSRF/HMAC 보강은 별도 보안 wave로 남겼다.
- 수동 입금 24h 누적 cap 및 반복 자동 승인 차단 정책은 상품/운영 정책 결정이 필요해 이번 wave에서 넣지 않았다.

## 검증 계획

- `tests/manual-deposit-atomic-contract.test.ts`로 애플리케이션 코드가 RPC를 호출하고 기존 read-modify-write 패턴을 쓰지 않는지 계약 테스트를 추가한다.
- `tests/credit-abuse-guards.test.ts`와 함께 실행해 직전 상세 차감 어뷰징 방어 계약도 유지되는지 확인한다.
- build 통과 후 production DB에 migration dry-run/apply 순으로 반영한다.

## 검증 결과

- `supabase db push --dry-run`은 원격 migration history에 로컬에 없는 과거 migration들이 많아 중단됐다. schema drift를 건드리지 않기 위해 history repair는 하지 않았다.
- 같은 migration SQL을 production DB에 직접 적용했고, `select ok, granted, error from approve_mvp_manual_deposit_request(-1, 'admin')`가 `not_found`를 반환하는 것으로 함수 생성을 확인했다.
- Supabase REST RPC 경로 `/rest/v1/rpc/approve_mvp_manual_deposit_request`도 service role로 200 응답을 확인했다.
- `npx tsx --test tests/manual-deposit-atomic-contract.test.ts tests/credit-abuse-guards.test.ts` 통과.
- `npx eslint src/lib/manual-deposit-grant.ts src/app/api/admin/manual-deposit/decide/route.ts src/app/api/cron/manual-deposit-auto-approve/route.ts tests/manual-deposit-atomic-contract.test.ts` 통과.
- `npm run build` 통과.
