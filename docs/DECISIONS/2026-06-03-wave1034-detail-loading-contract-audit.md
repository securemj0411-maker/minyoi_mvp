# Wave 1034 — 상세 프론트 로딩 계약 감사

## 배경
- 사용자 질문: 판매주기 외에도 프론트에서 느리거나, 로딩 중 데이터를 사실처럼 말하는 계약 위반이 더 있는지 점검 요청.
- 직전 wave에서 쉬운모드 판매주기만 `analysisLoading`으로 분리했지만, 같은 패턴이 비교 매물/상세 리포트에도 남을 수 있었다.

## 발견
- 쉬운모드 `비교 매물` 단계도 분석 API 응답 전 `sampleCount=0` 임시 데이터를 보고 `시세 표본 부족`처럼 말할 수 있었다.
- 상세 리포트 상단의 `팔리는 속도` 타일도 분석 API 응답 전에는 타일이 숨거나 `표본 부족`으로 취급될 수 있었다.
- `/api/packs/pool/analysis`, `/api/packs/reveals/detail`은 `skuListingFlow` 부가 지표가 느려도 전체 analysis 응답을 기다리는 구조였다.
  - 판매주기/시세 UX에 핵심이 아닌 부가 지표가 응답 시간을 늘릴 수 있는 구조.

## 결정 / 구현
- 쉬운모드 비교 매물 단계:
  - 분석 중에는 `비교 기준을 불러오는 중이에요`, `확인 중`으로 표시.
  - 분석 완료 후에도 실제 표본이 부족할 때만 `표본 부족` 표현 사용.
- 상세 리포트 상단 판매속도 타일:
  - 분석 중에는 `확인 중`, `비교 기록 불러오는 중`으로 표시.
  - 분석 완료 후 실제 판매주기/표본 부족 여부 표시.
- analysis API:
  - `loadSkuListingFlow`를 `loadSkuListingFlowFast`로 감싸고 1.5초 optional timeout 적용.
  - timeout 시 `skuListingFlow=null`로 넘어가고 market/velocity 분석 응답을 붙잡지 않게 함.

## 보류 / 추가 후보
- `/api/listings/[pid]/market-source` 비교 매물 fetch와 `MarketHistoryChart`도 별도 네트워크 호출이라 체감 지연 가능성은 남아 있다.
- `/me` 과거 reveal 상세의 catch fallback은 `fallbackItem`을 찾고도 일부 필드에서 `selectedItem`을 직접 참조하는 작은 안정성 리스크가 있다.
- 위 둘은 이번 wave에서 파괴적 변경 없이 보류하고, 실제 사용자 체감/오류 로그가 있으면 별도 wave로 처리한다.

## 검증
- `npx tsx --test tests/easy-mode-analysis-loading-contract.test.ts tests/velocity-detail-cache-contract.test.ts tests/detail-analysis-latency-contract.test.ts`
  - 5 pass, 0 fail.
- `npm run build`
  - Next.js production build / TypeScript 통과.
