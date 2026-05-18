# Wave 197 (2026-05-18) 베타 런칭 audit + debug route prod 차단

> **⚠️ 다른 세션 주의 — 이미 박힘. 중복 작업 금지**:
> - `src/lib/debug-admin.ts` 에 `isDebugBlocked()` helper + NODE_ENV 가드 박힘
> - debug 라우트는 prod 에서 404. env `ALLOW_DEBUG_IN_PRODUCTION=1` 우회 가능

## 사용자 요구

> "MVP 베타 할건데 사업자 등록 하고 PG연결해야지? 아니면 그전에 너가 내 사이트 한번 더 둘러보고 심각한 문제나 등등 문제점을 찾아줄수있겠니?"

## Audit 결과 (Explore agent)

### ✅ 안전한 영역
- Admin 인증: URL obfuscation + `isAdminUser` 이중 가드
- Supabase RLS: 사용자 데이터 테이블 모두 row-level security, anon block
- 결제/credit: race condition 차단 (`claim_mvp_user_credits` RPC atomicity), audit ledger (`mvp_credit_ledger`), idempotency (welcome grant)
- Backup: `/api/cron/daily-backup` 매일 19:00 KST, 30일 보관
- UX: 한국어 에러 normalize, 모바일 responsive, friendly copy
- Cron schedule: vercel.json + maxDuration 합리

### ⚠️ HIGH 우선순위 (베타 전 필수)

#### 1. 사업자 정보 mock 값 (사용자 본인 진행)
- `src/components/app-footer.tsx` ln 26-32: 테스트 값 (사업자번호 123-45-67890, 대표 이민제 등)
- `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`: "MVP 검토용 mock 정책" 명시
- **베타 전 필수**: 실제 사업자등록증 받고 통신판매업 신고번호 박은 후 교체

#### 2. Debug 라우트 prod 차단 ✅ (본 wave 박음)
- 기존 가드: requireSupabaseUser + isAdminUser (admin 만 통과)
- 보강: NODE_ENV=production 시 추가 차단 (defense in depth, admin 계정 탈취 시 보호)
- 우회 env: `ALLOW_DEBUG_IN_PRODUCTION=1` (운영자 긴급 debug 시)

#### 3. `.env.local` 노출 ❌ (Agent 오진단)
- Agent 가 working tree file 보고 git committed 추정 — **사실 X**
- `.gitignore` 에 `.env*` 박혀있음 (line 1)
- `git log --all -- .env.local` 결과 0 (history 에 없음)
- tracked file 은 `.env.local.example` (template, secret 없음)
- → **secret 안전. 재생성 불필요.**

### 🟡 MEDIUM 우선순위 (1주일 내)

| Issue | 권장 |
|---|---|
| PITR 부재 (Supabase Free) | Supabase Pro 업그레이드 + PITR 활성화 (또는 backup 주기 24h → 6h 단축) |
| Vercel Pro 요금제 확인 | 현재 cron maxDuration 90s 사용 — hobby 60s 한도 초과. Pro 필수 |

### 🟢 LOW (양호)
- 결제/credit 무결성
- UX 친화 (한국어 / 모바일 / 안내)
- Cron schedule 합리

## 변경 (Wave 197)

`src/lib/debug-admin.ts`:
- `isDebugBlocked()` helper 추가 — `NODE_ENV === "production" && ALLOW_DEBUG_IN_PRODUCTION !== "1"` 시 true
- `requireDebugAdmin` + `requireDebugAdminFromCookies` 양쪽에 prod 가드 박음
- 차단 시 status 404 (debug route 존재 자체 숨김)

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 에러 0
```

### 시나리오
| 환경 | 결과 |
|---|---|
| dev (NODE_ENV != production) | 기존 admin 가드만 통과 |
| prod (NODE_ENV = production) | **404 차단** (admin 도 접근 X) |
| prod + ALLOW_DEBUG_IN_PRODUCTION=1 | 기존 admin 가드 통과 (긴급 debug 우회) |

## 사용자 행동 필요 — 베타 런칭 전 체크리스트

| # | 항목 | 담당 |
|---|---|---|
| 1 | 사업자등록증 발급 (홈택스) | 사용자 |
| 2 | 통신판매업 신고 (구청) | 사용자 |
| 3 | 위 정보로 `app-footer.tsx` + `terms/page.tsx` + `privacy/page.tsx` mock 값 교체 | 사용자 또는 별 wave |
| 4 | PG 사 가입 (KG이니시스/토스페이먼츠) — 사업자번호 필요 | 사용자 |
| 5 | PG 연동 코드 박기 | 별 wave |
| 6 | Vercel Pro 요금제 확인 | 사용자 |
| 7 | (선택) Supabase Pro + PITR | 사용자 |
| 8 | prod 배포 후 debug route 404 검증 | 자동 |

## Lesson

1. **agent audit 결과 검증 필수** — `.env.local` 오진단 case. agent 가 working tree file 보고 git history 추정. 사실 확인 (`.gitignore` + `git log`) 필수.
2. **defense in depth** — admin 가드 단일 layer 보단 NODE_ENV 추가 가드. admin 계정 탈취 시에도 prod debug 차단.
3. **mock 값 위험** — terms/privacy 페이지 mock 그대로 배포하면 법적 risk + 사용자 신뢰 손상. 베타 전 실제 사업자 정보 교체 필수.
