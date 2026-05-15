# 2026-05-16 — MarketHistoryChart lazy mode (admin pool rate limit fix)

## 발견

- 사용자: "운영자 풀에 왜 잠시 후 다시 시도해주세요 뭔말임?"
- 진단:
  - `/api/market/history` rate limit = **30 req / 60 sec / IP** (`route.ts:31`)
  - admin-pool-browser 한 페이지 매물 10~30개 → 각 카드 `MarketHistoryChart` auto fetch → **30+ 호출 즉시 → rate limit 초과** → 모든 chart "잠시 후 다시 시도..." 표시
  - rate limit 정책 자체는 Vercel app 안 코드 (`src/lib/rate-limit.ts`). 슈파베이스/버셀/번개장터 외부 X.
  - 사용자: "시세는 시세보기 버튼 눌러야 나오게 해라. 그전에 다 가져오는건 너무 비효율"

## 변경

- `src/components/market-history-chart.tsx`:
  - `lazy?: boolean` prop 추가 (default false)
  - `opened` state — `lazy && !opened` 면 "📊 시세 30일 추이 보기" 버튼만 표시 (fetch 0)
  - 버튼 클릭 시 `setOpened(true)` → fetch 시작
  - `useEffect` 의존성에 `opened` 추가 — 처음 lazy mode 면 fetch 안 함
- `src/components/admin-pool-browser.tsx:311` — `<MarketHistoryChart ... lazy />` 박음
- `pack-reveal-modal.tsx` (사용자 reveal modal) = lazy 안 박음 — 1 매물씩이라 자동 로드 OK

## 검증

- `npm run test:core` 172/172 pass.
- 운영자 풀 첫 paint = chart 자리에 버튼만 (rate limit 안 걸림)
- 사용자 클릭 시 그 chart 만 fetch
- 한 페이지 30개 매물 = 사용자가 본 chart 만 호출 (보통 1~3개)

## 위험

- 사용자가 chart 자동 로드 기대했으면 추가 클릭 = 약간 friction. 단 운영자 풀 use case = 매물 검증 (시세 chart 필요한 매물만 클릭) — 정상 UX.

## 다른 fetch 컴포넌트 (이미 lazy)

- `MarketSourceDebug` = `open` toggle, `fetchData` 클릭 시만 호출 ✅ (이미 lazy)
