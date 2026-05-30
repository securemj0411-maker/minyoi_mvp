# Wave 803 — 로그인 메인 = URL 시세 조회로 전환

- 시간: 2026-05-30 KST
- 트리거: owner — "로그인 한 후 메인 페이지가 주소 입력하는 걸로 할래?? 아래 가시적으로 지금 바로 싸게 나온 매물 보러가기 버튼으로 피드로 가는거? 미리 백엔드에서 준비해서 피드 로딩 오래 안걸리게?"

## owner 답변 (AskUserQuestion)

- **방향**: URL 입력 + 버튼 (제안한 그대로). 어차피 기존 회원 없어서 전환 비용 X.
- **피드 destination**: `/me?view=history` (현재 default 피드).
- **Nav '추천 상품'**: `/me?view=history` 로 redirect.

## 변경

### 1. `LookupClient` props 분기 (`src/app/lookup/lookup-client.tsx`)

```ts
export default function LookupClient({ mode = "page" }: { mode?: "page" | "home" } = {})
```

- **page** (default, `/lookup` 페이지) — `"← 메인으로"` link + 일반 헤더
- **home** (`/` 로그인 후 메인) — 큰 hero + "추천 매물 둘러보기" CTA

### 2. 메인 페이지 (`src/app/page.tsx`)

```tsx
return (
  <Suspense fallback={...}>
    <LookupClient mode="home" />
  </Suspense>
);
```

기존 `MeDashboardClient` → `LookupClient mode="home"` 로 교체.
비로그인 분기 (`PreviewMaskedDashboardServer`) 는 그대로.

### 3. Home 모드 hero + CTA

**Hero**:
- "💎 득템잡이" badge
- "관심 매물 시세 바로 확인해보세요" (h1, 26px)
- "번개장터·중고나라·당근마켓 URL 만 붙여넣으면 ..." (설명)
- "💎 조회 1번 = 0.2크레딧 (5번 = 1크레딧 차감)" (pricing chip)

**CTA** (result 없을 때만 노출):
- 🔥 + "지금 바로 싸게 나온 매물 보러가기"
- 큰 emerald 버튼 → `/me?view=history`

### 4. 백그라운드 prefetch

home 모드 마운트 시 `useEffect`:
```ts
void fetch("/api/packs/pool", { cache: "no-store", headers: {Authorization: `Bearer ${token}`} });
void fetch("/api/stats/pool", { cache: "no-store", headers });
```

사용자가 URL 입력하는 동안 피드 server-side warm-up. `/me?view=history` 진입 시 PG buffer / 거리 계산 캐시 hit.

### 5. Nav 변경 (`src/components/app-nav.tsx`)

**Desktop navLinks** (로그인 시):
- `"추천 상품"` → `/me?view=history` (기존 `/` → 메인이 URL 입력으로 바뀌었으니)
- `"시세 조회"` link **제거** (메인 = 시세 조회 이므로 중복)

**Desktop navLinks** (비로그인):
- `"추천 상품"` → `/` (PreviewMaskedDashboard)
- `"시세 조회"` → `/lookup` (직접 진입 가능하게 유지)

**Mobile drawer** (로그인):
- `"추천 피드"` → `/me?view=history`
- `"시세 조회"` → `/lookup` (= 메인과 동일 화면이지만 명시 진입 path 유지)

## 흐름 비교

### 변경 전
1. 로그인 → `/` → MeDashboardClient → ExploreClient
2. 진행 단계 progress bar (Wave 801) → 결과 표시
3. URL 시세 조회는 nav '시세 조회' 클릭해야 진입

### 변경 후
1. 로그인 → `/` → LookupClient (URL 입력 hero + 피드 CTA)
2. 백그라운드 fetch /api/packs/pool 즉시 시작
3. 사용자 선택:
   - URL 붙여넣기 → 시세 조회 (0.2크레딧)
   - 또는 "추천 매물 둘러보기" 버튼 → `/me?view=history` (이미 prefetch 됨 → 빠름)

## Trade-off

### 피드 ↔ URL lookup 1차 선택권 사용자에게

- ✅ 사용자가 본 매물 (어디서 발견) 시세 즉시 확인 — 자연스러운 entry point
- ✅ 일반인 친화 — "내가 본 매물 검색" 직관적, "feed scroll" 보다 명확한 가치 제안
- ⚠️ 기존 회원 (현재 0명) 전환 비용 — 무시 가능
- ⚠️ Browse 습관 사용자 (탐색파) 는 한 번 더 클릭 필요 — 우측 CTA 명시로 완화

### prefetch 부담

- 마운트 시 2 endpoint 호출 (fire-and-forget). Server SELECT only — 작음.
- 사용자가 URL 입력만 하고 떠나도 같은 부담. 매번 마운트 = prefetch 발생.
- localStorage 5분 throttle 검토 follow-up (불필요한 prefetch 줄이기).

### Nav 일관성

- 메인 (`/`) = URL 시세 조회 = nav 의 어떤 link 와도 명시 대응 X (메인 자체가 어떤 기능 화면).
- 사용자가 헷갈리지 않게 nav 의 "추천 상품" → `/me?view=history` (피드), "시세 조회" → `/lookup` (= 메인과 동일 기능이지만 명시 경로).
- '내 대시보드' → `/me` (default view = history).

## 미해결 / Follow-up

- **localStorage prefetch throttle** — 5분 이내 prefetch 발생 했으면 skip.
- **카카오톡 인앱브라우저 clipboard auto-detect** — 권한 거부 케이스 fallback UX.
- **A/B test 전 시점에 baseline metric** — 메인 페이지 평균 머무는 시간 / URL 입력률 측정 (analytics 박혀있으면).
- **첫 진입자 onboarding hint** — "처음이세요? URL 붙여넣어 시세 확인해보세요" 같은 tooltip.

## 검증 흐름

1. 로그인 후 `/` 진입 → 큰 hero + URL 입력 + "추천 매물 둘러보기" CTA 노출 확인
2. Network tab → 마운트 직후 `/api/packs/pool` + `/api/stats/pool` 호출 확인
3. "추천 매물 둘러보기" 클릭 → `/me?view=history` 이동 + 빠른 로딩 확인 (prefetch 효과)
4. Nav '추천 상품' 클릭 → `/me?view=history` redirect 확인
5. 비로그인 진입 → 기존 PreviewMaskedDashboard 노출 (변경 X) 확인
