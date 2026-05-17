# 2026-05-17 pack-reveal-modal layout fix (2 column 재구성)

## 사용자 지적

이전 commit `5cca758` PC 2 column 박았는데 layout 깨짐:
- 좌측 너무 좁아 글자 wrap ("아이패드 미니6..." 세로, "+67,785 원" 세로, 버튼 "상 세 비..." 세로)
- 우측 (~50%) 비어있음

## 원인

이전:
```tsx
<div className="grid sm:grid-cols-[132px_1fr] lg:grid-cols-[150px_1fr]">
  <Image />
  <div className="grid lg:grid-cols-[1fr_1.2fr]">  // ← inner grid
    <div>메타</div>
    <div>시세 영역</div>
  </div>
</div>
```

→ outer (1fr) 안에 inner (1fr+1.2fr) 분리 = 메타 column 좁음 (150 + 1fr 의 split).

## Fix (commit `f01185c`)

```tsx
<div>  {/* outer wrapper */}
  <div className="grid lg:grid-cols-[1fr_1.1fr]">  // ← outer 2 column
    {/* 좌측 = image + 메타 grid (기존 패턴) */}
    <div className="grid sm:grid-cols-[132px_1fr] lg:grid-cols-[150px_1fr]">
      <Image />
      <div>메타</div>
    </div>
    {/* 우측 = 시세 영역 */}
    <div>{MarketBasisMini + Chart + Velocity + Flow + Debug}</div>
  </div>
  {/* outer 밖 = full width */}
  <div>{노트 + 버튼}</div>
</div>
```

## 효과

- 좌측 column = 모달 너비 ~48% (image 150 + 메타 ~300px)
- 우측 column = 모달 너비 ~52% (시세 영역 충분)
- 빈 공간 없음

## Test

288/288 pass.
