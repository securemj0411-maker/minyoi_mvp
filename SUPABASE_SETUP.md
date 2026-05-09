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
| `mvp_listing_ai_classifications` | 상위권 애매 후보의 AI 분류 캐시 |
| `mvp_collect_runs` | 크론 수집 실행 로그와 AI 사용량 요약 |
| `mvp_listing_candidates` | Next 서버가 읽는 후보 view |

RLS는 켜져 있고, 현재는 Next 서버가 `service_role`로 읽는 구조입니다.

## 2. 로컬 env 생성

```bash
cd /Users/iminje/Documents/Claude/Projects/미뇨이/mvp
cp .env.local.example .env.local
```

`.env.local`에서 `SUPABASE_SERVICE_ROLE_KEY`만 새 키로 바꿉니다.
AI 검토를 켜려면 `OPENAI_API_KEY`도 넣습니다. 없으면 수집은 계속 돌고,
상위권 애매 후보에 `ai_review_unavailable` 플래그만 붙습니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://suwsvvjsycgcegepcktp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=새로_발급한_service_role_key
OPENAI_API_KEY=OpenAI_API_KEY
OPENAI_CLASSIFIER_MODEL=gpt-4.1-mini
AI_REVIEW_TOP_N=30
AI_REVIEW_CONCURRENCY=5
DETAIL_ENRICH_LIMIT=120
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
| `OPENAI_API_KEY` | OpenAI API key. 상위권 애매 후보 AI 분류용 |
| `OPENAI_CLASSIFIER_MODEL` | `gpt-4.1-mini` |
| `AI_REVIEW_TOP_N` | `30` |
| `AI_REVIEW_CONCURRENCY` | `5` |
| `DETAIL_ENRICH_LIMIT` | `120` |
| `USE_LOCAL_POC_DATA` | `false` |

주의: `SUPABASE_SERVICE_ROLE_KEY`는 절대 브라우저에서 쓰면 안 됩니다.

## 6. AI 검토 정책

AI는 모든 매물에 쓰지 않습니다. 수집 파이프라인에서 룰 필터를 통과한 후보 중
점수가 높은 상위 `AI_REVIEW_TOP_N`개만 보고, 그 안에서도 아래 조건에 걸린 매물만
검토합니다.

| 조건 | 이유 |
|---|---|
| `deep_discount_review` | 가격이 너무 싸면 짭/부품/저격글일 확률이 큼 |
| `short_title`, `weak_normal_signal` | 정상 본품 신호가 약함 |
| `suspicious_model_review` | 출시/모델명이 이상한 표현 |

AI가 `counterfeit`, `parts`, `buying`, `callout`, `damaged`, `accessory`, `multi`를
`high` 또는 `medium` confidence로 반환하면 후보에서 제외합니다. 같은 `pid`와
내용 해시는 `mvp_listing_ai_classifications`에 캐시되어 다음 5분 수집 때 다시
비용을 쓰지 않습니다.

Vercel 함수 시간 제한을 피하기 위해 상세 enrich는 기본 `DETAIL_ENRICH_LIMIT=120`건까지만
진행하고, AI 검토는 `AI_REVIEW_CONCURRENCY=5`로 병렬 제한합니다.

## 7. 운영 로그 확인

수집 엔드포인트 `/api/cron/collect`는 시작 시 `mvp_collect_runs`에 `running`
상태를 만들고, 백그라운드 수집이 끝나면 `succeeded` 또는 `failed`로 업데이트합니다.

브라우저에서 아래 페이지를 열면 최근 실행을 사람이 읽기 쉬운 형태로 볼 수 있습니다.

```text
/debug
```

확인 가능한 항목:

| 항목 | 의미 |
|---|---|
| 검색 수집 | 번개장터 검색 API에서 중복 제거 후 잡힌 매물 수 |
| 제목 룰 통과 | 제목만으로 정상 후보가 될 수 있다고 본 매물 수 |
| 상세 enrich | 상세 API까지 성공한 매물 수 |
| AI 검토 대상 | 상위권 후보 중 검토 플래그가 있어 AI로 보낸 수 |
| 실제 API 호출 | 캐시 없이 OpenAI API를 실제 호출한 수 |
| 캐시 | 이전 AI 판정 재사용 수 |
| AI 제외 | AI가 짭/부품/구매글/손상 등으로 판단해 후보에서 뺀 수 |
