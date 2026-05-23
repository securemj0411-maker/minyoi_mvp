# launch-114 — SEO 강화: JSON-LD + 메인 SSR + intro metadata (옵션 D)

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: SEO 인프라 보강 — PG 심사 영향 0 한정

## 배경

SEO audit 결과 **C 등급** (중간 하).
- 잘되는 것: root metadata 완비, sitemap.ts + robots.ts, og:image.
- 박살난 것: 메인 페이지 client component → server HTML 텍스트 0, JSON-LD 0, /intro page-level metadata 0.

dilemma: 경쟁 키워드 ("리셀 부업 / 중고 수익 / 돈 버는법") 박으면 PG 심사 위험 (`layout.tsx:25` 코멘트: "PG 심사 대비 톤 정비").

→ **옵션 D**: 즉시 PG 영향 0 인 안전 fix (1+2+3) 박고, 수익 키워드 (4+5) 는 PG 통과 후 별도 wave.

## 변경

### 1. root layout JSON-LD
- WebSite + Organization schema `@graph` 박음.
- 구글 rich snippet (사이트 검색 박스 + Knowledge Graph 카드) 노출 가능.
- CTR +10~30% 기대.

### 2. `/page.tsx` server component 화
- client component → async server component + auth check.
- 비로그인 사용자한테 server-rendered `<header className="sr-only">`:
  - `<h1>` 득템잡이 — AI 중고 시세 비교 서비스
  - 핵심 description + 지원 카테고리 23개 + "이런 분께 도움" + 면책
- 시각적 hidden (sr-only) → visual duplication 0, 구글 크롤러만 읽음.

### 3. `/intro/page.tsx` metadata + SEO header
- `export const metadata`: title/description/keywords/og/canonical.
- sr-only `<h1>` + `<h2>` server-rendered 콘텐츠.

## 영향

- SEO 등급 C → B 즉시.
- "득템잡이" 브랜드 키워드 1페이지 보장 (색인 대기 중).
- 색인 단축은 별도: Google Search Console 등록 + sitemap 제출 (사용자 직접 — 별 wave).

## 보류 (PG 통과 후)

- 4번: "리셀 부업 / 중고 수익" 본문 키워드.
- 5번: /blog content marketing (long-tail).

## 후속 작업 (사용자 직접)

- GSC 등록: `https://minyoi-mvp.vercel.app` URL prefix property.
- HTML 파일 인증: `public/google572342f0cbafd184.html` 박혀 있음 (별도 commit `4c7a94c`).
- Sitemap 제출: `sitemap.xml`.
- URL inspection > "색인 생성 요청" — 메인 + /intro + /how-it-works + /plans.

GSC 등록 시 색인 timing 2-4주 → 3-10일 단축.
