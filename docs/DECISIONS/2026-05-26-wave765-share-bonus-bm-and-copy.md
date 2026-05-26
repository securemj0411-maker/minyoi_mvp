# Wave 765b-d — 카톡 공유 보너스 BM 결정 + 토스트 dedup + 카피 직관화

## 사용자 보고 (3가지)

1. **UI 1크레딧 표시, 실제 3 지급** — 불일치 버그
2. **토스트 중복** — "3크레딧 받았어요" 후 다른 매물 보면 "2크레딧 받았어요" 또 박힘
3. **"크레딧" 용어 일반인 이해 못함** — "매물 N개 더 보기" 같이 직관적이여야

## Wave 765b (PR #31) — UI sync + 토스트 dedup

### UI 1크레딧 → 3크레딧
- `explore-client.tsx` 4곳 "1크레딧" → "3크레딧"
- backend (Wave 736) BONUS_AMOUNT=3 와 sync

### 토스트 중복 차단 (`balance-toast.tsx`)
- 원인: Realtime UPDATE event reconnect 시 replay 또는 multiple trigger
- Fix: 같은 (oldBalance, newBalance) transition 30초 내 두 번째 트리거 skip

```typescript
let lastShownTransition: { from: number; to: number; ts: number } | null = null;

// payload handler 안:
const sameTransition = lastShownTransition?.from === oldBalance && lastShownTransition?.to === newBalance;
const ageMs = now - (lastShownTransition?.ts ?? 0);
if (sameTransition && ageMs < 30_000) return;
lastShownTransition = { from: oldBalance, to: newBalance, ts: now };
```

## Wave 765c (PR #32) — BM 결정 3 → 2 크레딧

### 사용자 BM 우려
> "공유 2크레딧 무료? 많은 거 아닌가? 1개? 2개? BM 굴러갈려면?"

### 데이터 분석

크레딧 가격 (패키지 별):
| 패키지 | 가격 | 크레딧 | 1개당 |
|---|---|---|---|
| starter | 690원 | 1 | 690원 |
| light | 2,900원 | 5 | 580원 |
| **popular** | 9,900원 | 20 | **495원** |
| premium | 19,900원 | 45 | 442원 |
| pro | 49,900원 | 130 | 384원 |

평균 ≈ 495원/크레딧 (popular 기준)

공유 보너스 비용 (24h cooldown — 30일 max):
| 정책 | 1회 보상 가치 | 30일 max |
|---|---|---|
| 3 크레딧 | 1,485원 | 44,550원 |
| **2 크레딧** | **990원** | **29,700원** |
| 1 크레딧 | 495원 | 14,850원 |

### 결정 = 2 크레딧 (균형)

이유:
- 1 (495원): 너무 작아서 사용자 motivate X
- 3 (1,485원): 강한 인센티브 but BM 부담 — 친구 가입 안 해도 지급 (CAC 정확 매핑 X)
- **2 (990원)**: 인센티브 + BM 안전 둘 다

### 변경
- `src/app/api/kakao/share-webhook/route.ts`: BONUS_AMOUNT 3 → 2
- `src/app/api/packs/pool/share-bonus/route.ts`: BONUS_AMOUNT 3 → 2
- `src/components/explore-client.tsx` UI 4곳: "3" → "2"

## Wave 765d — 카피 직관화 (이번 PR)

### 사용자 정정
> "크레딧은 우리 시스템 모르는 사람들이 이해 못함. 직관적이지 않음. 좋은 문구로 박아주고."

### 변경 — 카톡 공유 CTA
| Before | After |
|---|---|
| "카톡으로 공유하고 크레딧 2개 받기" | **"카톡 공유하고 매물 2개 더 자세히 보기"** |
| "카톡 공유하고 무료로 2개 받기" | **"공유하고 매물 2개 더 보기"** |
| chip "+2 크레딧" | chip **"매물 2개 더"** |

### 변경 — 토스트 (balance-toast.tsx)
| Before | After |
|---|---|
| "크레딧 N개 받았어요 🎁" | **"매물 N개 더 자세히 볼 수 있어요 🎁"** |
| (카톡 공유 시 동일) | **"공유 고마워요! 매물 N개 더 자세히 볼 수 있어요"** (shareBonus=true 일 때) |

### 가치 명시 — 매물 1개의 의미
- 매물 1개 reveal = 정확한 가격 + 셀러 정보 + 원본 매물 링크 + 차익 분석
- 사용자 평균 차익 매물 = +평균 3만원 (kpi 기반)
- 즉 매물 2개 더 보기 ≈ 6만원 잠재 차익 발견 가능 (1개당 차익은 사용자 본인 거래에 의존)

## 비파괴 보장

- backend BONUS_AMOUNT 변경 → 신규 grant 만 2 크레딧
- 기존 grant (3 크레딧) ledger 그대로 — 회수 X
- UI 카피만 변경 — 기능 영향 X
- 토스트 dedup 30초 — race condition 차단 (실제 보너스 1회만 표시)

## 후속 (별도 wave 가능)

- onboarding-banner 의 "1크레딧씩 차감" 도 자연스럽게: "매물 1개씩 자세히 보기" 같이.
- account-panel 의 "크레딧 사용" 라벨도 직관화 가능.
- pack-shop / 결제 UI 의 "N크레딧" 표시도 매물 단위로 (예: "20개 매물 자세히 보기" 패키지).

## PR

- PR #31 — Wave 765b (UI 1→3 sync + 토스트 dedup)
- PR #32 — Wave 765c (BM 결정 3→2)
- (이번 PR) — Wave 765d (카피 직관화)
