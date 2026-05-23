# launch-115 — 비로그인 메인 SSR + UI 정정 + sold pool 14d 확대

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: PreviewMaskedDashboard 서버 컴포넌트로 변환 + 사용자 frustration 4건 정리

## 배경 (사용자 정정 4건 + 추가 1건)

1. "거래 완료" 라벨 + fine print 빨간색 → 더러움. zinc 톤 원함.
2. 사진 "거래 완료" overlay 배지 + grayscale → 원치 않음. 기존처럼.
3. fine print 한 줄만 카드 아래.
4. "프론트에서 랜더링 말고 그냥 서버에서 만들어서 가져올 수 있는 거 아님? 왜 굳이 CSR? 링크 누르고 들어왔을 때 진짜 별로다."
5. "왜 5개가 아니라 3개만 나오는 거?" — sold 풀 부족.

## 변경

### 1. UI 정정 (1+2+3)
- 헤더 라벨 "최근 거래된 실제 매물" (rose) → 제거.
- 카드 위 fine print (rose-600) → **카드 아래 한 줄** (`text-zinc-400 text-[10px]`).
- 사진 "거래 완료" 배지 + `grayscale opacity-90` → **사진 그대로** 노출.

### 2. SSR 변환 (4)
신규 파일 `src/components/preview-masked-dashboard-server.tsx`:
- async server component
- server 가 `fetch("${origin}/api/preview-pool", { next: { revalidate: 60 } })` → HTML 박아 응답
- 첫 paint 즉시 + 깜빡임 0 + SEO 강함

`src/app/page.tsx`:
- 비로그인 분기에서 `MeDashboardClient` 건너뛰고 `<PreviewMaskedDashboardServer />` 직접 마운트
- 클라이언트 hydration 비용 0
- sr-only SEO header (launch-114) 그대로 유지

### 3. sold pool 14d (5)
`src/app/api/preview-pool/route.ts`:
- `sinceIso`: 7일 → **14일**
- `mvp_raw_listings` scan limit: 300 → **500**
- tier dedup 5겹 거쳐도 5개 채워질 가능성 ↑

기존 `PreviewMaskedDashboard` (client) 는 그대로 보존 (legacy, 다른 데서 쓸 가능성).

## 영향

- 비로그인 메인 클릭 → 즉시 5개 카드 + 사진 + 가격/차익 다 노출 (깜빡임 0).
- SEO: server HTML 에 매물명/가격/시세 다 박힘 — 구글 크롤러 친화.
- 모바일 LCP (Largest Contentful Paint) 개선 — 카드 사진이 첫 paint 안에.
- "리액트로 할 거만 리액트로 + 나머지 SSR" 원칙 적용 (사용자 SEO 질문 답).

## 후속

- AppNav / AppFooter 가 client 라 page 의 server-rendered SEO 효과 부분적. 별 wave 에서 root layout 의 client island 격리 검토 권장.
- /how-it-works, /plans 도 동일 SSR 패턴 적용 가능.
