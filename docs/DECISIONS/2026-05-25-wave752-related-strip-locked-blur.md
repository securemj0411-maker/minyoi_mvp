# Wave 752 — 상세 모달 "다른 수익 매물" strip 잠금 매물 블러 + 워터마크

- 시간: 2026-05-25 KST
- 트리거: 사용자 보고 — "상세페이지에 다른 수익 매물 여기부분은 블러랑 워터마크 처리 안된거임"

## 발견

`pack-reveal-modal.tsx::RelatedRevealStrip` (모달 안 "다른 수익 매물" horizontal scroll strip):
- explore-client 에선 잠금 매물 (`lockedPreview`) 이면 photo 블러 + 차익/가격 숨김 + 카테고리 아이콘 overlay 처리.
- **그러나** 같은 풀 매물이 모달의 strip 에 나타날 때는 photo 그대로 + 차익 그대로 표시. 정보 누출.
- 결제 안 한 매물 정보를 모달 strip 에서 다 보여줘서 게이트 우회 가능.

## 변경

### `src/components/pack-reveal-modal.tsx`
- `RelatedRevealItem` 타입에 `locked?: boolean` + `category?: string | null` 추가.
- `RelatedRevealStrip` render:
  - `isLocked=true` 면 photo `scale-105 blur-[2px]` + 카테고리 워터마크 (size 48 중앙) + "상세에서 확인" 좌하단 pill + 어두운 gradient overlay.
  - name → "상세에서 공개" 로 치환.
  - 차익/매입가 → "상세에서 확인" 텍스트로 치환.
  - `ConditionPhotoBadge` 도 잠금 시 숨김 (condition 정보 누출 방지).
- 언락 매물은 기존 그대로 (Wave 751 corner watermark + 차익/매입가 표시).

### `src/components/explore-client.tsx`
- `relatedItems` useMemo 에서 각 매물별 `locked` 계산:
  ```ts
  const teaserLocked = isFeedTeaserLocked(it);
  const exactUnlocked = !teaserLocked || scrapOnly || savedPidSet.has(it.pid) || openedDetailPids.has(it.pid);
  const locked = !exactUnlocked;
  ```
- feed 카드의 `lockedPreview` 와 정확히 동일 로직.
- deps array 에 `scrapOnly`, `savedPidSet`, `openedDetailPids` 추가.

### `src/components/user-reveal-dashboard.tsx`
- `relatedModalItems` 는 이미 user 의 reveal 된 매물만 → `locked` 미지정 (= false, 기존 동작 유지). 변경 없음.

## 검증
- `npx tsc --noEmit` — 내 2 파일 0 에러
- explore-client 의 feed 카드 locked 매물 vs 모달 strip 의 같은 매물 동일 처리 (블러 + 카테고리 배지 + 차익 숨김)

## 위험
- 잠금 strip 카드는 정보 거의 0 (이름 + 카테고리 만) — 사용자가 클릭해서 unlock 결정 유도하는 게 목적. 정보 누출 없음.
- user-reveal-dashboard 는 locked 미지정 → 기존처럼 모두 노출 (자기가 이미 revealed 한 매물이라 정상).

## 다음
- 운영 후 클릭율 확인 — locked strip 카드가 unlock 결제 전환에 효과 있는지.
