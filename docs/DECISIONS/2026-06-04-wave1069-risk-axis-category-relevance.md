# 2026-06-04 Wave 1069 - 위험 신호 축 카테고리 적용성 정리

## 결정

- 상세보기/쉬운모드의 `위험 신호 점검`은 모든 상품에 고정 5축을 보여주지 않는다.
- `잠금/할부` 축은 폰, 태블릿, 스마트워치, 노트북처럼 계정 잠금/할부 확인이 실제 구매 체크리스트인 카테고리에만 노출한다.
- `배터리` 축은 배터리 효율/사이클을 구매자가 확인할 수 있고 가격 핵심 변수인 폰, 태블릿, 스마트워치, 노트북, 드론, 카메라에만 기본 노출한다.
- 이어폰/헤드셋류는 배터리 효율을 직접 볼 수 없으므로 `배터리 정상`, `배터리 효율 미공개`, `잠금/할부 정상` 같은 거짓 안심/혼동 문구를 보여주지 않는다.
- 단, 셀러 설명에 `배터리 빨리 닳음`, `충전 안됨`, `방전` 같은 명시 결함이 있으면 이어폰류라도 배터리 경고는 노출한다.

## 구현

- `src/lib/risk-score.ts`
  - `RiskAxisResult.applicable`을 추가했다.
  - `LOCK_RELEVANT_CATEGORIES`, `BATTERY_SENSITIVE_CATEGORIES`를 분리했다.
  - 비적용 카테고리는 해당 축을 `applicable: false`로 반환한다.
  - 이어폰/이어버드를 배터리 효율 미공개 대상에서 제거했다.
  - 명시 배터리 결함 표현을 더 넓게 감지하도록 보강했다.

- `src/components/risk-score-bar.tsx`
  - `applicable: false` 축은 팝오버와 미니바에서 렌더링하지 않는다.
  - 하단 설명을 `잠금/할부` 고정 예시에서 상품군별 확인 포인트 문구로 바꿨다.
  - 배터리 경고 액션 문구를 효율 수치 고정 확인이 아니라 충전 상태/작동 시간/하자 고지 확인으로 완화했다.

- `tests/risk-score-daangn-contract.test.ts`
  - 이어폰류에서 잠금/배터리 축이 숨겨지는지 계약 테스트를 추가했다.
  - 이어폰류라도 명시 배터리 결함은 경고로 남는지 테스트했다.
  - 노트북류는 잠금/배터리 효율 미공개 체크가 유지되는지 테스트했다.

## 검증

- `npx tsx --test tests/risk-score-daangn-contract.test.ts`
- `npx eslint src/lib/risk-score.ts src/components/risk-score-bar.tsx tests/risk-score-daangn-contract.test.ts`
- `npm run build`

## 보류

- `src/lib/counterfeit-checklist.ts`, `src/lib/category-brand-depth.ts`, 판매 도움말 쪽의 카테고리별 긴 안내 문구는 이번 화면의 직접 원인이 아니라서 건드리지 않았다.
- 킥보드처럼 배터리가 중요하지만 효율/사이클을 표준적으로 확인하기 어려운 카테고리는 별도 UX 기준이 필요하다.
