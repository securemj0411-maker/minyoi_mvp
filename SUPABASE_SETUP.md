# Supabase MVP 연결 절차

## 0. 먼저 키 교체

채팅에 노출된 `service_role` 키는 폐기 대상으로 봅니다.

Supabase Dashboard에서 새 `service_role` 키를 발급/rotate 한 뒤 아래에만 넣습니다.
절대 `NEXT_PUBLIC_` 이름으로 저장하지 않습니다.

## 1. 스키마 생성

Supabase Dashboard → SQL Editor에서 아래 파일 내용을 실행합니다.

```text
mvp/supabase/schema.sql
```

생성되는 객체:

| 이름 | 역할 |
|---|---|
| `mvp_listings` | 번개장터 후보 매물 기본 정보 |
| `mvp_listing_analysis` | 리셀갭 점수, 관심도, 안전도, 검토 플래그 |
| `mvp_user_candidate_actions` | 이후 관심/보류/숨김을 DB로 옮길 때 쓸 테이블 |
| `mvp_listing_candidates` | Next 서버가 읽는 후보 view |

RLS는 켜져 있고, 현재는 Next 서버가 `service_role`로 읽는 구조입니다.

## 2. 로컬 env 생성

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp
cp .env.local.example .env.local
```

`.env.local`에서 `SUPABASE_SERVICE_ROLE_KEY`만 새 키로 바꿉니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://suwsvvjsycgcegepcktp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=새로_발급한_service_role_key
USE_LOCAL_POC_DATA=false
```

## 3. PoC 후보 10건 seed

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp
npm run seed:supabase
```

성공하면 다음처럼 나옵니다.

```text
Seed complete: 10 listings, 10 analyses
```

## 4. 앱 확인

```bash
npm run dev
```

이제 `src/lib/candidates.ts`는 환경변수가 있으면 Supabase에서 후보를 읽고,
환경변수가 없거나 `USE_LOCAL_POC_DATA=true`이면 기존 PoC JSON을 읽습니다.

## 5. Vercel 배포 env

Vercel Project Settings → Environment Variables에 추가합니다.

| key | value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://suwsvvjsycgcegepcktp.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | 새로 발급한 service role key |
| `USE_LOCAL_POC_DATA` | `false` |

주의: `SUPABASE_SERVICE_ROLE_KEY`는 절대 브라우저에서 쓰면 안 됩니다.
