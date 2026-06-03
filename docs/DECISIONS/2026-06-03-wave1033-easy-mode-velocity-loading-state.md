# Wave 1033 — 쉬운모드 판매주기 로딩 상태 분리

## 배경
- 사용자 제보: 쉬운모드 판매주기 페이지에서 처음에는 `표본 부족/없음`처럼 보이다가 몇 초 뒤 `2.4일` 같은 실제 판매주기로 바뀜.
- 실제 원인은 DB가 늦게 계산한다기보다, 모달이 임시 카드로 먼저 뜬 뒤 `/api/packs/pool/analysis`를 백그라운드 호출하는 구조에서 분석 중 상태를 UI가 구분하지 못한 것이다.

## 결정 / 구현
- `PackRevealModal`에서 분석 요청 중인 pid를 `analysisLoadingPids`로 추적한다.
- 쉬운모드 step 생성에 `analysisLoading` context를 전달한다.
- 판매주기 step과 판매주기 숫자 카드가 분석 중일 때는 다음처럼 표시한다.
  - 제목: `거래 기록 데이터를 받는 중이에요`
  - 숫자 카드: `확인 중`, `분석 진행 중`, `잠시만요`
- 분석 완료 후에도 표본이 부족한 경우에만 `표본 부족`을 표시한다.

## 보류 / 주의
- 이번 wave는 UI 상태 분리만 한다.
- `/api/packs/pool/analysis` 자체 latency 최적화는 별도 병목 작업으로 분리한다.
- 이미 분석이 로드된 카드(`velocityBasis`, `marketBasis.computedAt`, `skuListingFlow`)는 loading으로 되돌리지 않는다.

## 검증
- `npx tsx --test tests/easy-mode-analysis-loading-contract.test.ts tests/velocity-detail-cache-contract.test.ts`
  - 3 pass, 0 fail.
- `npm run build`
  - Next.js production build / TypeScript 통과.
