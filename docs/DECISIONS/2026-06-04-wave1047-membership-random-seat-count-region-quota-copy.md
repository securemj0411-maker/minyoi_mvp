# 2026-06-04 Wave 1047 — membership random seat count and region quota copy

## Trigger

선공개 300명 중 몇 명이 찼는지는 실제 DB count보다 160명 이상 랜덤 진행률로 보여주고, 지역 티오 확인은 신청자가 자기 지역 티오를 조회하는 느낌이 나야 한다는 피드백이 있었다.

## Decisions

- `/plans`의 선착순 현황은 실제 `mvp_membership_applications` count를 쓰지 않는다.
- 선착순 현황은 매 렌더마다 161~233명 사이로 표시한다.
- 지역 티오는 mock으로 모두 허용하지만, 카피는 `내 지역 티오 조회`/`신청자 기준 지역 티오 확인` 톤으로 유지한다.
- 신청 완료 상태는 `내 지역 티오 확인 완료 · 입금 대기`로 보여준다.

## Applied

- `/plans`의 `loadSlotSnapshot`을 DB count 조회에서 랜덤 mock 값으로 변경했다.
- 상단 quota card를 `선착순 현황`과 `내 지역 티오`로 바꿨다.
- 플랜 모달과 신청 완료 문구를 신청자 기준 지역 티오 확인 흐름으로 변경했다.
- 멤버십 신청 텔레그램 알림도 `내 지역 티오: 신청자 기준 mock 확인 완료`로 변경했다.

## Deferred

- 실제 지역별 quota 계산/차단은 아직 구현하지 않는다.
