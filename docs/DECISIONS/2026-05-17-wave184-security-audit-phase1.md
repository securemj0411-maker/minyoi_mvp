# Wave 184 — 보안 audit phase 1 (안전 fix)

## 컨텍스트

메모리 노트 우선순위:
> "API 에러 응답에 DB schema/파일경로/사이트 구조 누출 가능성. 별도 wave audit 권장."

Supabase advisor 보안 항목 전수 점검 후 **안전한 것만** 이번 wave 박음. Risk 큰 작업은 별도 task 위임.

## advisor 진단 결과 분류

| 레벨 | 항목 | 수 | 처리 |
|---|---|---|---|
| 🚨 ERROR | Security Definer View | 2 | **별도 task** (사용처 검토 필요) |
| ⚠️ WARN | anon SECURITY DEFINER 함수 호출 | ~13 | **별도 task** (코드 영향 검토 필요) |
| ⚠️ WARN | function search_path mutable | 2 | ✅ **이번 wave 박음** |
| ⚠️ WARN | Leaked password protection | 1 | **Supabase 콘솔 토글** (코드 X) |
| ℹ️ INFO | RLS no policy | 33 | 보류 (service_role 만 사용 — 우회 risk 없음) |

## 박은 것 (이번 wave)

### 1. error-response.ts utility (`src/lib/error-response.ts`)

API 에러 응답 sanitize 표준화.
- `errorResponse(code, options)` — stable error code + 한국어 user message
- `logAndRespond(prefix, err, code, options)` — 로그 + sanitized response
- `err.message` 를 response body 에 박지 않음 → DB schema / internal path leak 차단

### 2. public/safety-stats sanitize

이전:
```ts
catch (err) {
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "fetch failed" },
    { status: 500 },
  );
}
```
→
```ts
catch (err) {
  console.error("[public/safety-stats] failed", { err: ... });
  return NextResponse.json(
    { error: "safety_stats_failed", message: "안전 지표를 불러오지 못했어요. ..." },
    { status: 500 },
  );
}
```

`/api/public/safety-stats` 는 public endpoint — leak 영향 가장 큼.

### 3. SQL 마이그레이션 (`wave184_security_function_search_path_set`)

```sql
ALTER FUNCTION public.mvp_category_from_comparable_key
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_fraud_group_hashes
  SET search_path = public, pg_catalog;
```

검증: advisor 재실행 → `function_search_path_mutable` WARN 2개 → 0개.

## 별도 task 위임 (Wave 185 후속)

ccd_session.spawn_task 로 별도 worktree 위임됨:
- ERROR 2개: SECURITY DEFINER 뷰 → SECURITY INVOKER 변경
- WARN 13개: SECURITY DEFINER 함수 REVOKE EXECUTE FROM anon/authenticated
- 검토 필요: `reserve_mvp_pool_candidates` 는 `callSupabase` + `authHeaders()` (anon/user JWT) 호출 → 단순 REVOKE 시 깨짐. 코드 측 service_role 전환 후 REVOKE.

## 사용자 결정 필요

### PITR (Point-In-Time Recovery)

메모리 노트 우선순위:
> "PITR 미박힘 → 시점 복원 불가. 시세 historical 한 번 잃으면 못 돌림."

Supabase PITR cost (2026-05-17 기준 참고):
- Pro plan + PITR add-on: $99/월 ~ ($25 base × add-on usage)
- Plan upgrade 결정 필요

선택지:
- **A. PITR 활성화** — 시세 historical 보호. 월 cost ↑.
- **B. 일일 backup 수동 운영** — Supabase Pro 자동 백업 (7일) + 추가 export. cost ↓.
- **C. 현 상태 유지** — risk 인지하고 미박힘. 시세 historical 잃을 risk.

### Leaked Password Protection

Supabase 콘솔 → Auth → Settings → Password Settings → Leaked Password Protection 토글.
코드 작업 X, 비용 X. 활성화 권장.

## 보안 INFO 보류 (33개)

`rls_enabled_no_policy` 33개 테이블 — RLS 켜져있고 정책 없음.
- 미뇨이 코드는 service_role 만 사용 (`serviceHeaders()` in `src/lib/supabase-rest.ts`)
- anon/authenticated 가 직접 DB 접근 X → RLS 정책 없어도 access 차단됨
- "INFO" 레벨 — Supabase 권장이지만 시급 X. 별도 wave 에서 정책 박는 게 정석.

## Test

- DB 마이그레이션: ALTER FUNCTION SET search_path — 함수 동작 영향 없음.
- 코드: `npm run test:core` → 328/328 pass (기존과 동일).
- advisor 재실행: search_path mutable WARN 2개 사라짐 확인.

## Follow-up

- 별도 task: SECURITY DEFINER 뷰 + REVOKE EXECUTE
- 사용자 결정: PITR 활성화 / Leaked Password Protection 토글
- 나머지 cron 라우트 err.message 노출 — 별도 wave (admin/internal 호출이라 시급 X)
- RLS 정책 33개 테이블 — 별도 wave (정책 설계 필요)

## Linked

- `2026-05-17-master-plan-deferred-items.md`
- `2026-05-17-l4-risk-score-chip.md`
- `2026-05-17-wave182-saved-money-counter-loss-report.md`
- `2026-05-17-wave182c-inaccurate-report-instead-of-loss-report.md`
- `2026-05-17-wave183-liquidity-curve-mini.md`
