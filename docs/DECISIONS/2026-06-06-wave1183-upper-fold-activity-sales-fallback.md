# 2026-06-06 wave1183 - 상세 상단 수요·공급 타일 판매감지 fallback

## 배경
- 상세 상단 지표판은 원래 `수요 · 공급`, `평균 판매속도`, `거래 안전` 3개 타일로 설계됐다.
- launch-84에서 표본 부족 타일을 숨기도록 바꾸면서, `수요 · 공급`이 `데이터 부족`이면 타일 자체가 빠지게 됐다.
- 그런데 일부 SKU는 판매속도 계산에는 `최근 7일 판매 N건`이 들어오지만, active listing sample 또는 supply flow가 없어 `수요 · 공급`만 `데이터 부족`으로 떨어졌다.
- 그 결과 사용자는 판매속도 근거를 보고 있는데도 상단 지표가 2개로 줄어든 것처럼 보여 회귀로 느꼈다.

## 결정
- `marketActivityDisplay`에서 active sample/supply flow가 없어도 `soldRecent`가 있으면 판매감지 fallback을 사용한다.
- 최근 판매감지 5건 이상이면 `최근 판매감지 활발`, 1건 이상이면 `최근 판매감지 누적 중`으로 표시한다.
- 완전히 판매감지, active sample, supply flow가 모두 없는 경우에만 기존처럼 `데이터 부족`으로 두고 타일 숨김 규칙을 유지한다.

## 보류
- 찜/채팅 수요 신호는 아직 수집하지 않으므로 “수요 활발” 같은 단정 문구는 쓰지 않는다.
- 장기적으로는 active/sold/supply를 worker 단계에서 하나의 market activity snapshot으로 정규화해 피드와 상세가 같은 값을 쓰게 한다.

## 검증
- `npm run lint -- src/components/pack-reveal-modal.tsx`
- `npm run build`
