# Wave 799b — /lookup paywall (1번 = 0.2크레딧)

- 시간: 2026-05-30 KST
- 트리거: owner — "paywall임 크레딧 0.2 소모로 하자 ㅇㅇ"

## 결정

URL 시세 조회 1번 = **0.2 크레딧** 차감.

DB `mvp_user_credits.balance` 는 integer 라 fractional 직접 저장 불가 → **5번 누적 후 1크레딧 차감** 패턴으로 effective 0.2 구현.

## 구현

### 백엔드 — `/api/lookup/by-url/route.ts`

신규 helper `chargeLookupCredit(user, userRef)`:

1. **admin** (isAdminUser): pass-through, 차감 X
2. **counter 조회**: `mvp_rate_limits` bucket `lookup-counter:{userRef}` 의 `request_count`
3. **1~4번째** (`currentCount < 4`):
   - `check_mvp_rate_limit` RPC 호출 (max=99999, window=1년) → counter ++
   - 차감 X, `charged: false`, `lookupsUsed: currentCount + 1` 반환
4. **5번째** (`currentCount >= 4`):
   - `spendUserCredits({amount: 1, metadata: {source: 'lookup_5x'}})` 호출
   - 성공 시 counter row DELETE (reset 0)
   - 실패 시 `ok: false, reason: 'insufficient_credits'`
   - `charged: true`, `lookupsUsed: 0` 반환

### 호출 위치 — 데이터 fetch 성공 후

크레딧 차감은 **모든 데이터 fetch 성공 후** 호출 (응답 직전).
- 404 (not_found) → 무료 (counter 안 건드림)
- 202 (parse_pending) → 무료
- 400 (bad_body/no_url/unsupported_url) → 무료
- 429 (rate_limit) → 무료
- 200 (success) → counter ++ 또는 credit 차감

이유: 데이터 없는 매물 / 미파싱 매물 / 형식 오류 매물 = 사용자 실수 → paywall X.

### 응답 추가

```ts
creditInfo: {
  charged: boolean,
  balance: number | null,   // null = admin
  lookupsUsed: number,      // 0~5 (5는 방금 reset)
  lookupsPerCredit: 5
}
```

### 402 응답 (잔액 부족)

```json
{
  "error": "insufficient_credits",
  "message": "5번째 조회에서 1크레딧이 필요해요. 크레딧을 충전하면 계속 조회할 수 있어요.",
  "balance": 0,
  "lookupsUsed": 4
}
```

### UI — `/lookup/lookup-client.tsx`

신규 요소:

1. **Header pricing chip** — "조회 1번 = 0.2크레딧 (5번 = 1크레딧 차감)"
2. **결과 위 credit info section**:
   - 이번 조회: `무료 (3/5)` 또는 `-1크레딧 차감 (5번 누적 완료)`
   - 잔액 표시 (admin 은 "운영자 무한")
   - 4/5 누적 시 경고: "⚠️ 다음 조회는 5번째 — 1크레딧이 차감돼요"
3. **402 paywall card** — 잔액/메시지/`/plans` 충전 link

## Rationale — 5-count counter 패턴

### 왜 fractional 직접 저장 안 했나

- `mvp_user_credits.balance` integer 제약 (DB schema 변경하면 다른 모든 charge logic 영향)
- spend_mvp_user_credits RPC 가 integer 단위 처리
- DECIMAL 변경 = high-risk migration (PITR 미박힘 — 시점 복원 불가)

### 왜 mvp_rate_limits counter 재사용?

- 이미 존재하는 RPC (`check_mvp_rate_limit`) — increment 원자성 보장
- DELETE 로 reset 가능
- 무한 window (1년) 사용해 누적 카운터 역할

### Trade-off

- ⚠️ counter row 가 사용자 user_ref 마다 영구 저장 → mvp_rate_limits 커짐 (5번 차감 시 DELETE 라 row 평균 1개/user — 부담 작음)
- ⚠️ admin 이 비활성 사용자 검토 시 row 가 데이터 보임 — `lookup-counter:` prefix 로 구분 가능
- ⚠️ counter increment + credit spend 가 비-atomic — race condition 시 6번째 무료 가능성 있음 (얼마 안 됨, 정밀도보다 UX 우선)

## 사용 흐름

1. 1번째 조회 → 무료 (1/5)
2. 2번째 조회 → 무료 (2/5)
3. 3번째 조회 → 무료 (3/5)
4. 4번째 조회 → 무료 (4/5) + 경고 표시
5. 5번째 조회 → -1크레딧, counter reset (0/5)
6. 6번째 = 다시 1번째 (1/5)
7. 잔액 0 + 5번째 = 402 paywall → /plans

## Follow-up

- **/plans 페이지 entrance 점검** — paywall card 의 link 가 user 친화적 충전 페이지로 가는지 확인
- **counter cleanup cron** — 일정 시간 inactive user 의 lookup-counter row GC (optional, low priority)
- **bulk lookup discount** — 한 번에 10개 URL 입력 → 2크레딧 같은 pricing 고려 (옵션)
- **lookup history** — 조회한 URL 저장해서 user 의 "내 조회" 페이지 검토 (옵션)
