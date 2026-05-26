# Wave 763b — RLS off 두 테이블 보안 fix

- 시간: 2026-05-27 KST
- 트리거: Wave 763 audit 부수 발견 — Supabase advisor alert: `mvp_user_feedback` + `mvp_cron_executions` 테이블 RLS off.

## 발견

```sql
SELECT relname, relrowsecurity FROM pg_class JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE nspname='public' AND relname IN ('mvp_user_feedback','mvp_cron_executions');
-- mvp_cron_executions: rls_enabled=false (1,572 rows)
-- mvp_user_feedback:   rls_enabled=false (auth_user_id, message, reward 등 PII 포함)
```

**위험도:**
- `mvp_user_feedback` 🔴 **HIGH** — `auth_user_id` (uuid) / `user_ref` (text) / `message` (text) / `reward_amount` 등 사용자 PII 포함. RLS off 면 anon/authenticated 키로 누구나 SELECT 가능.
- `mvp_cron_executions` 🟡 **MEDIUM** — 운영 로그 (mode/owner/duration/status). 사용자 PII 없지만 시스템 내부 정보 노출 risk.

## 변경

### 코드 점검 결과 — 양 테이블 모두 server-side service_role 키 사용

```
mvp_user_feedback:
  /api/admin/feedback/decide/route.ts  (server)
  /api/admin/feedback/list/route.ts    (server)
  /api/feedback/submit/route.ts        (server)

mvp_cron_executions:
  src/lib/cron-guard.ts                (server cron)
```

모든 호출이 `restFetch(..., { headers: serviceHeaders() })` 패턴 — `SUPABASE_SERVICE_ROLE_KEY` 사용. RLS bypass.

→ RLS enable 해도 백엔드 영향 없음 (service_role 은 RLS bypass).
→ anon/authenticated 키 (client-side) 차단됨 (no policy = deny all).

### SQL

```sql
ALTER TABLE public.mvp_cron_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mvp_user_feedback ENABLE ROW LEVEL SECURITY;
```

정책 추가 안 함 — service_role 만 통과시키는 게 의도. 사용자가 직접 client-side 에서 접근할 path 없음 (모두 server route 거침).

## 검증

```sql
SELECT c.relname, c.relrowsecurity FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('mvp_user_feedback','mvp_cron_executions');
-- 결과: rls_enabled=true (둘 다)
```

## Reversibility

만약 백엔드 break 가 발견되면:
```sql
ALTER TABLE public.mvp_cron_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mvp_user_feedback DISABLE ROW LEVEL SECURITY;
```

근데 break 가능성 거의 없음 — 미뇨이는 모든 DB 접근이 server-side service_role 통과.

## Follow-up

- 다음 Supabase advisor run 에서 RLS alert 해소 확인.
- 만약 client-side 에서 직접 접근하는 case 발견되면 RLS policy 추가 (e.g. `auth.uid() = auth_user_id` for own row access).
- 다른 테이블 RLS 점검 sweep — `mvp_user_credits` / `mvp_referral_codes` / 등 PII 테이블 RLS 상태 확인 별도 wave 권장.
