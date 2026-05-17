# Wave 197 — verdict chip 카테고리 quality 신호 추가 (9개 새)

## 사용자

> "b ㄱㄱ?? 개좋을듯 그거 다하면 C 개지릴듯"

→ B 박은 후 C (keyboard shortcut).

## 박은 것

### `listing-verdicts.ts` 추가 — 9개 새 chip

#### 1. 카테고리 quality (false positive 차단 negative guard)

| chip | regex | category | tone |
|---|---|---|---|
| 🪞 액정 깨끗 | "액정/화면/디스플레이/유리" + "깨끗/흠집 없/기스 없" | iPhone/iPad/노트북/워치 | good |
| 📸 카메라 정상 | "카메라" + "정상/깨끗/흠집 없/작동 잘" | iPhone/Galaxy | good |
| 🎯 Face/TouchID | "FaceID/페이스ID/지문" + "정상/작동/잘 됨" | iPhone/iPad | info |
| 🔌 충전 정상 | "충전" + "정상/잘 됨/문제 없" | 무선이어폰/전자기기 | info |
| 🎁 추가 구성품 | "케이블/스트랩/케이스" + "추가/N개" / "정품 케이스 포함" | 전기기 | good |

**Negative guard**: 매칭 부분 ±30자 안에 "없|안|않|손상|깨|크랙|이상" 있으면 skip.
→ "액정 깨끗하지 않음" 같은 false positive 차단.

#### 2. 배터리 세분화

| chip | range |
|---|---|
| 🔋 배터리 100% (Wave 196) | 100% 명시 |
| 🔋 배터리 95~99% (Wave 197) | 95~99% 명시 — `BATTERY_100_RE` 안 매칭 시 fallback |

#### 3. 보증

| chip | 조건 |
|---|---|
| 🛡️ AppleCare (Wave 196) | "AppleCare" / "애플 케어" |
| 🧾 보증 잔여 (Wave 197) | "보증 N개월 남음" / "보장" + 잔여 — AppleCare 없을 때 fallback |

#### 4. 노트북 전용

| chip | 조건 |
|---|---|
| 📊 사이클 N회 | "사이클/cycle N회" — 1~200회만 (낮은 사용감 신호) |

#### 5. 스마트폰 risk 반대 신호

| chip | 조건 |
|---|---|
| 🚫 자급제/언락 | "자급제 / 언락 / unlocked / 공기계 / 통신사 무관" |

→ RiskScoreBar 의 잠금 risk 반대. "확정 자급제" 명시 보장.

## 적용 흐름

- 3 화면 (admin / pack-reveal / user-reveal) 자동 반영
- max 6 chip cap — 가장 강한 신호만 살아남음
- 우선순위: 강한 부정 > 가격 매력 > **카테고리 강한 긍정** > **카테고리 quality** > 시장 활성 > 셀러 > 시세 신뢰 > 기타

## 매물 카드 예 (description 풍부할 때)

description: "iPhone 14 Pro, 배터리 정품 98%, AppleCare 6개월 남음, 풀박스, 액정 깨끗 흠집 없음, FaceID 정상, 카메라 흠집 없음, 자급제"

→ chip (max 6):
```
[시세보다 -23%] [🔋 배터리 98%] [🛡️ AppleCare] [📦 풀구성] [🪞 액정 깨끗] [📸 카메라 정상]
```

미뇨이 차별화 **"근거 있는 추천"** 극대화. 매물 카드 풍부.

## Trade-off

### Pros
- 카테고리 무관 + 카테고리 특화 모두 cover
- negative guard — false positive ↓
- 기존 chip + 새 chip 모두 max 6 cap 안에서 살아남음

### Cons
- description 풍부할 때만 효과 — 빈약한 description 매물은 변화 없음
- regex 한계 — "액정 깨끗하지만 흠집 1개" 같은 부분 부정은 cover X
- 일부 false positive 잔존 가능 — 사용자 피드백 (inaccurate_report) 으로 누적 학습

## Test

`npm run test:core`: **383/383 pass**.

## Follow-up

1. **SKU별 더 정밀** — 노트북 배터리 cycle은 model 별 임계 (Mac < Galaxy Book)
2. **description 풍부화 metric** — chip 0개 매물 vs 풍부 매물 retention 비교
3. **사용자 피드백** — inaccurate_report 의 카테고리 "info (매물 정보 다름)" 누적 시 regex 보정 wave

## Linked

- `2026-05-17-wave196-verdict-chips-richer.md`
