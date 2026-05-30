# Wave 800 — 카카오 OAuth 가입 시 telegram 알림 누락 fix (ConsentFlusher)

## 사용자 보고

> "지금 방금 누구 가입했는데 텔레그램 알림 안왔는데 설마 지금 이메일 가입만 감지해서 알려주는거냐?"

> "정석으로 해야되는거아닌가"

→ client-side session listener (정석) 로 박음.

## 진단

기존 flow (이메일 가입):
1. `auth-form.tsx` submit → Supabase `signUp` (autoConfirm)
2. 즉시 session 박힘 → 같은 component 에서 `await flushPendingConsents()` (line 193)
3. `/api/auth/consents` POST → `mvp_user_consents` insert → `isFirstSignup` detect → `notifyAdminTelegram` 호출 ✓

문제 (카카오 OAuth 가입):
1. `auth-form.tsx` 의 카카오 버튼 → Supabase OAuth → 카카오 redirect
2. 카카오 로그인 → `auth/callback/route.ts` 로 redirect (새 페이지)
3. `auth-form` component **unmount** → line 193 의 `flushPendingConsents` 안 박힘
4. `auth/callback/route.ts` 에 flush 호출 / consents POST / telegram 알림 다 **없음**
5. → consents row 안 박힘 → telegram silent fail

확인 (grep):
- `auth/callback/route.ts` 에 `flushPendingConsents`, `consents`, `notifyAdminTelegram` 다 0 hits
- `auth-form.tsx:193` 만 유일 호출자

## Fix (정석)

신규 `src/components/consent-flusher.tsx`:
```tsx
"use client";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { flushPendingConsents } from "@/lib/pending-consents";

export default function ConsentFlusher() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;

    // 마운트 직후 1번 — 카카오 callback redirect 후
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && !cancelled) {
        await flushPendingConsents().catch(...);
      }
    })();

    // SIGNED_IN event — 신규 가입 / 로그인 둘 다
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_IN" && session?.user) {
        await flushPendingConsents().catch(...);
      }
    });

    return () => { cancelled = true; subscription?.unsubscribe(); };
  }, []);
  return null;
}
```

`src/app/layout.tsx`:
- BalanceToast 패턴 따라 ConsentFlusher import + render

## 효과

| Flow | Before | After |
|---|---|---|
| 이메일 가입 | auth-form line 193 → flush ✓ | 동일 + ConsentFlusher 도 (idempotent, 중복 X) |
| 카카오 가입 | redirect → flush 안 박힘 → telegram **누락** ✗ | ConsentFlusher SIGNED_IN 감지 → flush → telegram ✓ |
| 기존 로그인 | flush 안 박힘 (정상) | localStorage 비어서 no-op (정상) |
| 향후 provider (네이버 등) | 신규 코드 박아야 됌 | 자동 cover |

## 비파괴 보장

- `auth-form.tsx` 의 기존 flush 호출 유지 (이메일 가입 무영향)
- `flushPendingConsents` 자체 idempotent — `clearPendingConsents` 박힌 후 localStorage 빈 array → no-op
- 카카오 / 이메일 / 미래 provider 다 cover
- consents endpoint `isFirstSignup` 판정 = `mvp_user_consents` count 0 → 첫 가입 시만 telegram. 재 호출해도 telegram 중복 X.

## Trade-off

- ✅ 거의 없음
- ⚠️ Layout 마운트 시 매번 supabase getSession 1회 + auth listener 1개 박힘 (cheap, 카카오 flow 외 영향 0)
- ⚠️ pending-consents localStorage 가 비어있으면 no-op — 비 가입 flow 영향 0
- 한 사용자 첫 가입 1번만 실제 insert (consents row 박힘 → 이후 호출은 `existingConsentsCount > 0` → telegram 안 옴)

## 검증

```sql
-- 카카오 가입 이후 consents row 확인
SELECT user_id, consent_type, created_at
FROM mvp_user_consents
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC LIMIT 20;

-- 신규 가입 사용자 + 카카오 provider 확인
SELECT u.id, u.email, u.raw_app_meta_data->>'provider' AS provider, u.created_at
FROM auth.users u
WHERE u.created_at >= NOW() - INTERVAL '1 day'
ORDER BY u.created_at DESC LIMIT 10;
```

기대:
- 카카오 신규 가입 → telegram 알림 도착
- `mvp_user_consents` 에 row 박힘
- 콘솔 warn 없음

## 복원 가이드

문제 발생 시:
```diff
- <ConsentFlusher />
+ {/* <ConsentFlusher /> */}
```

또는 component 안 `useEffect` body return 만:
```tsx
useEffect(() => { return; }, []);
```

기존 이메일 가입 flow (`auth-form.tsx:193`) 은 그대로 작동.

## What Not To Do

- `auth/callback/route.ts` server-side 에서 flush 박지 X — `flushPendingConsents` 가 localStorage 의존 → server side 에서 못 함.
- session listener 박지 않고 setTimeout 폴링 박지 X — race condition + UX 지연.
- `SIGNED_IN` 외 event 까지 박지 X — TOKEN_REFRESHED / USER_UPDATED 등은 의도 X (단, idempotent 이라 사고는 X).
- `flushPendingConsents` 호출 위치 늘리지 X — auth-form 기존 호출 + ConsentFlusher 2곳이면 충분 (idempotent).

## 관련 commits / PRs

- `a4cc8436` fix(auth): Wave 800 — 카카오 OAuth 가입 시 telegram 알림 누락 fix
- PR #43

## Related Waves

- Wave 199 — `notifyAdminTelegram` 도입 (consents endpoint 안)
- Wave 743 — ReferralCapture layout 박음 (같은 패턴)
- Wave 746 — BalanceToast layout 박음 (같은 패턴)
- **Wave 800 (now)** — ConsentFlusher layout 박음
