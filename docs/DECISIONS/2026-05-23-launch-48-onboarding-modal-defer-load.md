# 2026-05-23 — launch-48: onboarding modal 떠 있으면 first fetch skip (예산 선택 후만 fetch)

## 사용자 짚음
> "초반 가입할때 예산 선택할때 선택하면 그때 제대로 안되는거 같던데... 예산 선택해도 뭔가 기존에 모달 뒤에서 이미 되있어서 15만원 이하로 해도 막 50만원 먼저 뜨고 그랬음"

## 진단

### root cause — 두 useEffect race
1. mount → `useEffect (line 1437)` `loadPool(false)` 첫 fetch 시작 (budgetFilter default = readBudgetFilterOption = "all")
2. mount → `useEffect (line 1221)` `setShowFirstFeedOnboarding(true)` modal 표시
3. fetch 끝 → items 표시 (50만 매물 포함) — modal 뒤로 visible
4. 사용자 "15만" 선택 → `setBudgetFilter("150000")` + `dismissFirstFeedOnboarding()` → loadPool 재호출

→ **첫 fetch 가 사용자 예산 선택 전 일어남**. 50만 매물 모달 뒤에 표시 = 사용자 confusion.

## fix

`useEffect (line 1444)` 첫 fetch 가드:
```ts
useEffect(() => {
  if (showFirstFeedOnboarding) return;   // ← 추가
  void loadPool(false);
}, [loadPool, showFirstFeedOnboarding]);  // ← deps 도 추가
```

### flow 변경
**Before**:
1. mount → fetch (budget="all") + modal 표시
2. 사용자 "15만" 선택 → 새 fetch (수초)
3. 그 사이 50만 매물 visible

**After**:
1. mount → modal 표시 (fetch X)
2. 사용자 "15만" 선택 → `setBudgetFilter("150000") + setShowFirstFeedOnboarding(false)`
3. useEffect 재실행 (deps 두 개 변경) → loadPool(false) 첫 fetch (budget=150k)
4. 50만 매물 처음부터 안 fetch

### dismiss 경우
- 사용자 X 클릭 → `dismissFirstFeedOnboarding()` (budgetFilter 변경 X)
- showFirstFeedOnboarding false → useEffect 통과 → loadPool(false) (budget = readBudgetFilterOption default 또는 last selected)

## 영향
- 코드: src/components/explore-client.tsx 1 곳 (useEffect 가드 + deps)
- 사용자: 처음 가입 시 예산 선택 후만 매물 fetch. 모달 뒤 misleading 매물 X.

## Trade-off
- 장점: 사용자 의도 일치 (선택 → 매물). race condition 차단.
- 단점: 첫 mount 시 fetch 1-2초 지연 (modal close 후). 단 modal 있는 동안 fetch 안 함 = network 절약.

## 메모리 룰
- onboarding flow UX: 사용자 선택 우선
- decision log: 이 파일
