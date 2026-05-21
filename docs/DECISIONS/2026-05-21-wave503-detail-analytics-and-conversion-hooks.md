# Wave 503 — 상세 행동 로그와 결제 전환 hook 정리

## 결정
- 쉬운모드/상세 숫자 리포트/원본 매물 클릭 흐름은 전환율 개선의 핵심 지표라서 `mvp_detail_events`로 서버 저장한다.
- 클라이언트가 `user_ref`를 보내지 않게 하고, API가 Supabase auth user에서 `user_ref`를 파생한다.
- 운영자 비밀 path 안에 `detail-events` 화면을 추가해 최근 500건 이벤트, 세션 흐름, 쉬운모드 완료율, 숫자 리포트 전환율, 원본 클릭률을 본다.
- “초보자 가이드 스킵” 표현은 이후 CTA에서 `상세 숫자 리포트 보기` 톤으로 유지한다. 쉬운모드는 설명 모드가 아니라 무료 3회 가치 체험용 진입이어야 한다.

## 구현
- `supabase/migrations/20260521094703_detail_analytics_events.sql`
  - `public.mvp_detail_events` 생성
  - RLS enable + anon/authenticated 직접 접근 차단
  - user/pid/event/session 기준 index 추가
- `src/app/api/packs/reveals/events/route.ts`
  - 상세 행동 event insert API
  - rate limit, event type validation, metadata compact 처리
- `src/components/explore-client.tsx`
  - 상세 열람 시작/닫기, 무료 제한 CTA, 스크랩, 다른 매물 클릭 추적
- `src/components/pack-reveal-modal.tsx`
  - 쉬운모드 시작/장면/이전/다음/완료/숫자 리포트 전환, 원본 이동 확인/클릭/취소 추적
- `src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/detail-events/page.tsx`
  - 운영자용 상세 움직임 화면 추가

## 보류
- 문의 문구 복사 기능은 카탈로그/상태/구성품/잠금/정품 위험을 더 정확히 잡은 뒤 big wave로 진행한다. 얕은 보일러플레이트면 오히려 서비스 가치가 낮아 보일 수 있음.
- 첫 3개 무료 체험을 `수익형 / 위험 회피형 / 애매한 매물 판단형`으로 의도 배치하는 전략은 좋지만, 현재 MVP에서는 pool 희소성과 데이터 파이프라인 안정화가 먼저라 보류한다.
- 알림, 저장 리포트, 판매글 자동 작성은 결제 전환에 유효하지만 MVP 범위 밖으로 둔다.
- 안전결제/사기 예방 안내는 상세 쉬운모드 반복 문구가 아니라, 원본 매물 이동 전 확인창과 마켓별 거래 안내로 옮기는 방향을 유지한다.

## 다음 작업
- 무료 3회 소진 시 결제 전환 화면에 “무료 3건 동안 확인해준 가치” 누적 요약을 넣는다.
- 쉬운모드 첫 장은 `예상 순익 / 매입가 / 시세 / 최종 판단`을 먼저 보여주고, 서비스 자랑형 필터링 숫자는 첫 가입 hook 또는 보조 맥락으로 이동한다.
- 운영자 detail-events 화면에서 실제 이탈 구간을 보고 CTA 문구와 쉬운모드 순서를 다시 조정한다.
