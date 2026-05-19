# 2026-05-19 — /me CTA sticky 통일 (모바일 fixed → sticky)

## 결정

`/me` 페이지(ExploreClient)의 "다른 매물 찾기" CTA 버튼을 모바일·데스크탑 모두 **sticky bottom** 패턴으로 통일.

## 사용자 피드백

> "/me페이지 다른 매물 찾기 버튼 sticky되게 해놓으라고 다른 세션에서 말했는데 안고쳐진듯
> 하단에 fixed되다가 제자리 보이면 탁 멈추는 그게 sticky 아니였나?
> '다른 30개 매물 받을 수 있어요 / 새로운 매물 풀로 갱신 / 즉시 매물 304건 구독자 전용' 이거 밑부분에 pc버전 처럼 그 위치에 모바일에서"

→ 정확히 sticky 동작 묘사. 데스크탑은 sticky 작동 중이었는데 모바일만 여전히 fixed FAB.

## 변경 (What)

파일: [explore-client.tsx:618-644](../../src/components/explore-client.tsx#L618)

### Before
```tsx
{/* 모바일 fixed FAB */}
<div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 sm:hidden">
  <button className="... shadow-[0_20px_44px_...]">다른 매물 찾기</button>
</div>

{/* 데스크탑 sticky */}
<div className="sticky bottom-4 z-20 mt-6 hidden justify-center sm:flex">
  <button className="... shadow-[0_16px_34px_...]">다른 매물 찾기</button>
</div>
```

### After
```tsx
{/* 통일 sticky — 모바일/데스크탑 동일. responsive로 사이즈/그림자만 분기 */}
<div className="sticky bottom-4 z-20 mt-4 flex justify-center px-4 sm:mt-6 sm:px-0">
  <button className="min-h-12 ... px-6 py-3.5 text-base ... sm:min-h-0 sm:py-3 sm:text-sm">
    다른 매물 찾기
  </button>
</div>
```

### 변화점
- **모바일**: `fixed` → `sticky bottom-4`. "다른 30개" 카드(Wave 358) 위에서 sticky로 떠있다가 카드 위치 도달 시 자연 위치 흡수
- **데스크탑**: 동작 그대로 (이미 sticky)
- **사이즈**: 모바일 큰 버튼(min-h-12, text-base, py-3.5) 유지 — touch target. 데스크탑 작은 버튼(py-3, text-sm).
- **그림자**: 모바일 더 강한 shadow (떠있을 때 시각 부각). responsive로 분기

## 안전성

- sticky 작동 조건 (부모 overflow/transform 없음) 데스크탑에서 이미 검증됨. 모바일도 같은 wrapper 사용 ([me-dashboard-client.tsx](../../src/components/me-dashboard-client.tsx) `<section>`)
- pointer-events 통상 (이전 fixed FAB는 `pointer-events-none` + `pointer-events-auto` 패턴이었으나 sticky는 불필요)
- z-index 20 (sticky filter bar의 z-20과 같지만 위치 다름. 충돌 X)

## 후속 (같은 PR에 추가 commit)

### pb-24 → pb-4 — sticky 통일 후 잔여 padding 제거
[explore-client.tsx:338](../../src/components/explore-client.tsx#L338) root div

옛 fixed FAB 시절: 매물 카드 끝이 화면 하단 FAB에 가려지지 않게 부모 `pb-24` (96px) 박았었음.
sticky 통일 후 fixed가 차지하는 영역이 없으니 그 padding이 button과 footer 사이 빈 공간으로 남음.
사용자 모바일 스크린샷에서 "다른매물찾기 버튼이랑 푸터 사이 여백" 직접 보고됨.

→ `pb-24` → `pb-4` (16px). 시각적 최소 여백만. 자연 흐름: 카드 grid → 다음 라운드 안내 → sticky button → footer.
