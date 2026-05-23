# 2026-05-22 Wave 541 — 내 피드백 활동/안 잃은 돈 스켈레톤 베이지 잔재 제거

## 발견
- `/me` 사용자 대시보드 첫 진입 시 "내 피드백 활동" 영역이 베이지(`#efe7d7`) 스켈레톤 → 로드 후 민트(`#f3f7f1`) shell 로 팍 튀는 transition 사용자 보고.
- Wave 540 라이트 테마 전환 때 베이지 제거했는데 스켈레톤 두 곳에 `bg-[#efe7d7]` 잔재.
- `tests/light-theme-contract.test.ts`는 `my-feedback-activity` / `saved-money-counter`를 검사 대상에 포함하지 않았고, 금지 hex 리스트에도 `efe7d7` 누락 → 가드 빠져나감.

## 변경
- `src/components/my-feedback-activity.tsx:132` — 로딩 스켈레톤 `bg-[#efe7d7] dark:bg-zinc-800` → 로드 shell 과 동일한 `border-2 border-blue-100 bg-[#f3f7f1] dark:border-emerald-900/40 dark:bg-emerald-950/20`. transition 시 색 튐 0.
- `src/components/saved-money-counter.tsx:69-70` — 좌/우 스켈레톤이 로드 후 emerald/amber 2톤이 되므로 스켈레톤도 분리. 좌 `border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30`, 우 `border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30`.
- `tests/light-theme-contract.test.ts` — `lightSurfaceFiles`에 `my-feedback-activity`, `saved-money-counter` 추가. 금지 bg hex 패턴에 `efe7d7` 추가.

## 검증
- `npx tsx --test tests/light-theme-contract.test.ts` 통과 (1/1).
- `grep -rn "bg-\[#efe7d7\]\|...\|ebe6dc" src/` 결과 0건 — 베이지 잔재 다른 곳에 없음.

## 위험
- 없음. 스켈레톤은 로딩 ~수백 ms 잠깐 보이는 박스라 UX 외 영향 없음.
- contract test 강화로 다음 누군가 베이지 다시 박으면 즉시 fail.

## 다음
- (선택) `saved-money-counter`는 현재 src/ 안에서 import 되는 곳 없어 dead code 후보. 별도 wave 에서 정리 또는 활성화 결정.
