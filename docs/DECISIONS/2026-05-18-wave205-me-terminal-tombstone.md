# Wave 205 — /me terminal 매물은 숨기지 않고 판매완료 tombstone으로 표시

## 배경

- 시간: 2026-05-18 15:24 KST
- Wave 204는 `/me` 재접속 시 삭제/판매/숨김 매물을 live verify하고 즉시 숨기는 방향이었다.
- 사용자 추가 요구: 갑자기 `/me` 물량 개수가 줄면 당황스럽기 때문에, 삭제/숨김/판매완료/신고성 제거처럼 더 이상 볼 수 없는 상품도 "판매완료된 상품"으로 명확히 보여줘야 한다.
- 신고/삭제 사유는 프론트에서 노출하지 않는다. 사용자가 "우리가 대충 추천했다"고 느끼지 않도록 내부 제거 사유를 숨기고 동일한 판매완료 tombstone으로 처리한다.

## 결정

1. `/api/packs/me`는 terminal row를 기본 응답에서 제거하지 않는다.
2. read-time live verify에서 `fetchDetail()`이 실패하거나 sold-out signal이 확인되면 DB는 terminal로 best-effort 보정하되, 응답에서는 해당 item을 `sold_confirmed`로 남긴다.
3. `/me` 프론트는 `sold`, `sold_confirmed`, `disappeared`를 모두 사용자에게 `판매완료`로 표시한다.
4. terminal card는 원 상품 제목/썸네일/시세/차익/상품 보기/공략 보기/위험도/근거 chip을 보여주지 않고, 회색 placeholder와 "판매완료된 상품" 안내만 표시한다.
5. terminal tombstone은 기본 표시한다. 사용자가 원하면 토글로 숨길 수만 있다.

## 변경

### API

`src/app/api/packs/me/route.ts`

- `TERMINAL_STATES`에 `sold_confirmed` 포함.
- 기존 terminal filter와 `includeTerminal=1` debug path 제거.
- `liveVerifyVisibleItems()`가 더 이상 hidden count를 반환하지 않음.
- live verify 결과:
  - `detail=null` → DB는 `disappeared`로 patch, 응답은 `listingState="sold_confirmed"`, `saleStatus="SOLD_OUT"`.
  - sold-out signal → DB는 `sold_confirmed`로 patch, 응답도 `sold_confirmed`.
  - 이미 terminal 상태인 row → 응답에 유지.
- total count는 terminal 포함 reveal count를 유지한다.

### UI

`src/components/user-reveal-dashboard.tsx`

- `disappeared`도 `판매완료` chip으로 표시.
- terminal 숨김 기본값을 `false`로 변경.
- terminal row는 별도 tombstone card로 early render:
  - placeholder thumbnail only.
  - title: `판매완료된 상품`.
  - 안내: `추천 당시 매물이 현재 판매완료되어 더 이상 열람할 수 없어요.`
  - 상품 보기/공략 보기 버튼은 렌더하지 않음.

## 보류

- terminal tombstone 전용 API 필드(`displayState`, `terminalReasonPublic`) 추가는 보류. 현재는 기존 `listingState`만으로 충분히 분기 가능하다.
- false terminal 방지를 위한 source health gate는 보류. Wave 204와 동일하게 사용자 노출 정확성을 우선하고, `fetchDetail()` 실패가 잦으면 별도 보강한다.
- 전체 페이지 밖 row의 live verify는 하지 않는다. 현재 페이지 로드 시 보이는 row만 확인한다.

## 검증

- `npm run build`: pass
- `npm run test:core`: 446/447 pass
  - 기존 실패 1건 유지: `tests/wave159h-condition-fallback.test.ts`
  - 실패 내용: `target sample 부족 → fallback chain 진행`, actual `flawed`, expected `worn`
