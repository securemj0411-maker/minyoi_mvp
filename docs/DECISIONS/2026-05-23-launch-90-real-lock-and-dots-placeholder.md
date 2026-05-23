# launch-90 — 무료 다 쓴 후 진짜 카드 잠금 + 첫 피드 dots placeholder

## 사용자 정정 (강조 2회)

> "아니 4번째 누를 때 뒤에 안 잠긴다니까/???? 새로고침 해야잠긴다고;; ㅋㅋㅋㅋ 말귀를 못알아듣냐?"

launch-88 의 backdrop 강화 fix 는 **모달 떠있는 동안만** 어두움. 모달 닫으면 카드 다시 unlocked 처럼 보임 → 사용자가 "잠금 효과 없음" 인지.

추가:
> "이거 나오는 속도 진짜 느린데 ... whisper 그 앱 느낌처럼 좀 먼저 글자는 박혀있고 숫자만 기다리게 하는거"

## fix 1 — 진짜 카드 잠금 (`fullLocked` 도입)

### 원인
Wave launch-63 에서 "사진+제목 = 항상 unlock" 으로 박은 게 conversion 위해서였음 (잠긴 카드 보면 클릭 안 함). 근데 **무료 다 쓴 후엔** 이 가드가 잘못 작동:
- `freeDetailRemaining=0` + `creditBalance=0` 이어도 사진/제목 그대로 표시
- 사용자가 "왜 안 잠겼지?" → 새로고침해야 신선한 detail-access snapshot 받아서 잠금 적용

### 해결
새 변수 `fullLocked` 도입:
```ts
const fullLocked = lockedPreview && !freeDetailAvailable;
//   = 무료 다 씀 + 안 본 매물 (creditFeedEnabled 면 false)
```

**사진**: `fullLocked` 시 `scale-110 blur-md` + 가운데 자물쇠 SVG + 어두운 overlay.
**제목**: `fullLocked` 시 `lockedPreviewTitle(item)` ("의류 후보" / "신발 후보" 같은 placeholder) 표시.

이미 본 매물 (`openedDetailPids`) 는 `exactUnlocked=true` 라 영향 X. paywall 한 번 떴어도 다음 클릭 시 즉시 잠금 (응답 받으면 freeUsed 갱신 → fullLocked=true → re-render).

## fix 2 — 첫 피드 onboarding 숫자 dots placeholder

### Before
```
돈 안 되는 것            (3.5s wait for fetch)
거래 주의 신호           ...
상품 확인 필요           ...
```
숫자 자리 빈 채로 사용자 기다림.

### After
```
돈 안 되는 것            • • •  (animated bounce)
거래 주의 신호           • • •
상품 확인 필요           • • •
       ↓ 응답 도착
돈 안 되는 것            466건
거래 주의 신호            49건
상품 확인 필요         12,922건
```

라벨은 즉시 표시 (이미 fixed string) → row 형식 변화 없음 → 사용자가 "뭐가 뜨는지" 미리 인지 + dots 가 진행감 줌.

코드:
```tsx
{statsLoaded && row.value != null ? (
  <div className="text-[30px] ...">{row.value.toLocaleString("ko-KR")}건</div>
) : (
  <div className="flex h-[30px] items-center gap-1.5">
    <span className="h-2 w-2 animate-bounce rounded-full ... [animation-delay:-0.32s]" />
    <span className="h-2 w-2 animate-bounce rounded-full ... [animation-delay:-0.16s]" />
    <span className="h-2 w-2 animate-bounce rounded-full ..." />
  </div>
)}
```

dots 높이 30px = 숫자 line-height 와 동일 → 데이터 도착 시 layout shift 없음.

## 영향

### fix 1
- 무료 다 쓴 사용자가 모달 닫아도 카드 fully locked. 새로고침 안 해도 잠금 유지.
- 이미 본 매물 (saved/scrap/local opened) 는 그대로 표시.
- 무료 남은 사용자는 launch-63 의 사진/제목 노출 패턴 그대로 유지.

### fix 2
- 첫 피드 onboarding 진입 즉시 row 라벨 표시 → 사용자 인지 부담 ↓
- 숫자 도착 시 dots → 숫자 swap (layout shift 없음)
- Whisper 앱 패턴 = 진행감 시각화

## 검증

- [x] TS 컴파일 통과
- [ ] 폰에서 무료 3건 다 본 후 4번째 클릭 + 모달 닫기 → 카드 fully locked 유지 (사용자)
- [ ] 첫 피드 onboarding 진입 시 dots 보이다 숫자로 swap (사용자)

## 사과

launch-88 backdrop 강화는 "모달 떠있는 동안만" 효과. 사용자 의도 ("탭 후 모달 닫아도 잠금 유지") 와 mismatch. 두 번 강조하셨는데 못 알아들었습니다.

Owner: caulee1227@gmail.com / 2026-05-23
