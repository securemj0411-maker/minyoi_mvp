# Wave 750 — 득템 점수 (Deal Score) 재설계

- 시간: 2026-05-25 KST
- 트리거: 사용자 보고 — "득템점수 저거 너무 계산이 이상한거같은데 왜 100점만점에 100점이 저렇게 많은건지"

## 발견

### 1. 기존 공식 (pack-reveal-modal.tsx::calculateDealScore)
```
base 50
+ profitPct × 1.5 (cap +40)   ← 차익률 27%+ 면 무조건 cap
+ confidence ≥0.8 → +8
+ sellerRating ≥4.8 → +6
+ sampleCount ≥20 → +4
= max 108 → clamp 100
```

문제: 미뇨이 풀은 30%+ 차익이 보통이라 거의 모든 매물이 +40 cap 도달. 차익 27% vs 200% 가 점수 동점. 100 점이 흔해서 변별력 0.

### 2. 두 번째 공식 (preview-detail/page.tsx::calcDealScore) — 다른 곳에 다른 공식 + 버그
```
base 10
+ profitPct × 0.6 (cap 40)
+ confidence × 0.2 (cap 20)   ← BUG: confidence 0~1 인데 ×0.2 → 최대 +0.2
+ sampleCount × 0.5 (cap 15)
+ sellerRating/5 × 15 (cap 15)
```

버그 두 가지:
1. confidence 가 0~1 인데 `× 0.2` 라 점수 영향 거의 0 (max +0.2). 의도는 `× 20` 이었을 듯.
2. pack-reveal-modal 과 완전 다른 공식 — 같은 매물이 두 화면에서 다른 점수.

## 변경

### 신규 파일 `src/lib/deal-score.ts`
통합 공식 + 분포 검증:
```
base 30
+ profit (max 35): profitPct × 0.7, cap 35 → 50% 차익 시 cap
+ confidence (max 15): 0.9 → 15, 0.8 → 12, 0.7 → 8, 0.5 → 4
+ samples (max 12): 50+ → 12, 30+ → 9, 15+ → 6, 7+ → 3
+ seller (max 8): 4.9 + 10리뷰+ → 8, 4.7 + 5+ → 5, 4.5+ → 2
```

분포 시뮬레이션:
| 케이스 | profit | conf | sample | seller | total |
|---|---:|---:|---:|---:|---:|
| typical | 25% | 0.75 | 12 | 4.6 | **60** |
| great | 40% | 0.85 | 25 | 4.9 | **81** |
| amazing | 60% | 0.92 | 40 | 4.95 | **97** |
| unicorn | 80%+ | 0.95 | 100 | 4.99 | **100** |

100 = 차익 50%+ AND conf 0.9+ AND sample 50+ AND seller 4.9+ 다 만족. 진짜 unicorn 만.

라벨:
- 90+: 최고 (blue-700)
- 80+: 강추 (blue-600)
- 70+: 좋음 (blue-500)
- 60+: 양호 (zinc-600) ← 신규
- <60: 보통 (zinc-500)

### 호출처 통합 (2개)
1. `src/components/pack-reveal-modal.tsx` line ~920 — `calculateDealScore(card)` 가 `computeDealScore({...})` 호출하도록 변경. 인라인 공식 폐기.
2. `src/app/me/preview-detail/page.tsx` line ~518 — 같은 패턴. confidence bug 제거.

## 검증
- `npx tsc --noEmit` — deal-score.ts / pack-reveal-modal.tsx (내 영역) / preview-detail/page.tsx 0 에러
- 분포 시뮬레이션 (위 표) 으로 100 점 도달 조건 확인

## 위험
- 사용자가 보는 점수가 일제히 내려감 — 기존 100 점 매물 다수가 80~95 로 재라벨링.
- UX 영향: 100 점 사라져 신뢰감 ↓ 가능. 그러나 "100 점이 너무 많다" 가 원래 문제였으므로 의도된 변화.
- 라벨 임계 (90/80/70/60) 은 신규 공식 기준으로 의미 있는 분포 만들도록 설정. 운영 후 재조정 가능.

## 다음
- 옵션: 운영 데이터로 분포 측정 (실제 reveal 들의 score 분포 — 90+ %, 80+ %, etc). 필요하면 임계 미세 조정.
- 옵션: 점수 옆에 "차익 ${pct}%" mini chip 표시해서 점수 보다 차익률 자체를 사용자에게 직접 보여주기 (점수는 종합 지표, 차익률은 단일 직관 지표).
