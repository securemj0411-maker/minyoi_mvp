# 2026-05-17 나의 상품 — 선택 삭제 + 전체 삭제 기능

## 사용자 요청

> "그리고 나의 상품에 내 목록들 삭제할수있도록 하자 전체 삭제도 있고 뭔말인지 알지? 선택해서 삭제도있고 다만 모든 상품 옆에 삭제버튼은 ㄴㄴ UX안좋을듯"

핵심:
- 매물 삭제 가능
- 전체 삭제 + 선택 삭제 둘 다
- **개별 매물 옆 X 버튼 X** (UX 안 좋음)

## 박은 변경

### Backend (새 API)

`src/app/api/packs/reveals/delete/route.ts` (POST):
- body: `{ pids: number[] }` — 선택 삭제
- body: `{ all: true }` — 전체 삭제
- `mvp_pack_reveals` + `mvp_reveal_feedback` 둘 다 DELETE (user_ref 본인 매물만)
- 진짜 DELETE (soft delete 아님)
- rate limit: 20회/분, max 500 pid/요청

### UI (user-reveal-dashboard)

**header 우상단**:
- "☑️ 선택" 버튼 (선택 모드 진입)
- "🗑️ 전체 삭제" 버튼 (confirm 모달)

**전체 삭제 confirm 모달**:
- 총 N건 명시
- "복구 불가" 경고
- 취소 / 전체 삭제 버튼

**선택 모드 ON**:
- 카드 별 체크박스 (absolute left-top)
- 카드 영역 클릭 시 토글 (체크박스 정확히 클릭 안 해도 OK)
- 선택된 카드 rose border + ring highlight
- 하단 fixed floating bar:
  - "N개 선택됨"
  - "현재 페이지 전체" 버튼
  - "선택 해제" 버튼
  - "🗑️ N개 삭제" 버튼 (rose)

**삭제 후**: 자동 list refresh + 선택 모드 종료.

## Trade-off

| 항목 | 결정 |
|---|---|
| 진짜 DELETE vs soft delete | 진짜 DELETE — undo 없음. soft delete (hidden_at column) 박으려면 schema migration 필요. 사용자 의도 = "삭제" 명시 |
| feedback 같이 delete | YES — 매물 삭제 시 feedback 도 같이 (사용자 의도 = "내 dashboard 에서 안 보이게") |
| exposure_count 변경 | NO — 사용자 본 fact 유지 (다음에 같은 매물 카드 뽑힘 가능성에 영향 X) |
| individual X 버튼 | NO — 사용자 명시 ("UX 안 좋음"). 선택 모드 toggle 로 안전 |

## 후속 가능 작업

- **soft delete (`hidden_at` column)** — 별도 schema migration. undo 기능 가능
- **삭제 후 undo toast** — soft delete 박으면 가능
- **선택 모드 단축키** (Cmd+A 전체, ESC 취소) — desktop UX 강화

## Test

288/288 pass.

## Commit

`a937c68` 나의 상품: 선택 삭제 + 전체 삭제 기능
