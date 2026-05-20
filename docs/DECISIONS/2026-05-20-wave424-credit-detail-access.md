# 2026-05-20 Wave 424 — 상세보기 크레딧 차감 전환

## 결정
- `/explore` 상세보기 권한은 더 이상 `오늘 무료 상세보기 3회` 일일 quota로 보지 않는다.
- 새 정책은 `첫 3개 고유 상품 무료 → 이후 새 상품 1개당 1크레딧 차감`이다.
- 동일 사용자가 같은 `pid`를 다시 여는 경우에는 크레딧을 다시 차감하지 않는다.
- 기존 `mvp_rate_limits`를 열람 unlock 기록과 첫 무료 3개 카운터로 재사용한다. 새 테이블은 만들지 않는다.
- 신규 가입 자동 크레딧 grant는 `0`으로 바꾸고, UX 문구는 `첫 3개 상품 무료`로 정리한다.

## 구현
- `src/lib/detail-access.ts`
  - `detail-access:{userRef}:{pid}` bucket을 pid unlock 기록으로 사용한다.
  - `detail-access-free:{userRef}` bucket으로 첫 3개 무료 사용량을 센다.
  - 무료 3개를 모두 쓴 뒤 새 pid를 열면 `spendUserCredits(... amount: 1)`를 호출한다.
  - 크레딧 부족이면 unlock row를 삭제하고 402 `insufficient_credits`를 반환한다.
- `/api/packs/pool/detail-access`
  - `creditSpent`, `creditBalance`, `freeUsed`, `freeLimit`, `accessType`을 반환한다.
- `/explore`
  - 크레딧이 실제 차감된 경우 `minyoi:credits-changed`를 dispatch한다.
  - 부족 모달은 일일 한도 문구가 아니라 크레딧 부족/충전 CTA로 보여준다.

## 보류
- 운영 DB의 기존 사용자에게 이미 지급된 과거 무료 크레딧 회수는 하지 않는다.
- 열람 unlock 전용 테이블 분리는 트래픽이 커지거나 운영 조회가 필요해질 때 별도 schema로 승격한다.
