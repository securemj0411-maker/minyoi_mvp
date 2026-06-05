# 2026-06-05 Wave 1143 — 당근 우선 피드와 실시간 알림 CTA

## 결정
- 추천 피드의 기본 진입은 `당근마켓 + 가까운 순`으로 둔다.
- 중고나라/번개장터 매물은 처음부터 섞지 않고, 사용자가 하단의 `중고나라·번개까지 보기`를 눌렀을 때 전체 출처로 확장한다.
- 하단 `더 찾아보기` 근처에 `실시간 매물 알림 받기` CTA를 추가해 기존 텔레그램 연결/알림 화면으로 보낸다.

## 구현
- `src/components/explore-client.tsx`
  - URL에 source/sort가 없으면 기본값을 `source=daangn`, `sort=distance`로 변경했다.
  - 하단 sticky CTA에 `중고나라·번개까지 보기` / `당근 근처 매물만 보기` 토글 버튼을 추가했다.
  - 하단 sticky CTA에 `실시간 매물 알림 받기` 링크를 추가했다.
- `src/components/hotdeal-alerts-view.tsx`
  - 기존 핫딜 알림 화면을 `실시간 매물 등록 알림` 톤으로 정리했다.
  - 현재 구현 범위를 넘어서는 내 동네 신규 당근 알림은 별도 큐 확장 사항으로 명시했다.

## 보류
- 내 동네 신규 당근 등록 알림의 실제 발송은 이번 작업에 얹지 않았다.
- 기존 핫딜 큐는 큰 차익 후보를 user_ref 기준으로 reserve하는 구조라, 지역 기반 신규 등록 알림을 그대로 얹으면 dedupe와 지역 타겟팅이 불명확하다.
- 후속 구현은 다음 단위가 필요하다.
  - 사용자 지역 preference 저장소 확정.
  - 신규 당근 ready 매물용 alert queue 추가.
  - `(user_ref, pid)` unique dedupe.
  - `mvp_telegram_bindings.paused=false` 사용자 중 지역 매칭 대상만 dispatch.
  - 같은 매물 반복 발송/이미 열람한 매물 발송 방지.
