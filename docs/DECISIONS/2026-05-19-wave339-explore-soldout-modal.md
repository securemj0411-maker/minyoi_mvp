# 2026-05-19 Wave 339 — /explore Sold out 카드 + PackRevealModal 통합

사용자 결정 (Wave 338 후속):
- Sold out 마스킹 옵션 B (카드 그대로 + 🔴 오버레이) — FOMO 강화
- 카드 클릭 → PackRevealModal 통합 (`/me` 상세페이지와 동일 UX)

## 결정

### 1. Sold out 매물 응답 포함 (Task #5, 옵션 B)
- `/api/packs/pool` 응답에 ready 25 + 오늘 invalidated 5 = **총 30개**
- 순서 random 섞기 (sold out이 grid 중간에 자연스럽게 — 사용자 발견 + 후회)
- 카드 응답에 `soldOut: boolean` 필드
- 정책 결정: 옵션 B (그대로 + 오버레이)
  - 외부감사 race condition 우려는 invalidated 매물만 (`status=invalidated`, 이미 사라진 매물) → 실시간 정보 누수 없음
  - 단순 "다른 사용자가 잡음" 시각화

### 2. ExploreClient sold out 카드 UI
- 사진 opacity 50%
- 본문 opacity 60%
- 차익에 `line-through` (취소선)
- 오버레이 (z-10):
  - rose 600 칩 "🔴 다른 사용자가 잡음"
  - sub "즉시 알림 있었으면 잡을 수 있었어요"
- 클릭 비활성 (`disabled={isSoldOut}`)

### 3. PackRevealModal 통합 (Task #9)
- `PoolItem → RevealCard` 매핑 함수 `poolItemToRevealCard()`
- minimal `marketBasis` (skuMedian만, sampleCount=0 등)
- `velocityBasis: null` (lazy-load 안 함)
- `savedDetail` = freeShipping/sellerReviewRating 등 그대로
- 카드 클릭 시 `selectedPid` state → modal open
- `onLoadDetail` = noop (마켓 데이터 더 안 가져옴, 추후 별도 endpoint 가능)
- 다른 콜백 (onFeedback, onLinkClicked, onRetry) = noop (explore는 단순 browsing)
- `result.reveals = [selectedCard]` single card

### 4. 정책 부합 메모

- **외부감사 race condition**: invalidated 매물은 이미 종료 (DB status). 사진/시세 노출해도 실시간 매물 가로채기 위험 없음. 단 invalidated 상태가 sold out 외에 다른 이유(중복/불량 매물 등)도 포함 가능 — 정확한 invalidated 사유 노출은 신중. 오버레이는 단순 "잡혔다"로만.
- **메모리 룰 일반인 친화**: FOMO는 강하지만 "선택지" 줌 (cooldown 30min, paywall 곧 출시 안내). 즉시 결제 강요 X.

## 변경 파일

- 수정: `src/app/api/packs/pool/route.ts`
  - `READY_SLOTS=25` / `SOLD_OUT_SLOTS=5` 상수
  - 두 쿼리 병렬 (ready + invalidated)
  - random 섞기
  - `soldOut: boolean` 필드 전파
- 수정: `src/components/explore-client.tsx`
  - `poolItemToRevealCard()` 매핑
  - PackRevealModal import + state 관리
  - sold out 카드 UI (오버레이 + opacity)
  - 카드 button → 클릭 시 modal open

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 보류 (다음 wave)

- 카드 클릭 시 marketBasis lazy-load (`/api/packs/pool/detail?pid=X` 신규 endpoint)
  - 현재는 minimal 데이터로 모달 동작. 시세 그래프 / velocityBasis 등 미완.
- Phase 2 결제 (PG + 카톡 알림톡)
