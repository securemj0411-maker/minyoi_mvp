# launch-106 — 차익 음수 가드: profit_lost variant (판매완료 ≠ 손해)

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: 카드 클릭 → 모달 진입 직전 차익 재검증 + 음수면 invalidate + 신규 모달

## 배경

사용자가 active 매물 클릭 → 상세 모달 열림 → 모달 안 헤더에 "**판매완료**나 시세 갱신으로 차익이 사라졌어요" 표시.

매물은 active 인데 시세만 떨어져 차익 -가 된 케이스에서도 "판매완료" 단어가 노출 → 사용자 헷갈림.

코드 분석:
- `detail-access` endpoint 가 sold/disappeared 만 라이브 검증.
- 차익 음수는 검증 X → 모달 정상 open → 안의 헤더 카피만 노출.

## 변경

### 서버 (`/api/packs/pool/detail-access/route.ts`)

`verifyBeforeDetailAccess` 통과 후 POST handler 에서 추가 가드:
- `verifiedItem.expectedProfitMax <= 0` 면 `invalidateReadyPoolItem(pid, "profit_negative")` 호출.
- `not_ready` + `reason: "profit_lost"` 응답.

### 클라이언트 (`src/components/explore-client.tsx`)

- `DetailAccessLimitVariant` 에 `"profit_lost"` 추가.
- `DetailAccessResponse` 에 `reason?: string` 필드 추가.
- `openItemDetail` 응답 처리: `data.reason === "profit_lost"` → profit_lost variant 모달 (title "시세가 떨어져서 차익이 사라졌어요", ↓ 화살표 amber).

### 자동 복귀

별도 cooldown 박지 않음. `recovery-worker` (매 1분) 가 `RECOVERABLE_INVALIDATED_REASONS` 화이트리스트 매물 시세 재계산 → 차익 + 회복 시 자동 ready 복귀.

## 영향

- active 매물인데 차익 음수가 된 케이스에서 모달 안 열림 → 정직한 안내 ("시세 하락").
- "판매완료" 단어 ≠ "차익 손해" 명확 구분.
- recovery-worker 자동 복귀 → 시세 회복 시 다른 사용자한테 다시 노출.

## 후속

- launch-107 에서 sold_out 신고 voluntary invalidate 도 박힘 (다른 reason 패턴).
