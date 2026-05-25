# 2026-05-25 Wave807 Recent Feedback / Latest Pool Learning

## Context
- 사용자 최근 코멘트와 최신 ready/pool/raw를 함께 스윕했다.
- `mvp_reveal_feedback` 최근 109건 중 note 104건을 raw/parsed/pool과 조인했고, 최근 24h raw 5,000건 및 ready 443건을 표본으로 봤다.
- 의류/신발은 ready 216건으로 pool의 핵심 비중이며, 최신 24h raw에서도 clothing/shoe 파싱 342건이 확인됐다.

## Decisions Applied
- `콘티프로콘택트` 타이어가 `프로콘` substring 때문에 Nintendo Switch Pro Controller로 매칭되는 문제를 게임 타이틀 noise로 차단했다.
- `풀세트` 단어 하나만으로 바이올린/다이빙 랜턴/카드지갑/굿즈가 `sport_golf_full_set_broad`로 들어오는 문제를 막기 위해 golf full/half set은 골프/클럽/아이언/드라이버 등 골프 신호를 함께 요구하도록 좁혔다.
- `Puma Future Rider` 라이프스타일 스니커즈가 Puma football/futsal의 `퓨처` 축으로 흡수되는 문제를 차단했다. 새 SKU로 열기에는 resale/pool ROI가 낮아 우선 wrong-match 방지가 맞다.
- `판/교`, `교신가능`, `교신/판매` 같은 교환성 게시글은 pool에서 제외한다. 단 `교환/교신 안해요`, `교신문의 차단` 같은 정상 판매 disclaimer는 통과하도록 분리했다.

## Deployment / Backfill
- 운영 반영 커밋:
  - `437a10f4 fix: block recent catalog leak patterns`
  - `5af31817 fix: allow exchange disclaimer while blocking trade posts`
- 현재 ready에 이미 들어간 오염 11건은 DB에서 즉시 invalidated 처리했다.
  - reason: `wave807_recent_feedback_catalog_guard`
  - raw `sku_id/sku_name`도 null로 비워 score 재진입을 막았다.
- 적용 후 확인:
  - ready: 432건
  - wave807 invalidated: 11건
  - Wave807 패턴 잔여 ready hit: 0건

## Verification
- 통과: `npx tsx --test --test-name-pattern "recent pool sweep" tests/core-rules.test.ts`
- 참고: 기존 `exchange-request` 묶음 테스트에는 `칼하트 헤리티지` broad 기대값과 현 catalog 차단 규칙의 오래된 충돌이 남아 있어 별도 처리 필요.

## Deferred
- 신설 SKU 후보 중 `Puma Future Rider`는 현 가격대/표본상 pool용 SKU로 열기보다 차단이 맞다고 판단했다.
- Stussy/Arc'teryx 축 분리, RRL/Acne/BAPE 세부 축은 이미 로컬에 더 큰 작업 흔적이 있으나 이 로그에서는 최신 feedback/pool에서 실제 ready 오염으로 확인된 최소 안전 패턴만 운영 반영했다.
- 다음 sweep은 ready가 아닌 `sku_id=null` 의류/신발 raw와 기존 broad SKU별 sample spread를 함께 보며, 새 SKU 개설이 ROI 있는 경우에만 추가한다.
