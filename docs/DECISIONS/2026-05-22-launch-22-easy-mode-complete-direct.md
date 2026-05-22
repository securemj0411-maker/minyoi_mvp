# 2026-05-22 — Launch fix: 쉬운모드 끝까지 본 사용자 → 바로 상세 (모달 skip)

## 사용자 짚음
> "쉬운모드에서 마지막까지 다 가서 상세리포트보기 하면 왜 기존에 스킵하는거에 나오는 모달이
>  같이나옴?? 일단 끝까지 본사람은 바로 상세리포트 가게 해줘야지 왜 중간에 스킵하는 사람한테
>  알려주는 안내를?"

## 원인
`pack-reveal-modal.tsx:6367 advanceBeginnerGuide` 의 maxIndex 분기:
- `requestDetailReportModeChoice("easy_mode_complete")` 호출 → DetailReportModeChoiceModal 띄움
- 이 모달 = "이번만 / 앞으로 기본 / 계속 쉬운모드" 3-button 선택
- skip 누른 사용자도 같은 모달 띄움 (당연 — 정보 못 본 상태라 안내 필요)
- 단 **끝까지 본 사용자** 도 같은 모달 띄움 = 짜증

## fix
`advanceBeginnerGuide` 의 maxIndex 분기를 inline 처리:
- `recordBeginnerGuideCompleted` 호출 (seen count ↑)
- `dispatchEvent("minyoi:modal-mode-changed", { mode: "detailed" })` — 이번만 detailed
- `setBeginnerGuideVisible(false)` + `setBeginnerGuideStep(0)`
- tracking: `easy_mode_completed` + `detail_report_opened` 그대로
- modal 호출 X

skip 흐름 (`skipBeginnerGuide` → `requestDetailReportModeChoice("easy_mode_skip")`) 은
그대로 유지 — skip 사용자 = 정보 못 본 상태라 "앞으로 기본 detailed 로 보기" 옵션 안내 유의미.

## 영향
- 코드: pack-reveal-modal.tsx advanceBeginnerGuide
- DB / env: X
- UI: 끝까지 본 사용자 = 마지막 step 의 "이 매물 자세히 보기" 클릭 → 바로 detail.
  중간에 skip 누른 사용자 = 모달 그대로 (skip count 기록 + "앞으로 기본" 옵션 안내)

## 메모리 룰
- 일반인 친화: 끝까지 본 사용자 frustration ↓
- decision log: 이 파일
