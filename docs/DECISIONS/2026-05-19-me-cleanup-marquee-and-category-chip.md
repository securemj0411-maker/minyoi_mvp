# 2026-05-19 — /me 모바일 가시성 + 카테고리 칩 정비

## 결정

사용자 피드백 3개 해소:
1. SafetyStatsMarquee 글로벌 노출이 모바일 /me fold 잡아먹는 문제 → 비로그인 메인 전용으로 이동
2. ExploreClient의 "구독자 전용 (곧 출시)" paywall 톤이 광고 같음 → "올린 지 6시간 넘은 매물 / 따끈한 매물 먼저 보기" 안내 톤으로 정비
3. 카테고리 칩이 텍스트만 박혀 촌스러움 → SF Symbol 스타일 라인 아이콘 + 텍스트

## 변경 (What)

### 1. SafetyStatsMarquee 위치
- [layout.tsx](../../src/app/layout.tsx) — `<SafetyStatsMarquee />` 글로벌 제거 + import 제거
- [preview-masked-dashboard.tsx](../../src/components/preview-masked-dashboard.tsx) — `<main>` 상단에 직접 박음

효과: 모바일 /me 진입 시 fold 안에 매물 카드가 보임. 비로그인 메인은 신뢰 hook 유지.

### 2. ExploreClient 풀 신선도 안내
- [explore-client.tsx:336-376](../../src/components/explore-client.tsx#L336) — 통계+paywall inline 텍스트 → 안내 박스(border-rounded)로 리팩토링
- 카피:
  - **Before**: "즉시 매물 N건은 구독자 전용 (곧 출시)" + "오늘 N건 잡힘"
  - **After**:
    > 지금 **올린 지 {freshLagHours}시간 넘은 매물**을 보고 있어요  ⚡ 따끈한 매물 먼저 보기 →  
    > (작은 글씨) 🔥 오늘 N건 새로 잡힘 · 구독자가 본 신선 매물 M건
- `freshLagHours` (StatsResponse에 이미 있던 값) UI에 직접 노출 → "왜 6시간?" 의문 즉시 해소
- "따끈한 매물 먼저 보기 →"는 `/plans`로 링크. Phase 1c (구독자 신선 매물) 박힐 때 별도 URL로 update 가능

### 3. 카테고리 칩 SF Symbol 라인 아이콘
- [icons.tsx](../../src/components/icons.tsx) — 신규 추가
  - `ShirtIcon`, `GameControllerIcon`, `DesktopIcon` SVG 컴포넌트
  - `CategoryIcon({ category, ...props })` dispatcher — 카테고리 키 → 아이콘 매핑
- [recommendation-workspace.tsx:844-871](../../src/components/recommendation-workspace.tsx#L844) — 카테고리 칩에 `<CategoryIcon ... strokeWidth={1.75} />` 추가
- [explore-client.tsx:345-370](../../src/components/explore-client.tsx#L345) — sticky filter bar 카테고리 칩에 동일 적용

기존 아이콘 재사용 (이미 박혀있던 것들): HeadphoneIcon, WatchIcon, SmartphoneIcon, TabletIcon, LaptopIcon, ShoeIcon, BagIcon, SpeakerIcon, MonitorIcon, CameraIcon.

매핑 누락 시 fallback `PackageIcon`. 추후 카테고리 추가될 때 `icons.tsx` CategoryIcon switch에만 추가하면 됨.

## 안 건드린 것 (의도적)

- **/me history view** — wave 343에서 이미 ExploreClient로 통합. 별도 freshness 안내 박스 추가 안 함 (ExploreClient 안에서 처리)
- **"더 찾아보기" 모달** — wave 343에서 폐기됨. SafetyStatsMarquee 박을 자리 없음
- **/plans, /how-it-works의 SafetyStatsMarquee** — 사용자 명시 X. 일단 비로그인 메인만. 나중에 필요하면 추가
- **카테고리 칩 색깔** — 활성/비활성/disabled 색 그대로 유지. 아이콘만 추가
- **strokeWidth 1.75** vs `baseProps.strokeWidth = 2` — 칩 작은 사이즈에서만 stroke 줄여 SF Symbol 느낌. 다른 아이콘 사용처는 그대로 stroke 2

## 후속 (Follow-up)

### Phase 1c 합류 시 (구독자 전용 신선 매물 페이지)
- ExploreClient 안내 박스의 `/plans` 링크 → `/explore?fresh=1` (또는 결정한 URL)
- "따끈한 매물 먼저 보기"가 진짜 신선 매물 페이지로 가도록

### P2 (디자인 정비)
- 카테고리 추가 시 아이콘도 함께 (home_appliance, sport_golf 등은 현재 PackageIcon fallback)
- ShirtIcon 등 lucide 디자인 그대로 가져온 게 강해서 strokeWidth 더 줄이는 정비 가능
- 카테고리 칩 활성 시 아이콘 색도 강조 (현재는 텍스트 색만 반영)

## 관련

- 사용자 피드백 원문: 모바일 /me fold + "광고 같다" + "이어폰 폰 태블릿 촌스러움"
- 메모리: "매물 카드 UI 변경 시 3화면 다 적용" — 카테고리 칩은 카드 위젯 아님. recommendation-workspace + explore-client 2곳 적용 (3번째 화면은 admin-pool-browser, 운영자라 톤 정비 영향 X)
- Wave 343 결정: /me history = ExploreClient (welcome flow 폐기) — 이번 변경의 전제
