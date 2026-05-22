# 2026-05-22 — Launch CRITICAL #3: verdict 라벨 3 화면 통일

## audit 발견 (TRUE positive)
같은 `buyPriceGuidance.verdict` 값인데 3 화면이 다른 단어:
- `admin-pool-browser.tsx:582-588` — "차익 충분 / 차익 OK / 협상 권장 / 차익 박함"
- `user-reveal-dashboard.tsx:1604-1610` — "충분 / 괜찮음 / 협상 권장 / 협상 필수"
- `pack-reveal-modal.tsx:5302-5311` — "매입 OK / 협상 권장 / 협상 필수"

**메모리 룰 "매물 카드 UI 변경 시 3 화면 다 적용" 직접 위반.**
사용자가 카드 → 모달 클릭 시 같은 매물 다른 단어 → 신뢰 흔들림.

## fix — 단일 출처 export
`src/lib/buy-price-guidance.ts` 에 `VERDICT_LABELS` + `verdictUiLabel()` 추가:

```ts
export const VERDICT_LABELS: Record<BuyPriceVerdict, VerdictUiLabel> = {
  great: { card: "매입 OK", short: "매입 OK", tone: "em" },
  good:  { card: "매입 OK", short: "매입 OK", tone: "em" },
  fair:  { card: "협상 권장", short: "협상", tone: "amber" },
  tight: { card: "협상 필수", short: "협상!", tone: "rose" },
};
```

`card` = 풀 라벨 (카드 chip / 모달 verdict tier 공통).
`short` = 좁은 공간용 (모바일).
`tone` = em/amber/rose — 3 화면 다 색상 일관.

## 채택 카피 — "매입 OK / 협상 권장 / 협상 필수"
- 사용자 합의 (옵션 A): 모달이 이미 쓰던 카피. 가장 사용자 노출 많음.
- "OK" 짧고 토스 톤. "차익 박함" 같은 부정 단어보다 명확한 행동 지시 ("협상 필수").

## 변경 파일
- `src/lib/buy-price-guidance.ts` — `VERDICT_LABELS` + `verdictUiLabel()` 추가
- `src/components/admin-pool-browser.tsx` — verdictUiLabel import + 사용
- `src/components/user-reveal-dashboard.tsx` — 동일
- `src/components/pack-reveal-modal.tsx` — 동일 (counterfeit "조건부" 접두만 유지)

## 영향
- 운영자 화면 카피 변경 (admin 익숙해져야 함)
- 사용자 화면 (user-dashboard) 카피 변경 ("충분/괜찮음" → "매입 OK")
- 모달은 그대로

## tone 보강
- admin / user 의 `tight` (협상 필수) verdict 가 이전엔 amber 톤 fall-through 였음
- 이제 rose 톤 명시 — 3 화면 다 동일 색 분기

## 메모리 룰 룰 확실히
> "매물 카드 UI 변경 시 3 화면 다 적용 — 운영자풀 + 사용자 reveal + 나의 상품"

향후 카드 verdict / chip / 라벨 변경 시 `buy-price-guidance.ts` 의 `VERDICT_LABELS`
한 곳만 수정하면 3 화면 동시 반영.

## 검증
- TypeScript compile clean (`npx tsc --noEmit`)
- grep "차익 충분" 결과 0건 (admin 의 옛 카피 제거 확인)
