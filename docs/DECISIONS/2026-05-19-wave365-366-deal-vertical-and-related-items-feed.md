# 2026-05-19 Wave 365+366 — 제목/점수 수직 정렬 + 다른 추천 매물 /me 톤

사용자 4가지 지적 (한 메시지 + 추가):
1. 제목과 점수 사이에 빈 공간 많음 → 수직 가운데로
2. 모달 안 "다른 추천 매물"도 카드 박스에 가둠 → /me 피드처럼 divider만 + 사진 크게
3. 추천 매물에 매입가만 나오고 시세 안 보임
4. "상태 재확인" 라벨 의도 모름 → 제거

## 결정

### Wave 365 — 제목 + 점수 items-center
`flex items-start gap-3` → `flex items-center gap-3`

점수 영역 (2줄: 85/100 + 득템 점수)이 제목 (1줄)보다 크면 items-start에선 둘 다 위 정렬 → 제목 아래 빈 공간. items-center로 제목이 수직 가운데 배치.

### Wave 366 — RelatedRevealStrip /me 피드 톤

**이전**:
```
<section className="mx-3 rounded-2xl border ... bg-[#fffdf9] px-3 py-3 shadow-...">
  카드 안 카드 (border + shadow)
  92~104px 사진
  매입 · 시세 정보
  "상태 재확인" span
</section>
```

**이후**:
- 박스 (border + shadow + cream bg) **완전 제거** → divider만
- 사진 92/104 → **120px** (/me 피드 매칭)
- 외부 padding `-mx-3` (모바일 full bleed)
- 부제 "매입가·시세·상태를 같이 보고..." 제거 (불필요 설명)
- **"상태 재확인" span 제거** (의도 불명)
- 카드 className 단순화 (rounded X, hover 효과 → active:bg-zinc-50)

### Wave 366 (시세) — 시세 데이터 채움

**원인**: `explore-client.tsx` relatedItems에서 `marketBasis: null` 박음. → RelatedRevealStrip에서 `medianPrice` 조건 false → 시세 안 보임.

**수정**: `it.skuMedian` 있으면 minimal `marketBasis` 객체 채움:
```ts
marketBasis: it.skuMedian ? {
  comparableKey, label, medianPrice: it.skuMedian,
  priceSource: "market", conditionClass: it.conditionClass,
  ... (모든 nullable 필드)
} : null
```

PoolItem이 `skuMedian` 갖고 있어서 추가 fetch 없이 표시 가능.

## 변경 파일

### `src/components/pack-reveal-modal.tsx`
- RevealCardItem 안 제목 행 `items-start` → `items-center`
- RelatedRevealStrip 전면 재설계 (박스 제거 + divider + 120px 사진 + "상태 재확인" 제거)

### `src/components/explore-client.tsx`
- relatedItems useMemo 안 `marketBasis: null` → `it.skuMedian ? minimal_basis : null`

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 시각 비교 (추천 매물 영역)

**이전**:
```
┌─ 내 다른 추천 매물            8개 ─┐
│ 매입·시세·상태 같이 보고 ...        │
│ ─────────────────────────────────── │
│ [104px] 제목                        │
│        매입 X원   (시세 없음)        │
│        +XX원  상태 재확인           │
│ ─────────────────────────────────── │
│ ...                                 │
└─────────────────────────────────────┘ (cream border + shadow)
```

**이후**:
```
다른 추천 매물                  8개
─────────────────────────────────
[120px]  제목 (text-sm font-bold)
         +XX원 (text-lg emerald)
         매입 X원 · 시세 X원 · 다나와
─────────────────────────────────
[120px]  ...
─────────────────────────────────
```
박스 X, divider만, 사진 크게, 시세 표시.
