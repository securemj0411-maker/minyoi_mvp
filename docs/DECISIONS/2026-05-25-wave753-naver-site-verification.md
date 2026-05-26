# Wave 753 — 네이버 서치어드바이저 사이트 소유 확인

- 시간: 2026-05-25 KST
- 트리거: 사용자 — "네이버는 그냥 가만히 있으면 안올라갈거같은데". 네이버는 구글과 달리 명시적 등록 + 소유 확인 필요.

## 변경

### `src/app/layout.tsx`
Next.js 16 `Metadata` API 의 `verification.other` 사용:
```ts
verification: {
  other: {
    "naver-site-verification": "211bd1e7421b7bd4930d132d2d88c80c4b73481b",
  },
}
```
→ `<head>` 에 `<meta name="naver-site-verification" content="..." />` 자동 박힘.

### 기존 인프라 확인 (변경 X — 이미 충분)
- `src/app/robots.ts` 존재 ✅ (public 페이지 allow / api·me·admin 차단 + sitemap link)
- `src/app/sitemap.ts` 존재 ✅ (`/`, `/how-it-works`, `/plans`, `/login`, `/privacy`, `/terms`, `/refund-policy`, `/youth-policy` 8개 URL)

## 사용자 next steps

1. **Vercel 배포 확인**: push 후 https://minyoi-mvp.vercel.app/ 페이지 소스에 `<meta name="naver-site-verification" content="211bd1e7..." />` 박혀있는지 확인.
2. **네이버 서치어드바이저로 돌아가서 "소유확인" 클릭** → 확인 완료.
3. **사이트맵 제출**: 서치어드바이저 → 요청 → "사이트맵 제출" → `sitemap.xml` 입력 → 확인.
4. **URL 직접 수집 요청**: 주요 페이지 (/, /how-it-works, /plans) 각각 "웹페이지 수집" 으로 즉시 크롤 요청.

## 검증
- `npx tsc --noEmit` 0 에러
- Vercel 배포 후 view-source 로 meta tag 박혔는지 확인 필요

## 위험
- 0. 메타 1줄 추가, 다른 영향 없음.

## 다음 (선택)
- 네이버 블로그 운영 (백링크 확보) — C-rank 알고리즘 가중치 큼.
- sitemap 에 동적 매물 페이지 추가 — 현재는 정적 8개만. 매물별 URL 있다면 추가.
