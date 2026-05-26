# Wave 770 — Naver SEO 정상화 점검 + sitemap 일관성 fix

- 시간: 2026-05-27 KST
- 트리거: Wave 753-754 후 며칠 지났고 사용자가 며칠 전 "사이트맵 가져올 수 없음" 보고 → 현 상태 점검.

## 점검 결과 — 사이트 측 인프라 100% 정상

### Production endpoint 측정 (Naver Yeti UA 포함)
```bash
curl -A "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)" \
     "https://minyoi-mvp.vercel.app/sitemap.xml"
→ HTTP/2 200, content-type: application/xml, valid XML 응답

curl -A "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)" \
     "https://minyoi-mvp.vercel.app/robots.txt"
→ HTTP 200, 정상 Allow/Disallow + Sitemap link
```

### Root HTML
```html
<meta name="naver-site-verification" content="211bd1e7421b7bd4930d132d2d88c80c4b73481b"/>
<meta property="og:title" content="득템잡이 — 중고 매물 시세 비교 — AI가 알려주는 알뜰 득템 정보"/>
<meta property="og:description" content="AI가 매일 분석한 중고 매물 시세 비교..."/>
<meta property="og:image" content="...opengraph-image..."/>
... (Twitter, locale, icon 다 박혀있음)
```

### 결론
- 사이트 측 SEO 인프라 (verification meta, sitemap.xml, robots.txt, OG/Twitter 메타, JSON-LD) **완벽**.
- Naver Yeti crawler가 정상 접근 가능.

## "사이트맵 가져올 수 없음" 원인 추정

사이트 측 X. 사용자 측 액션 또는 Naver 측 지연:

1. **소유확인 미완료 상태에서 sitemap 제출** — 네이버는 소유확인 안 된 사이트의 sitemap을 거부.
2. **Naver 측 처리 지연** — 일반적으로 1-7일 소요. C-rank 알고리즘 backlog.
3. **소유확인은 성공했지만 sitemap을 등록 안 함** — 별도 단계.

## 변경

### `src/app/sitemap.ts`
- **`/signup` 추가** (priority 0.5, monthly) — robots.txt allow엔 있지만 sitemap엔 빠져있던 일관성 fix.
- 결과: 정적 페이지 8 → 9개.

## 사용자 액션 (네이버 서치어드바이저)

순서대로 확인:
1. **네이버 서치어드바이저 → 사이트 관리** → `minyoi-mvp.vercel.app`이 등록돼있고 **소유확인 상태가 "확인됨"**인지.
   - 안 됨이면: "소유확인" 클릭 → 사이트에 meta 박혀있으므로 즉시 통과.
2. **요청 → 사이트맵 제출** → `sitemap.xml` 입력 → 확인.
   - 이미 제출했는데 "가져올 수 없음" 이면: 1주일 지난 후 재제출.
3. **요청 → 웹페이지 수집** → 주요 URL 직접 크롤 요청 (`/`, `/how-it-works`, `/plans`).
   - C-rank 가속 효과.

## 검증
- `npx tsc --noEmit` 0 에러 (sitemap.ts 단일 변경).
- production sitemap.xml HTTP 200 확인.

## 위험
- 0. /signup URL 1개 추가, 다른 영향 없음.

## 다음 (선택, code 변경 X)
- 네이버 블로그 운영 (백링크 확보) — C-rank 알고리즘 가중치 큼. 운영 작업.
- sitemap에 동적 매물 페이지 추가는 어려움 (현재 사이트 구조상 매물별 individual URL 없음, /explore 1개 page에 매물 list).
- JSON-LD 추가 type — 현재 Wave 114에서 Organization/WebSite 박힘. Product type 추가 가능하지만 매물 list 동적이라 복잡.
