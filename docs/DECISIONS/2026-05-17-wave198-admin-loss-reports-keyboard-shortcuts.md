# Wave 198 — 운영자 검수 페이지 keyboard shortcut

## 사용자

> "B 다하면 C 개지릴듯"

→ C 박음 — 운영자가 검수 속도 ↑.

## 박은 것

### `/cau~~/loss-reports/loss-reports-client.tsx`

#### 7개 shortcut

| 키 | 동작 |
|---|---|
| `j` / `↓` | 다음 신고로 focus |
| `k` / `↑` | 이전 신고로 focus |
| `e` | 응답 입력 (textarea focus) |
| `r` | ✅ 보정 완료 — draft 5자+ 박힌 상태면 즉시 submit, 아니면 `e` 처럼 응답 입력 모드 진입 |
| `d` | ❌ 기각 — `window.confirm("pid X 신고 기각?")` 후 submit |
| `Esc` | 응답 입력 / 모달 / 도움말 닫기 |
| `?` | 도움말 modal toggle |

#### 동작 흐름

1. 페이지 진입 → 첫 신고 자동 focus (파란 ring 강조)
2. `j`/`k` 로 navigation — 자동 scroll into view
3. `e` 또는 `r` → 응답 textarea 자동 focus
4. textarea 입력 중 → Esc 외 단축키 비활성 (입력 우선)
5. 응답 5자+ → `r` 즉시 보정 완료 submit
6. 클릭으로도 focus 변경 가능 (mouse + keyboard 혼합)

#### UI 추가

- **focused 카드**: `ring-2 ring-blue-400` 강조
- **floating ? 버튼**: 우하단 z-40 — 클릭/`?` 키로 도움말 modal
- **도움말 modal**: 7개 단축키 + kbd 스타일 + 사용 안내

## 비파괴 검토

- keyboard event listener `useEffect` cleanup 박힘 (unmount 시 제거)
- textarea / input focused 시 단축키 무시 (입력 우선)
- 기존 클릭 동작 모두 유지
- 기존 응답 입력 / submit 흐름 변경 0 — shortcut 은 동일 함수 호출

## Trade-off

### Pros
- 운영자 검수 속도 **체감 2~3배** (특히 pending 많을 때)
- vim 스타일 (`j`/`k`) — 익숙한 운영자 친화
- mouse + keyboard 둘 다 작동
- 응답 5자 임계 그대로 (resolve)

### Cons
- 단축키 학습 필요 — `?` 도움말 박힘으로 완화
- `r` (resolve) 조건부 — 사용자가 학습 필요 (draft 박혀있어야 즉시 submit)
- 모바일 X — 키보드 없으면 영향 0

## Test

`npm run test:core`: **405/405 pass**.

## 사용 시나리오 (운영자 morning routine)

1. 텔레그램 운영자 brief 보기 — "검수 대기 N건" 인지
2. `/cau~~/loss-reports` 진입 — pending 필터 (기본)
3. `e` → textarea focus
4. 응답 작성 ("배터리 검수 보정 완료")
5. `r` → 즉시 보정 완료 submit
6. `j` → 다음 신고
7. 반복

→ 1건당 10초 (이전 클릭 위주 30초+ 비교).

## Follow-up

1. **다른 운영자 페이지 일관성** — `feedback-stats`, `회원 목록` 에도 같은 패턴 박을지
2. **shortcut 다국화** — `i` interested / `b` bought 등 (다른 feedback type 도 향후)
3. **bulk action** — `Shift+J/K` 다중 선택 + `R/D` 일괄 처리 (검수 폭증 시)

## Linked

- `2026-05-17-wave182-saved-money-counter-loss-report.md` (검수 페이지 첫 구현)
- `2026-05-17-wave188-feedback-stats-admin-dashboard.md`
