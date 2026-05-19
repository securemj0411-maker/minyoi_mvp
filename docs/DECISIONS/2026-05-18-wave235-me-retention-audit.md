# 2026-05-18 Wave 235 — /me 리텐션 강화 감사

## 배경

사용자 요청: 이전 사업/리텐션 논의를 참고하되, 현재 `/me` 페이지와 실제 로그/구현을 기준으로 더 풍부하게 리텐션 강화 지점을 찾는다.

## 현재 강한 축

- `/me` 기본 진입은 `나의 상품`이고, 신규 사용자는 welcome 추천 4개로 빈 대시보드를 피한다.
- Saved Money Counter, 내 피드백 활동, 현재 차익 재계산, 판매완료 tombstone, 정보 오류 신고 보상, 핫딜 텔레그램 알림, 시세 근거/회전/위험도 UI가 이미 구현되어 있다.
- 따라서 다음 작업은 새 장식 기능보다 `열람 → 매수 → 검수 → 재판매 → 실제 수익/손실 기록` 루프를 닫는 쪽이 더 큰 리텐션 레버리지다.

## 결정

1. P0는 Closing Loop다. `saved-money` API는 `bought` 피드백을 수익 카운터의 입력으로 보지만, 현재 사용자 모달의 주요 액션은 `공략 보기 / 번개장터 열기 / 정보 오류 신고`에 집중되어 있어 `매수했어요` 신호가 전면 CTA가 아니다.
2. P0 버그 후보: 현재 정보 오류 신고는 `inaccurate_report`로 보상하지만 Saved Money Counter의 보상 합산은 `loss_report`만 본다. 실제 보상 토큰이 대시보드 가치 카운터에 반영되지 않을 수 있다.
3. P0 운영 리스크: 코드가 `inaccurate_report`, `admin_status`, `compensation_granted_tokens`, `user_seen_at`을 사용하지만 로컬 schema/migrations에는 해당 DDL이 보이지 않는다. live DB 수동 변경이 있었다면 재현성/온보딩/CI 기준에서 위험하다.
4. P1는 개인화 저장이다. 추천 모달에는 위험 프리셋과 필터가 있지만 사용자별 자본/위험/카테고리 선호가 프로필로 누적되지 않는다. 개인화된 점수/추천으로 넘어가려면 최소 preference store가 필요하다.
5. P1는 사용자 브리프다. 운영자 daily brief는 있지만 사용자 `/me`에는 "오늘 내 조건에서 시장이 어떤지" 보는 ritual이 없다. `/me` 상단에 개인 브리프를 붙이면 매일 열 이유가 생긴다.
6. P1는 추천 설명 패널 wiring이다. 현재 dirty diff에 `RecommendationReasonPanel`, `MarketGraphTrustLine`이 정의되어 있으나 사용 위치가 없다. 의도된 작업이면 모달에 실제로 붙여야 신뢰 UI가 작동한다.
7. P2는 삭제를 soft-hide로 바꾸는 것이다. 현재 숨기기/삭제는 `mvp_pack_reveals`와 `mvp_reveal_feedback`을 둘 다 hard delete한다. 사용자는 정리되지만 학습/피드백 활동 루프가 같이 사라진다.

## 보류

- AI Advisor Chat은 지금 바로 P0로 두지 않는다. 이미 근거/위험/회전 UI가 많아, 먼저 거래 상태 CTA와 실제 outcome 데이터가 필요하다.
- 전업 리셀러용 운영 도구(재고/세무/자동 cross-post)는 별도 라인으로 본다. `/me`의 당장 목표는 준-리셀러가 첫 성공/반복 성공을 기록하게 만드는 것이다.
- 실제 브라우저 검증은 이번 감사에서 수행하지 않았다. 코드 읽기 기반 감사이며, 구현 착수 시 `/me` smoke와 테스트를 별도로 돌린다.

## 다음 작업

1. `/me` 상품 모달 footer에 `매수했어요`, `문의했어요/보류`, `포기했어요` 상태 CTA를 추가하고, `bought` 피드백이 Saved Money Counter에 즉시 반영되게 한다.
2. `saved-money` 보상 집계를 `loss_report + inaccurate_report` 기준으로 정정한다.
3. `mvp_reveal_feedback` 관련 누락 DDL을 migration으로 캡처하고 contract test를 추가한다.
4. 사용자별 preference 저장소를 만들고 `RecommendationWorkspace`의 위험 프리셋/필터를 저장·재사용한다.
5. `/me` 상단에 개인 Daily Market Brief를 추가한다.
