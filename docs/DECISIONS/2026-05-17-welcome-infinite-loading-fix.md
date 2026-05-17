# 2026-05-17 welcome "준비 중" 무한 로딩 fix

## 버그 보고

- 시간: 2026-05-17 (사용자 보고)
- 보고: "추천 매물을 준비하고 있어요. 잠시만 기다려주세요… 이거 무한로딩임 새로고침하면 4개 와있음;;"
- 증상: 신규 가입 → /me 진입 → "준비 중" 메시지 무한. 새로고침하면 4개 정상 노출.

## 원인

- 시간: 코드 정독
- 발견: 이전 fix ([2026-05-17-welcome-double-fire-fix.md](2026-05-17-welcome-double-fire-fix.md)) 의 `cancelled` flag 가 `useEffect` cleanup 으로 true 되면 `finally` 블록 의 `setWelcomePending(false)` 가 skip. fetch 자체는 abort 되지 않고 진행돼서 DB 엔 4개 박힘 (새로고침 시 보이는 이유).

문제 코드 ([me-dashboard-client.tsx 이전 버전](../../src/components/me-dashboard-client.tsx)):
```ts
let cancelled = false;
(async () => {
  try {
    // ... fetch + processing
    if (cancelled) return; // cleanup 호출되면 여기서 return
    // ...
  } finally {
    if (!cancelled) setWelcomePending(false); // cancelled=true 면 skip → 무한 로딩
  }
})();
return () => { cancelled = true; };
```

cleanup 발동 시나리오:
1. React strict mode (dev) 의 useEffect 더블 invoke
2. prod 에서 `user` reference 가 (loadUser + onAuthStateChange) 두 번 set 되면서 useEffect rerun → 첫 invocation cleanup 호출
3. 컴포넌트 unmount

어느 경로든 `cancelled = true` → pending false 안 됨 + dispatch 도 skip → 사용자 입장: "준비 중" 영원 + 새 카드 자동 표시 안 됨 (수동 새로고침 필요).

## 변경

- 시간: 2026-05-17
- 파일 + 위치:

### 1. `src/components/me-dashboard-client.tsx` (welcome useEffect)

- `cancelled` flag + cleanup return 제거
- `finally { setWelcomePending(false); }` — 무조건 풀음
- React 의 unmount 후 setState 는 silent ignore (warning only) → 안전
- ref 가드 (`welcomeRequestedRef.current === user.id`) 는 유지 — double-fire 방지

```ts
// Before
let cancelled = false;
(async () => {
  try { ... if (cancelled) return; ... }
  finally { if (!cancelled) setWelcomePending(false); }
})();
return () => { cancelled = true; };

// After
(async () => {
  try { ... }
  finally { setWelcomePending(false); } // 무조건
})();
// cleanup 없음
```

### 2. `src/components/user-reveal-dashboard.tsx` (welcomePending 전환 감지)

`welcomePending` true → false 전환 시 `loadItems({ silent: true })` 자동 호출. dispatch event 가 listener 등록 전 fire 되거나 미스 된 경우 fallback. 새 useEffect:

```ts
const prevWelcomePendingRef = useRef<boolean>(welcomePending);
useEffect(() => {
  if (prevWelcomePendingRef.current && !welcomePending) {
    void loadItems({ silent: true });
  }
  prevWelcomePendingRef.current = welcomePending;
}, [welcomePending, loadItems]);
```

dispatch handler 가 잡아도 동일 reload 발생 — idempotent 라 안전.

## 검증

- `npx tsc --noEmit` — 변경 파일 에러 0.
- 시나리오:
  - cleanup 발동 case: cancelled flag 없음 → finally 항상 실행 → pending false 풀림.
  - dispatch 미스 case: pending false 전환 감지 useEffect 가 silent reload → 4 카드 표시.
  - 정상 case: dispatch 잡고 reload + pending false → 4 카드 + reload 1회 더 (idempotent).
- 사용자 측 runtime 확인 필요 (prod 배포 후): 신규 이메일 가입 → 무한 로딩 없이 4 카드 노출.

## 위험

- unmount 후 setState 가 React warning 출력 가능 (silent ignore but console noise). prod 영향 없음.
- welcomePending 전환 감지 + dispatch handler 둘 다 reload → 동일 API 두 번 호출. 비용 작고 idempotent. 후속 wave 에서 정리 가능.
- 본인 (사용자) 계정 이미 8 reveal 박혀있음 (이전 double-fire 버그). 본 fix 영향 없음. 정리 원하면 destructive SQL 필요 — 사용자 명시 confirm.

## 다음

- prod 배포 후 신규 이메일 가입 1 회 → 무한 로딩 없이 4 카드 즉시 노출 확인.
- (선택) AbortController 도입해서 unmount 시 fetch 자체 cancel — 현재는 fetch 완료까지 진행 (서버 자원 소모 작아 보류 가능).
- (선택) welcome 라우트 server-side atomic check-and-insert RPC 도입 — 클라이언트 ref guard 의존도 낮춤.

## Lesson

`cancelled` flag pattern 은 dispatch / 후속 state update 를 막아야 할 때만 써야 함. "최종 상태 정리" (pending false, modal close 등) 는 cleanup 영향 받지 않게 무조건 실행해야 함. 잘못 쓰면 비동기 작업이 partially 완료되고 (서버 호출 성공, 클라이언트 state 미동기화) 사용자는 무한 대기.

또 dispatch event 의존하는 reload 는 listener 타이밍 의존성 위험. fallback 으로 state 전환 감지 reload 박는 게 견고.
