# Wave 1068 — Membership feed copy cleanup

## Decision

- 추천 피드는 이제 승인된 멤버십 사용자만 볼 수 있으므로, 기존 teaser/paywall 시절 문구를 제거했다.
- 피드 카드에서 제거한 문구:
  - `상세 무제한`
  - `시세 잠김`
  - `정확 시세 잠김`
  - `상세에서 제목·가격 공개`
  - `판매자 정보 상세 확인`
- 피드 카드 가격 정보는 숨김/밴드 대신 실제 값으로 노출한다.
  - `매입 {price}`
  - `시세 {skuMedian}`
- 당근 매물은 직거래가 기본이므로 피드의 `직거래만` chip과 상세 열기 전 direct-only 확인 modal을 띄우지 않는다.
- 상세/쉬운모드 비교매물의 `판매완료` 표시는 중복을 제거하고 더 잘 보이는 pill로 통일했다.
- 당근 재판매 문구는 `당근 직거래` 반복 대신 `당근`/`당근 판매`/`당근 재판매 기준`으로 낮췄다.

## Verification

- `rg`로 제거 대상 문구 0건 확인.
- `npx eslint src/components/explore-client.tsx src/components/pack-reveal-modal.tsx`
  - 신규 error 없음.
  - 기존 unused/hook warning만 남음.
- `npm run build`
  - 성공.

## Deferred

- `ExploreClient` 내부에 paywall/free-detail 관련 레거시 state/helper가 일부 남아 있다.
- 이번 wave는 사용자에게 보이는 피드/상세 카피와 가격 노출만 정리했다. 라우트/서버 access 정책 정리는 별도 wave에서 더 작게 볼 수 있다.
