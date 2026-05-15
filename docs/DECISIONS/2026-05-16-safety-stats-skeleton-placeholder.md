# 2026-05-16 — safety-stats marquee + badge skeleton placeholder

## 발견

- 사용자: "이거 메인페이지 프론트에서 없었다가 갑자기 딱 뜨니까 이상함 스켈레톤? 처럼 일단은 13,007 이런 숫자만 빼고는 그냥 일단 서버사이드로 박아놔야되지 않을까..??"
- 진단:
  - `SafetyStatsMarquee` (메인 페이지 nav 아래 marquee) — `useEffect` fetch + `if (!stats || total === 0) return null` → 데이터 로드 전 nothing → fetch 후 갑자기 등장 = jarring
  - `SafetyStatsBadge` (`/me` dashboard 카드) — 동일 패턴

## 변경

- `src/components/safety-stats-marquee.tsx`:
  - `if (!stats) return null` → skeleton placeholder (frame + animated pulse 박스)
  - `if (total === 0) return null` 만 별도 (데이터 0 시 hide)
- `src/components/safety-stats-badge.tsx`:
  - 동일 패턴 — skeleton 카드 (frame + pulse placeholder)

## 검증

- `npm run test:core` 172/172 pass.
- 첫 paint = frame + 회색 pulse 박스 보임. fetch 후 진짜 숫자 fade-in. jarring 차단.

## 다른 컴포넌트 sweep 결과 (추가 fix 불필요)

| component | 상태 |
|---|---|
| `hotdeal-reservations.tsx` | "활성 reservation 확인 중…" placeholder ✅ |
| `telegram-connect-panel.tsx` | "상태 확인 중…" placeholder ✅ |
| `market-history-chart.tsx` | "시세 history 불러오는 중…" placeholder ✅ |
| `AccountPanel` | "불러오는 중…" + "—" placeholder ✅ |
| `pack-shop.tsx` | local state 만 (fetch X) |
| `hotdeal-alerts-view.tsx` | local state 만 |
| `dashboard.tsx` Navbar | user fetch — 빈 상태 = 로그인 버튼 (의도) |

## 위험

- skeleton 의 placeholder 폭/색상이 진짜 카드와 다르면 layout shift 가능. 폭 (h-3 w-12) + 색 (emerald-200/80) 진짜 카드와 매칭.
