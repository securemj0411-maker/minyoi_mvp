# 2026-05-17 신규 가입자 welcome 8 매물 / 빈 화면 flash fix

## 버그 보고

- 시간: 2026-05-17 (사용자 보고)
- 보고: "왜 8개를 보여주는거지?? 그리고 가입하고 /me로 가자마자 스켈레톤뜨면서 기다리다가 갑자기 상품없다고 뜨다가 갑자기 8개 나타남"
- 증상: 신규 가입 → /me 진입 → (1) 스켈레톤 → (2) "아직 본 추천 상품이 없습니다" 빈 상태 → (3) 갑자기 8개 매물 등장
- 기대: 5개, 빈 상태 flash 없이.

## 원인 — 3 개 버그 (welcome 5→4 + double-fire + UI flash)

- 시간: 코드 정독 단계

### 버그 A: welcome 카드 수 5 → 4

`openPack` ([pack-open.ts:799-800](../../src/lib/pack-open.ts:799)) 가 홀수 `requestedCards` 를 짝수로 내림:
```ts
const targetCardsRaw = Math.max(2, Math.min(input.requestedCards ?? 2, 30));
const targetCards = targetCardsRaw % 2 === 0 ? targetCardsRaw : targetCardsRaw - 1;
```

welcome 라우트 `WELCOME_CARDS = 5` → `targetCards = 4`. 스펙·실제 불일치.

### 버그 B (치명): welcome useEffect 두 번 fire → 8 매물

`me-dashboard-client.tsx` 에 `setUser` 사이트 2 곳:
1. L127-147 `loadUser` → `supabase.auth.getUser()` 결과로 setUser
2. L165-176 `onAuthStateChange` subscription → INITIAL_SESSION 이벤트에 setUser

Supabase 가 두 경로 모두에서 User 객체 (다른 reference) 를 제공 → `useEffect(..., [user])` 두 번 실행 → `/api/packs/welcome` 두 번 병렬 POST.

welcome 라우트 once-only 가드 ([route.ts:40-47](../../src/app/api/packs/welcome/route.ts:40)):
```ts
const existing = await ...; // mvp_pack_reveals where user_ref = ...
if (existing.length > 0) return already_used;
```
DB write 전에 두 호출 모두 `existing.length === 0` 통과 → 양쪽 다 openPack → 4 × 2 = **8 reveal**.

### 버그 C: 빈 화면 flash

`UserRevealDashboard` 가 mount 즉시 `loadItems()` fire → welcome POST 완료 전에 fetch 끝남 → DB 비어있어 `total === 0` → "아직 본 추천 상품이 없습니다" 표시. 그 뒤 welcome 완료 → dispatch → reload → 카드 등장. 사용자 입장에서 "없다"→"있다" 깜빡임.

## 변경

- 시간: 2026-05-17
- 파일 + 위치:

### 1. `src/app/api/packs/welcome/route.ts:21-23`

`WELCOME_CARDS` `5 → 4` (openPack 의 홀수→짝수 내림 회피, 스펙·실제 일치). 사용자 합의 — 4 수용.

### 2. `src/components/me-dashboard-client.tsx`

- L5: `useRef` 추가 import
- L107-112: `welcomePending` state + `welcomeRequestedRef` ref 도입
- L184-220: welcome useEffect 에 ref 가드 (`welcomeRequestedRef.current === user.id` → skip) → user.id 별 1회만 POST
- L220 (finally): `setWelcomePending(false)` — 응답 받은 뒤 (성공/실패 무관) flash 해제
- L361: `<UserRevealDashboard ... welcomePending={welcomePending} />` prop 전달

### 3. `src/components/user-reveal-dashboard.tsx`

- L107: `welcomePending = false` 옵셔널 prop 받음
- L832-836: 빈 state 메시지 분기 — `welcomePending` 이면 "추천 매물을 준비하고 있어요. 잠시만 기다려주세요…" 표시 (빈 상태 flash 차단)

## 검증

- `npx tsc --noEmit` — 변경 파일 에러 0. 사전 존재한 wave141/145/148/151 test 에러는 unrelated.
- 사용자 측 runtime 확인 필요 (prod Vercel 배포 후):
  - 신규 이메일 가입 → /me 진입 → 빈 메시지 대신 "준비 중" → 4 카드 노출
  - DB `mvp_pack_reveals` row 정확히 4 (8 아님)

## 위험

- band = 2 hardcode 유지 (이전 wave 와 동일).
- 기존 본인 계정 (이미 8 reveal 박힌 상태) 은 본 fix 영향 없음 — welcome 라우트가 `already_used` 응답 → 추가 reserve X. 8개 → 4개로 줄이려면 DB row 4 개 삭제 (destructive, 사용자 명시 확인 필요).
- `useRef` 가드는 컴포넌트 mount 단위 — page navigation 후 재진입 시 ref 초기화 + welcome 라우트의 DB-level once-only 에 의존. DB row 가 한 번이라도 박히면 다음 진입 안전.
- React strict mode (dev only) 의 useEffect 더블 invoke 도 ref 가드로 막힘 (prod 영향 X).

## 다음

- prod 배포 후 신규 이메일 가입 1 회 → 4 카드 + "준비 중" copy 확인.
- 본인 계정 8 → 4 정리할지 사용자 결정 대기 (destructive 명시 confirm 필요).
- (선택) openPack 의 홀수→짝수 내림 로직 ([pack-open.ts:800](../../src/lib/pack-open.ts:800)) 가 어떤 wave 의 산물인지 추적. 일반 pack open 에 영향 없는지 검토.
- (선택) lint rule: raw `window.dispatchEvent` 사용 금지 (typed 헬퍼 강제).

## Lesson

1. `useEffect(..., [user])` 같은 객체 의존성은 reference 비교 — Supabase 처럼 같은 user 를 다른 reference 로 여러 번 제공하는 라이브러리와 결합하면 silent double-fire. 외부 trigger 가 reference equality 보장 안 하면 `useRef` 가드 명시 필요.
2. API once-only 가드는 read-then-write 패턴 → 병렬 호출에 race 취약. 진정한 idempotency 는 DB unique constraint 또는 atomic check-and-insert RPC. 본 fix 는 클라이언트 가드로 우회 — 추후 서버측 atomic 가드로 강화 가능.
3. 비동기 작업 중 UI 빈 state 표시 = "없다" 오인. `pending` state 명시해서 "준비 중" 으로 분기해야 가치 인식 끊김 X.
