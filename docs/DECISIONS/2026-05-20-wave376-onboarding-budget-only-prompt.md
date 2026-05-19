# 2026-05-20 Wave 376 — 가입 직후 예산만 묻기 (lightweight onboarding)

사용자: "가입직후 바로 물어보고 그 예산에 맞는 제품을 보면 relate하게 되서 가치를 더 잘 느끼지 않을까?? random으로 막 보여주는 거보다?"

## 결정

**가입 직후 (preferences X) 자동 모달**:
- 헤더: "환영해요 👋 예산 알려주세요"
- 부제: "그 예산 안에서 30개 골라드릴게요 (나중에 수정 가능)"
- 예산 4 chip만 (성향 chips **숨김** — 가벼움 우선)
- "이 예산으로 30개 받기" 큰 버튼
- X 클릭 → dismiss → random 30 (preferences X 그대로)

성향은 자동 **default "balanced"** — 사용자가 나중에 "다른 매물 찾기" 모달에서 [수정] 클릭 시 추가 가능.

## State 추가

```ts
const [awaitingInitialPrefs, setAwaitingInitialPrefs] = useState(false);

useEffect(() => {
  const loaded = loadPreferences();
  if (loaded) {
    setPreferences(loaded);
    // ...
  } else {
    setAwaitingInitialPrefs(true);
    setRefreshModalOpen(true);  // 자동 모달 트리거
  }
}, []);
```

### Fetch 가드
첫 진입 fetch 보류 → 답하기 전 random 30 화면에 안 보임:
```ts
useEffect(() => {
  if (awaitingInitialPrefs) return;  // 답하기 전엔 fetch X
  void loadPool(false);
}, [loadPool, awaitingInitialPrefs]);
```

### closeRefreshModal 가드 해제
모달 닫힘 시 (답 또는 dismiss) → 자동 해제:
```ts
const closeRefreshModal = useCallback(() => {
  setRefreshModalAnimating(false);
  const t = setTimeout(() => {
    setRefreshModalOpen(false);
    setAwaitingInitialPrefs(false);  // 보류된 fetch 트리거
  }, 250);
  ...
}, []);
```

### 답 흐름
1. 사용자 예산 chip 선택 → "이 예산으로 30개 받기" 클릭
2. savePreferences (budget + default balanced)
3. setPreferences (state)
4. closeRefreshModal → awaitingInitialPrefs=false → loadPool 트리거 → personalized 30 fetch

### Dismiss 흐름
1. 사용자 X 클릭 (또는 backdrop)
2. closeRefreshModal → awaitingInitialPrefs=false → loadPool 트리거 → random 30 fetch (preferences X)

## UI 차이

| 모드 | 헤더 | 폼 내용 | 버튼 |
|---|---|---|---|
| **lightweight** (가입 직후) | "환영해요 👋 예산 알려주세요" | 예산 chips만 | "이 예산으로 30개 받기" |
| **full form** (수정/없음) | "선호 수정" / "내 매물 취향 알려주세요" | 예산 + 성향 chips | "수정하고 새 30개 받기" / "내 취향대로 30개 받기" |
| **ready/cooldown** | "다른 매물 찾기" | 현재 선호 표시 + 받기 버튼 | "내 취향대로 30개 받기" |

## 변경 파일

`src/components/explore-client.tsx`:
- `awaitingInitialPrefs` state 신설
- mount useEffect — prefs X면 자동 모달 + 가드 트리거
- loadPool useEffect 가드 추가
- closeRefreshModal — awaitingInitialPrefs 자동 해제
- 폼 안 `lightweightMode = awaitingInitialPrefs` 변수
- 헤더 텍스트 lightweight 분기
- 성향 chips `{!lightweightMode ? ... : null}` 숨김
- 받기 버튼 라벨 lightweight 분기

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## Trade-off

- ✅ 첫 30개부터 자기 예산 안 → "내 매물" 느낌 강함 (random보다 relatable)
- ✅ 가벼움 (질문 1개) → drop-off 낮음
- ⚠ 가입 직후 모달 1개 등장 — 약간의 friction. but X로 dismiss 가능.
- ⚠ localStorage 단위 (디바이스 변경 시 재질문). 서버 저장은 별 wave.
