# Wave 212 — /me 대시보드와 상세 모달 UI/UX 정리

## 배경

- 시간: 2026-05-18 18:10 KST
- 사용자 요청:
  - `/me` 페이지와 상품 클릭 시 뜨는 모달을 더 유저 친화적으로 다듬기.
  - 기능을 제거하지 말고 UI적 위계와 UX를 개선하기.

## 결정

1. `/me` 대시보드 상단에 현재 페이지 요약을 추가한다.
   - 표시 중
   - 판매중
   - 평균 차익
   - 추천 무효
2. 카드에서는 차익을 작은 chip 중 하나가 아니라 주요 판단 블록으로 올린다.
   - “현재 차익” 라벨과 금액을 크게 표시.
   - 추천 무효는 rose tone으로 명확히 분리.
   - 퍼센트 차익은 보조 pill로 유지.
3. 검색/정렬/보기 전환 컨트롤은 더 밝고 명확한 input surface로 정리한다.
4. 모달의 상품 카드도 같은 “현재 차익” 중심 구조로 맞춘다.
   - `/me` 카드와 모달의 시각 언어가 달라 보이지 않게 통일.
5. `상품 보기` 상세 패널은 판매 상태, 주요 지표, 판매자 정보를 먼저 보여준다.
   - 판매완료 시 사진 grayscale + “판매완료” overlay.
   - 조회/찜/댓글/배송 요약.
   - 판매자 이름/별점/후기 수.

## 변경

- `src/components/user-reveal-dashboard.tsx`
  - 상단 summary metric strip 추가.
  - 카드 thumbnail/grid 간격 확대.
  - 현재 차익 블록을 별도 강조 영역으로 분리.
  - 추천 무효/정상 차익 색상 체계 정리.
  - verdict input도 current profit 우선으로 맞춤.
- `src/components/pack-reveal-modal.tsx`
  - 모달 카드의 current profit block 재구성.
  - 모달 폭/높이를 약간 확장해 상세 패널과 분석 카드가 덜 답답하게 표시되도록 조정.
  - listing detail panel에 상태/지표/판매자 요약 추가.

## 보류

- 실제 로그인 세션이 필요한 `/me` 내부 데이터 화면의 브라우저 클릭 검증은 별도 세션/계정에서 추가 확인 필요.
- 전체 `/me` 레이아웃을 card-heavy 구조에서 운영툴형 full-width layout으로 바꾸는 큰 리디자인은 보류.
- lucide 등 아이콘 라이브러리는 현재 dependency에 없어 추가하지 않았다.

## 검증

- `npm run build`: 통과
- `npm run test:core`: 446/447 통과
  - 기존 실패 유지: `tests/wave159h-condition-fallback.test.ts`의 `target sample 부족 → fallback chain 진행` 케이스가 expected `worn`, actual `flawed`로 실패.
- Browser:
  - `http://localhost:3000/me` 로딩 확인.
  - 비로그인 상태에서는 홈/로그인 유도 화면으로 노출됨.
  - console error 없음.
