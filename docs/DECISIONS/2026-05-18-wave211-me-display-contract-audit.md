# Wave 211 — /me 표시 계약 전수 점검

## 배경

- 시간: 2026-05-18 17:35 KST
- 사용자 요청:
  - `/me` 페이지에서 카드가 보여주는 시세/차익/상태와 `상품 보기` 클릭 후 모달/상세가 보여주는 값이 서로 괴리되지 않도록 전수 점검.
  - 삭제/판매완료/숨김/신고성 disappear가 사용자 화면에서 갑자기 사라지는 대신 판매완료로 명확히 보이도록 유지.
  - 크론 병목과 무관하게 사용자가 `/me`를 보거나 상세를 열 때 발견한 최신 상태가 DB/pool에도 반영되는지 확인.

## 확인한 괴리

1. `/me` 카드와 `PackRevealModal`의 차익 기준이 달랐다.
   - 카드: request-time `marketBasis.medianPrice - price`.
   - 모달: reveal 당시 snapshot `expectedProfitMin/Max`.
   - 결과적으로 카드에서는 `추천 무효`인데 상품 보기 모달은 과거 양수 차익처럼 보일 수 있었다.
2. 모달의 차익 formatter가 음수에도 무조건 `+` prefix를 붙일 수 있었다.
3. `/me`의 `상품 보기` 버튼은 `initialPreviewMode="listing"`을 넘겼지만 모달은 guide mode만 자동 open 처리했다.
   - 결과적으로 상품 보기 클릭이 실제 상세 패널을 바로 열지 못했다.
4. 시세 출처 디버그 모달이 `/me`와 다른 기준으로 시세 출처/가격을 표시했다.
   - `skuMedian`과 `conditionClass` 추론 기반이라 다나와 reference 가격과 어긋날 수 있었다.
5. 시세 검증 메모 저장은 feedback endpoint에 bearer token을 보내지 않아 인증 실패 가능성이 있었다.
6. 상세 조회 시점에 매물이 사라지거나 판매완료로 확인되면 사용자 fallback만 반환하고 global DB/pool write-through를 하지 않았다.
7. 판매완료 숨김 toggle 상태에서 `현재 페이지 전체` 선택이 숨겨진 terminal row까지 선택할 수 있었다.

## 결정

1. `/me` 카드, `PackRevealModal`, detail preview 모두 현재 market basis를 우선 표시한다.
   - `marketBasis.medianPrice`가 있으면 `medianPrice - price`가 표시 차익의 source of truth.
   - snapshot은 current basis가 없을 때만 fallback.
2. `상품 보기`는 모달 오픈 후 listing detail panel까지 바로 열리게 한다.
3. 시세 출처 디버그 API도 `/me`와 같은 `marketBasisForCandidate`를 사용한다.
   - reference price 사용 시 `다나와 새상품 시세`와 실제 reference 가격을 같이 표시.
4. 상세 조회는 terminal 상태를 발견하면 global write-through를 수행한다.
   - `mvp_raw_listings`
   - `mvp_lifecycle_checks`
   - `mvp_candidate_pool.status = invalidated`
5. terminal row는 기본적으로 판매완료 tombstone으로 남기되, 사용자가 숨김 toggle을 켰을 때 선택/벌크삭제 state도 visible row 기준으로 맞춘다.

## 변경

- `src/components/user-reveal-dashboard.tsx`
  - 모달 seed에 현재 차익을 전달.
  - optimistic reveal도 실제 current gap 기준으로 stale 여부 계산.
  - terminal 숨김 시 visible item만 렌더/선택.
  - 숨긴 terminal row가 기존 선택 상태에 남지 않도록 pruning.
- `src/components/pack-reveal-modal.tsx`
  - current market gap 우선 표시.
  - 음수 차익 formatter 수정.
  - 추천 무효 badge 및 다나와/번개 S급 source badge 표시.
  - `상품 보기` 진입 시 listing detail panel 자동 open.
- `src/app/api/listings/[pid]/market-source/route.ts`
  - `/me`와 같은 shared market basis 산정 사용.
  - response에 display market price/source/label 추가.
- `src/components/market-source-debug.tsx`
  - header 시세 표시를 shared basis 값으로 교체.
  - feedback note 저장 시 bearer token 포함.
- `src/lib/pack-open.ts`
  - reveal detail fetch missing/sold 감지 시 terminal tombstone 반환.
  - 해당 상태를 raw/lifecycle/pool에 write-through.
- `src/app/api/packs/me/route.ts`
  - live verify에서 terminal sale status를 `SOLD`/`SOLD_OUT`로 정규화.

## 보류

- `/api/packs/me`와 `loadRevealListingDetail`의 terminal write-through helper 중복은 다음 refactor 후보.
- `/me`의 saved-money/feedback-activity 부가 API까지 같은 깊이로 재점검하는 작업은 별도 wave로 분리 가능.
- 브라우저 visual regression은 이번 변경이 Next build/type 레벨에서 끝나는 서버/표시 계약 수정이라 보류했다.

## 검증

- `npm run build`: 통과
- `npm run test:core`: 446/447 통과
  - 기존 실패 유지: `tests/wave159h-condition-fallback.test.ts`의 `target sample 부족 → fallback chain 진행` 케이스가 expected `worn`, actual `flawed`로 실패.
