# Wave 799 — URL 시세 조회 기능 (/lookup)

- 시간: 2026-05-30 KST
- 트리거: owner — "회원이 링크 넣으면 우리 데이터 가지고 시세/매입가/예상수익/비교매물/시세그래프 보여주는거 바로 작업".

## 변경

### 신규 파일

1. **`/api/lookup/by-url/route.ts`** — POST API
   - 입력: `{ url: string }`
   - URL parsing: 번장 (`bunjang.co.kr/products/{pid}`) / 중나 (`joongna.com/product/{id}`) / 당근 (`daangn.com/.../buy-sell|articles/{slug}`)
   - DB query: `mvp_raw_listings` url ILIKE 검색
   - marketBasis 계산: 기존 `marketBasisForCandidate` 재사용
   - 예상 수익: `expectedProfitFromMarketPrice` 재사용
   - 비교 매물: 같은 comparable_key + condition_class, top 12
   - 시세 그래프: `mvp_market_price_daily` 14일 추이
   - Rate limit: 분당 10회 / 사용자

2. **`/lookup/page.tsx`** — server component
3. **`/lookup/lookup-client.tsx`** — UI
   - URL 입력 → 조회하기 버튼
   - 결과 표시:
     - 매물 정보 (썸네일/제목/source/region/원문 링크)
     - 숫자 요약 (매입가 / 중고 시세 / 예상 수익)
     - 14일 시세 SVG 그래프
     - 비교 매물 12개 카드
     - 표본 < 3 이면 신뢰도 경고

### 에러 처리

- `bad_body` (400): JSON parse 실패
- `no_url` (400): URL 없음
- `unsupported_url` (400): 지원 안 하는 URL
- `not_found` (404): DB 에 매물 없음 ("새 매물이거나 풀에 안 들어온 매물")
- `parse_pending` (202): 매물 있지만 comparable_key 미박힘 ("1~2시간 뒤 다시")
- `rate_limit` (429): 분당 10회 초과

## scope (MVP)

- ✅ DB 안 매물만 조회 (live fetch X)
- ✅ 번장/중나/당근 다 지원
- ✅ 무료 (rate limit 박음, 분당 10회)
- ✅ 로그인 필요
- ❌ paywall 안 함 (추후 검토)
- ❌ 매물 분석 (1크레딧) 과는 별개 — 시세 조회는 무료

## 사용 흐름

1. `/lookup` 페이지 진입
2. URL 붙여넣기 (번장/중나/당근)
3. 조회하기 클릭
4. 결과 확인 (시세 / 예상 수익 / 14일 그래프 / 비교 매물 12개)

## Follow-up

- **App nav 에 "시세 조회" 메뉴 추가** — 사용자가 접근 가능하게
- **live fetch 옵션** — DB 에 없는 매물도 조회 가능하게 (실시간 detail API 호출, 별도 wave + paywall 검토)
- **URL 입력 자동 감지** — 클립보드 URL 자동 detect, "조회할까요?" UX
- **공유 기능** — 조회 결과 URL share (다른 사람에게 보여주기)
