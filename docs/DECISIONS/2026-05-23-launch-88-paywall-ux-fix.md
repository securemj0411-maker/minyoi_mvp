# launch-88 — paywall 모달 + 클릭 loading UX 3중 fix

## 사용자 정정

> "1) 크레딧이 부족해요 모달이 너무 커서 모바일 화면 안에 다 안 들어옴 — 첫 무료 상세보기 + 진행 bar + 설명 + 보유 크레딧 이 너무 수직적으로 큼.
>  2) 크레딧 부족 뜬 순간 뒤에 화면 다 잠겨야 — 제목/사진 왜 안 잠김?
>  3) 상품 클릭 시 실시간 검증 딜레이 동안 아무 시각 피드백 X — 렉걸린 느낌. 검은 overlay + 가운데 dots 로딩 indicator 필요"

## 1. 크레딧 부족 모달 compact 화

**before** (4 rows 수직):
```
첫 무료 상세보기            3 / 3
[━━━━] [━━━━] [━━━━]   (h-2.5)
첫 3개 상품은 무료로 열리고, 이후에는 새 상품을 열 때마다 1크레딧이 차감됩니다.
[현재 보유 크레딧            0개]
```

**after** (2 rows):
```
무료 3/3 사용      보유 0크레딧
[━━] [━━] [━━]   (h-1.5)
```

- 설명 텍스트 ("첫 3개 상품은 무료로...") 제거 — 모달 헤더/body 와 의미 중복.
- "현재 보유 크레딧" 별도 row → inline.
- progress bar h-2.5 → h-1.5.
- padding p-4 → p-3, rounded-[22px] → rounded-[18px].

세로 약 절반 절약.

## 2. paywall 모달 backdrop 강화

**before**: `bg-black/45 backdrop-blur-[2px]` — 사용자 캡쳐상 뒤 카드 사진/제목 다 보임.

**after**: `bg-black/70 backdrop-blur-md` — 사실상 뒤 카드 콘텐츠 안 보임.

별도 카드 contents lock 안 함 — backdrop 강화로 동일 효과 + 단순.

## 3. 클릭 시 검은 overlay + dots loading

`detailAccessLoadingPid` set 된 동안 전체 화면 overlay (`fixed inset-0 z-[94]`).

```tsx
{detailAccessLoadingPid != null ? (
  <div className="fixed inset-0 z-[94] flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
    <div className="flex gap-2">
      <span className="h-3 w-3 animate-bounce rounded-full bg-white [animation-delay:-0.32s]" />
      <span className="h-3 w-3 animate-bounce rounded-full bg-white [animation-delay:-0.16s]" />
      <span className="h-3 w-3 animate-bounce rounded-full bg-white" />
    </div>
  </div>
) : null}
```

- 3 dots Tailwind `animate-bounce` + staggered `animation-delay` — 점프 staggered.
- z-[94] (paywall modal z-[95] 보다 한 단계 아래) — paywall 트리거 시 자동으로 paywall 가 위로 올라옴.
- `detailAccessLoadingPid` 는 `openItemDetail` 시작 시 set, fetch 응답 받으면 unset → overlay 자동 사라짐.
- `aria-live="polite"` + `aria-busy="true"` 접근성.

## 검증

- [x] TS 컴파일 통과 — explore-client.tsx 에러 0
- [ ] 모바일에서 paywall 모달 화면 안 들어옴 확인 (사용자)
- [ ] 클릭 시 dots overlay → 응답 시 paywall 자연 전환 (사용자)
- [ ] paywall 떴을 때 뒤 카드 사진/제목 안 보임 (사용자)

Owner: caulee1227@gmail.com / 2026-05-23
