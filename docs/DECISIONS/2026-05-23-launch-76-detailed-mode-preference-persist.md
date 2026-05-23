# launch-76 — "앞으로 상세 리포트를 기본으로 보기" 영구 적용 fix

## 문제
사용자가 "앞으로 상세 리포트를 기본으로 보기" 버튼을 눌렀는데도
다음 매물을 클릭할 때마다 다시 쉬운모드(beginner guide)가 자동 표시됐다.

> "앞으로 상세 리포트를 기본으로 보기를 눌럿는데도 왜 계속 상품누를때마다 쉬운모드로 나와??"

## 원인
- `shouldAutoShowBeginnerGuide(pid)` 함수가 `localStorage["minyoi_modal_mode"]` 값을 전혀 확인하지 않았다.
- 버튼은 `minyoi_modal_mode = "detailed"`를 저장만 하고, 자동 표시 로직은 별개의 카운터
  (`BEGINNER_GUIDE_SEEN_COUNT`, `BEGINNER_GUIDE_SKIP_COUNT`)와 handled pid set만 체크.
- 결과: 사용자가 영구 선택을 했어도 새 매물마다 beginner guide가 다시 떴고,
  매번 `계속 쉬운모드 볼래요` 또는 다른 path로 빠져나가야 했다.

## fix
`src/components/pack-reveal-modal.tsx`:
1. 새 상수 `MODAL_MODE_STORAGE_KEY = "minyoi_modal_mode"` 추가 (line ~197).
2. `shouldAutoShowBeginnerGuide` 최상단에 짧은 guard 추가:
   ```ts
   if (window.localStorage.getItem(MODAL_MODE_STORAGE_KEY) === "detailed") return false;
   ```
3. 기존 string literal 3곳(`minyoi_modal_mode`)을 상수로 통일 — drift 방지.

## 영향
- detailed default를 선택한 사용자는 이제 모든 매물 클릭 시 바로 상세 리포트로 진입.
- 일반 신규 사용자(detailed 미선택)는 기존과 동일하게 자동 표시 → seen counter 누적.
- 다시 쉬운모드로 돌아가는 explicit UI는 별도 후속 과제(현재는 localStorage 직접 삭제 필요).

## 테스트
1. 모달 진입 → 쉬운모드 자동 표시 → "앞으로 상세 리포트를 기본으로 보기" 클릭.
2. 모달 닫고 다른 매물 클릭 → 쉬운모드 X, 바로 상세 리포트 표시 ✓
3. `localStorage.removeItem("minyoi_modal_mode")` → 다시 쉬운모드 자동 표시 ✓

Owner: caulee1227@gmail.com / 2026-05-23
