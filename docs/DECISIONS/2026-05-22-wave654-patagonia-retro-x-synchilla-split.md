# Wave 654 — Patagonia Retro X 신칠라/스냅T 분리 (clothing v26→v27)

## 발견

`clothing|patagonia_retro_x|jacket|b_grade` (49건, spread 8.75x — Wave 651+ cycle sample audit).

| pid | name | price |
|-----|------|-------|
| 370614206 | 파타고니아 딥파일 자켓 | 450,000 |
| 397192094 | 파타고니아 레트로 플리스 자켓 XL | 350,000 |
| 388991127 | [XL] 파타고니아 레트로x 파일플리스 99년도 빈티지 | 330,000 |
| 295502802 | 파타고니아 신칠라 스냅T 리젠그린 그레이 | 245,000 |
| 408890521 | 파타고니아 신칠라 xl | 230,000 |
| 386528851 | 파타고니아 신칠라 m | 220,000 |
| 408308007 | 파타고니아 신칠라 반다나 블루 L | 215,000 |

## 원인

기존 `clothing-patagonia-retro-x` SKU의 mustContain:
```ts
[["patagonia", "파타고니아"], ["retro x", "retro-x", "레트로x", "레트로 x", "retro", "레트로",
  "fleece", "플리스", "후리스", "synchilla", "신칠라", "snap-t", "파일"]]
```

= Retro X / Synchilla / Snap-T / 일반 fleece **모두 흡수**. 가격대 별도:
- Retro X: 23~35만
- Synchilla 스냅T: 16~22만
- 일반 신칠라: 12~20만
- 99년 빈티지 / 딥파일: 33~45만 (Wave 251에서 별도 narrow 박은 일부)

## 조치

1. **catalog**: mustContain 좁힘.
   ```ts
   [["patagonia", "파타고니아"], ["retro x", "retro-x", "레트로x", "레트로 x", "classic retro", "클래식 레트로"]]
   ```
   "synchilla"/"신칠라"/"snap-t"/"fleece"/"플리스"/"후리스"/"파일"/"retro" 단독 제거.

2. **mustNotContain**: 별도 라인 명시 차단.
   - `synchilla` / `신칠라` / `snap-t` / `스냅t` / `스냅 t`
   - `신칠라 스냅` / `신칠라스냅`

3. **parser**: `wave216-clothing-v26` → `v27`.
4. **tick-pipeline**: `clothing` → `v27`.
5. **invalidate**: `patagonia_retro_x|jacket|b_grade` priority 95~100.

## Why

multi-line broad SKU는 시세 spread 부풀림. 가격대 분리되는 라인은 narrow SKU split이 정답이지만, 빠른 fix로 broad에 흘려보내기 (catalog fallback). 신칠라 별도 SKU는 후속 wave에서 풀 확보 시 검토.

## How to apply

mustContain에 alias 묶음을 너무 광범위하게 박으면 별도 가격대 라인이 합쳐져 spread 부풀림. 모델명/시즌/표기 변형 차이 큰 라인은 mustContain narrow + mustNotContain 명시.

신칠라 매물 16~22만 풀 확보되면 별도 `clothing-patagonia-synchilla` SKU 신설.
