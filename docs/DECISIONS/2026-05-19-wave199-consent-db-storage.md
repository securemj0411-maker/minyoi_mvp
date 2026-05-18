# Wave 199 (2026-05-19) 가입 동의 DB 저장 (consent 증빙 기록)

> **⚠️ 다른 세션 주의 — 이미 박힘. 중복 작업 금지**:
> - DB 테이블 **`mvp_user_consents`** 신설 — migration `wave199_user_consents_table` 적용. consent_type ENUM ('terms'/'privacy'/'age_14'/'marketing') + agreed_at + version + ip/UA. RLS 박힘 (anon block, owner select).
> - API **`/api/auth/consents`** POST — Authorization 헤더 인증 후 user_id 기반 insert. 필수 3 누락 시 400.
> - lib **`src/lib/pending-consents.ts`** — localStorage 임시 저장 helper. 1시간 만료. persistPendingConsents / readPendingConsents / clearPendingConsents / flushPendingConsents.
> - `auth-form.tsx` — 가입 시 `persistPendingConsents` 호출. 이메일 가입 즉시 session 있으면 `flushPendingConsents`.
> - `me-dashboard-client.tsx` — mount 시 dynamic import 로 flushPendingConsents (카카오 OAuth callback 경로 cover).
>
> **다시 박지 마세요** — 별 consent 시스템/테이블 신설 금지.

## 사용자 요구

> "마케팅 수신 동의 DB 저장 — 체크박스만 박고 저장 X = 무의미"

→ Wave 198 의 가입 동의 체크박스가 클라이언트 state 뿐. DB 저장 X = 법적 증빙 없음 + 마케팅 발송 대상 식별 불가.

## 변경

### 1. Migration `wave199_user_consents_table`

```sql
CREATE TABLE mvp_user_consents (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('terms', 'privacy', 'age_14', 'marketing')),
  agreed_at timestamptz NOT NULL DEFAULT now(),
  version text NOT NULL DEFAULT 'v1',
  ip_address text,
  user_agent text,
  source text NOT NULL DEFAULT 'signup',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mvp_user_consents_user_idx ON ... (user_id, consent_type);
CREATE INDEX mvp_user_consents_marketing_idx ON ... (user_id) WHERE consent_type = 'marketing';

ALTER TABLE mvp_user_consents ENABLE ROW LEVEL SECURITY;
-- anon_block (all deny) + owner_select (authenticated own row read)
-- service_role 만 INSERT 가능
```

### 2. `src/app/api/auth/consents/route.ts`

POST endpoint:
- `requireSupabaseUser` 인증
- 필수 3개 (terms/privacy/age_14) 검증
- IP + User-Agent 추출 (증빙)
- consent_type 별 row insert (마케팅 동의 시 추가 row)
- service_role_key 로 RLS 우회 insert

### 3. `src/lib/pending-consents.ts` (신규 helper)

- localStorage key `minyoi-pending-consents-v1`
- `persistPendingConsents` — 가입 시 저장
- `flushPendingConsents` — session 획득 후 API 호출 + clear
- 1시간 stale TTL (오래된 token 폐기)

### 4. `src/components/auth-form.tsx`

- import flushPendingConsents / persistPendingConsents
- signInWithKakao: redirect 전 persistPendingConsents
- handleEmailSubmit (signup): persistPendingConsents + session 있으면 즉시 flush

### 5. `src/components/me-dashboard-client.tsx`

- mount useEffect 에 dynamic import flushPendingConsents
- 카카오 OAuth callback 후 /me 진입 시점에 flush (server callback 은 access_token 직접 못 받음)

## 검증

```
npx tsc --noEmit --pretty false → 에러 0
```

### 시나리오

| 가입 경로 | 동의 저장 흐름 |
|---|---|
| 이메일 + autoConfirm | persist → signUp 성공 (session 즉시) → flush → DB insert |
| 이메일 + 이메일 인증 필요 | persist → 인증 링크 클릭 → /auth/callback → /me 진입 → flush |
| 카카오 OAuth | persist → kakao redirect → /auth/callback → /me 진입 → flush |

### 보안 trade-off

- localStorage = 클라이언트 변조 가능 → 베타 단계 수용. 추후 server-side signed token 강화 가능.
- consent_type 별 row → 약관 개정 시 history 보존 (재동의 row 추가 가능).
- IP / User-Agent → 분쟁 시 증빙. 개인정보 처리 위탁 신고 시 명시.

## Step 11 (회원 탈퇴 UI) — 이미 완료

진단 결과:
- Wave 106 에서 박힘 — `/me/account/delete` 페이지 존재
- `AccountPanel` ([app-nav.tsx:498](../../src/components/app-nav.tsx:498)) 의 사이드바/우상단 메뉴에 entry
- 사용자 "탈퇴" 텍스트 confirm + `/api/me/account/delete` API 호출
- `delete_user_account` RPC 실행 (soft delete 익명화 + hard delete 개인 식별 정보)

추가 작업 불필요.

## Step 12 (Wave 184/187/196 효과 측정) — 1~2일 후

지금 진행 X. 5/20 ~ 5/21 측정 권장:
- `mvp_raw_listings` fresh_28h % 추이 (목표 60%+)
- `mvp_market_price_daily` 의 niche SKU (i3 등) row 박힘 여부
- 사용자 frustration 재발 여부

## 미해결 (사용자 본인 진행 필요)

- 사업자등록증 / 통신판매업 신고 → footer + privacy / youth-policy 의 placeholder 교체
- 변호사 법률 자문 (실제 약관 검토)
- PG사 결정 후 privacy 의 결제 위탁 명시
- Vercel Pro / Supabase Pro 결정

## Lesson

1. **체크박스 박는 것만으론 부족** — DB 저장 + IP/UA 증빙 필수. 분쟁 시 동의 사실 입증 책임.
2. **localStorage 한계 인지** — 클라이언트 변조 가능. 베타 수용 가능하지만 추후 signed token 강화 권장.
3. **OAuth callback 경로** — server route 가 session 없으니 client mount 시점에 flush. me-dashboard-client 가 자연 entry point.
4. **consent_type 별 row** — 약관 개정 시 history 보존. version 컬럼으로 어느 약관 버전 동의했는지 추적.
