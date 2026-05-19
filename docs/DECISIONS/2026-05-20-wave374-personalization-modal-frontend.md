# 2026-05-20 Wave 374 — Personalization 모달 (frontend phase)

사용자 제안:
- 첫 "다른 매물 찾기" → 예산 + 성향 폼 → 답하면 personalized 30개 즉시
- 두 번째 → cooldown 표시 + 수정 가능 + 구독 paywall
- cooldown 끝 → 자기 선호 적용한 새 30개 받기

## 결정

### 3 모드 모달

| 모드 | 조건 | UI |
|---|---|---|
| **form** | preferences X, 또는 editingPrefs=true | 예산 4 chip + 성향 3 chip + "받기" |
| **ready** | preferences O & cooldown 끝 | 현재 선호 표시 + 수정 + 큰 받기 버튼 |
| **cooldown** | preferences O & cooldown 안 끝 | 현재 선호 + 수정 + cooldown 카운트다운 + 구독 paywall |

### State machine
```ts
const [preferences, setPreferences] = useState<UserPreferences | null>(null);
const [editingPrefs, setEditingPrefs] = useState(false);
const [draftBudget, setDraftBudget] = useState<Budget>("unlimited");
const [draftPreference, setDraftPreference] = useState<Preference>("balanced");
```

- **localStorage 저장** — `minyoi_explore_prefs_v1` (디바이스 단위)
- mount 시 localStorage → state
- 사용자가 폼 submit 하면 `savePreferences` 호출

### Form submit 흐름
```ts
const newPrefs = { budget: draftBudget, preference: draftPreference };
savePreferences(newPrefs);          // localStorage
setPreferences(newPrefs);            // state
setEditingPrefs(false);
if (canRefresh) {
  void loadPool(true, newPrefs);    // 즉시 fetch personalized 30
}
closeRefreshModal();
```

cooldown 안 끝났으면 fetch X (저장만). cooldown 끝나면 즉시 fetch + append.

### Backend 연동
Wave 373에서 만든 pool API 파라미터 사용:
- `?budget=300k`
- `?preference=balanced`

`loadPool`에 prefsOverride 인자 추가 — 폼 submit 직후 state update 기다리지 않고 즉시 새 prefs로 fetch.

### 옵션 디자인
- **예산** (4 chips, grid-cols-2):
  - 10만 이하 / 30만 이하 / 50만 이하 / 제한 없음
- **성향** (3 chips, grid-cols-3):
  - 🛡 안전 (셀러 평점 높음)
  - ⚖ 균형 (안정 + 차익)
  - 🚀 공격 (차익 큰 매물)

각 chip: 선택 시 emerald 강조, 미선택 회색 보더. emoji 표시.

### Cooldown 모드 paywall 변경
```diff
- "맞춤 검색" amber 카드 (예산/성향 미리보기 disabled)
+ "기다리지 말고 즉시 받기" amber 카드 (cooldown 끝나기 전에만 표시)
  - cooldown 없이 바로 + 6시간 미만 fresh 매물도
  - 구독으로 풀기 →
```

### "취소" 버튼 (editingPrefs 모드)
- 폼 수정 중 취소 클릭 → 이전 prefs로 복원 + editingPrefs=false

## 변경 파일

`src/components/explore-client.tsx`:
- Type 추가: `Budget`, `Preference`, `UserPreferences`
- helper: `loadPreferences()`, `savePreferences()`, `PREFS_STORAGE_KEY`
- 상수: `BUDGET_OPTIONS`, `PREFERENCE_OPTIONS`
- state: `preferences`, `editingPrefs`, `draftBudget`, `draftPreference`
- mount useEffect: localStorage 로드
- `loadPool` 인자에 prefsOverride 추가, URL에 budget/preference 파라미터 박음
- 모달 안 IIFE로 3 모드 분기 (form / ready / cooldown)

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 사용자 흐름 시각

```
[/me 첫 진입]
   ↓
랜덤 30개 (preferences X — 기본 풀)
   ↓
"다른 매물 찾기" 클릭
   ↓
[form 모드]
  예산: ○○○●  성향: ●○○
   ↓
"내 취향대로 30개 받기" → personalized 30 append + cooldown 시작
   ↓
30분 안에 또 클릭:
   [cooldown 모드]
   현재: 30만 이하 · 균형 [수정]
   "내 취향대로 30개 받기" (disabled, 12:34 후)
   "기다리지 말고 즉시 받기" → 구독 paywall
   ↓
cooldown 끝 후 클릭:
   [ready 모드]
   현재: 30만 이하 · 균형 [수정]
   "내 취향대로 30개 받기" (enabled) → 또 personalized append
```

## 후속 가능

- Server-side preferences 저장 (mvp_user_credits에 column 추가)
- 카테고리도 preferences로 (전체 vs 특정)
- 첫 30개도 personalized하려면 가입 직후 폼 강제 (현재는 우선 랜덤)
