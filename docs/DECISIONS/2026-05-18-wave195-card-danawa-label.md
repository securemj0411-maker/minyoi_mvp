# Wave 195 (2026-05-18) reveal 카드 시세 출처 라벨 — 다나와/번개 S급 명시

> **상태: UI fix.** 운영자풀 / 모달 (pack-reveal-modal) 의 라벨 패턴 카드 이식.

## 사용자 보고

> "다나와 시세라고 말하고 다나와로 아직도 안밖꼈는데"
> "모달엔 박혀있다 했는데 카드에선 안 보임"

→ Wave 201 (다른 세션) 이 unopened 매물 = 다나와 anchor 박았고 admin-pool / pack-reveal-modal 라벨 표시. 사용자 reveal 카드엔 미적용.

## 변경

`src/components/user-reveal-dashboard.tsx` 의 카드 시세 표시 옆 ([L940-960 부근](../../src/components/user-reveal-dashboard.tsx:940)):

```tsx
{item.marketBasis?.medianPrice ? (
  <>
    <span>시세 {krw(medianPrice)}</span>
    {conditionClass === "unopened" ? (
      <span title="다나와 새 가격 anchor — 이 매물 미개봉">📍 다나와</span>
    ) : conditionClass === "mint" ? (
      <span title="번개 S급 매물 median">📍 번개 S급</span>
    ) : null}
  </>
) : null}
```

- unopened → "📍 다나와" (amber)
- mint → "📍 번개 S급" (emerald)
- 그 외 (clean/normal/worn/low_batt) → 라벨 X (모달은 "번개 중고 매물 median" 표시 — 카드는 공간 절약)
- terminal 매물 (sold/disappeared) → 라벨 숨김 (이미 strike)

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 변경 파일 에러 0
```

### 화면 예상

| condition | 카드 표시 |
|---|---|
| unopened (SE3 미개봉 등) | 시세 300,000원 **📍 다나와** |
| mint | 시세 X **📍 번개 S급** |
| clean / normal / worn | 시세 X (출처 라벨 X — 공간 절약) |
| terminal | strike-through 그대로 |

## 안전성

| 변경 영역 | 위험 |
|---|---|
| UI 한 분기 (카드 시세 옆) | ✅ visual only |
| 다른 컴포넌트 (모달/운영자풀) | ✅ 영향 X — 라벨 패턴 카드 이식만 |
| logic / sort / API | ✅ 영향 X |

→ whack-a-mole 위험 0.

## 미해결 (별 wave)

- Wave 188 (catalog → search query 자동 매핑) — 다른 세션 활발 진행 중. 충돌 위험 → 보류 유지.
- parser v48 reparse 자연 완료 대기 — 다른 세션 작업.
