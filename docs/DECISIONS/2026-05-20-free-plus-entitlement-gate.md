# 2026-05-20 Free/Plus 권한 게이트

## 결정
- 구독형 전환은 보류한다. PG 재신청 리스크가 있으므로 현재 단건 크레딧 충전 모델을 유지한다.
- Free는 추천 피드 30개를 계속 열어두되, `/explore` 상세보기 진입을 하루 3회로 제한한다.
- Plus는 현재 200크레딧 단건 충전권을 첫 유료 전환 상품으로 보고, 상세보기/원본 확인 한도를 하루 200회로 둔다.
- 기존 `mvp_user_plans.daily_used_count`와 `consume_mvp_daily_quota` RPC를 일일 권한의 source of truth로 재사용한다.

## 구현
- `src/lib/detail-access.ts`를 추가해 상세보기 권한을 서버에서 차감한다.
- 같은 사용자가 같은 pid를 같은 날 다시 열 때 중복 차감되지 않도록 `mvp_rate_limits`에 `detail-access:{userRef}:{pid}` 버킷을 기록한다.
- `/api/packs/pool/detail-access`를 추가해 `/explore` 카드 클릭 전에 권한을 확인한다.
- `/explore`는 권한 확인 성공 후에만 상세 모달을 열고, 한도 초과 시 Plus 안내 배너를 표시한다.
- staged 배포 검증 중 기존 `tick-pipeline`의 `Promise<number>` 반환이 `Promise<void>` 콜백에 물려 빌드가 막히는 것을 확인해, 반환값을 버리는 `async` 래퍼로 타입을 정리했다.
- 후속 UX 조정: 한도 초과 안내는 작은 배너가 아니라 토스식 바텀시트/모달로 표시한다. 문구는 `2시간에 3건`이 아니라 `오늘 무료 상세보기 3회`로 유지한다.

## 보류
- Starter/Pro 패키지는 API/기존 링크 호환을 위해 제거하지 않았다.
- 구독형 재도입, Premium 기능 분리, PG 상품 구조 변경은 매출 신호를 본 뒤 별도 결정한다.
