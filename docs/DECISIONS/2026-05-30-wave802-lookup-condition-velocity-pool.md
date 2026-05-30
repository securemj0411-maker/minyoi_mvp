# Wave 802 — /lookup 상태 등급 + chip + 회전주기 + pool 자동 등록

- 시간: 2026-05-30 KST
- 트리거: owner — "검색한 매물 상태는 무슨 등급인지 같은 상태 비교매물이라는데 무슨 상태인지도 안써지고 chip도 우리 세세하게 상태 chip박아놓은거도 처리 안되고 그럼; 시세 조회한건 우리 ready풀에 바로 올리게 하면 좋을 듯?? 그리고 회전주기도 안나오고 존나 불편한데?"

## 변경 (4가지)

### 1. condition tier / class 명시

기존 UI: `"같은 상태 (등급 normal) 매물끼리만 비교"` — `normal` 같은 raw 값 노출. tier (S/A/B/C/D) 안 보임.

신규: 상품 상태 section 추가 (시세 그래프 위).
- **tier badge** (`S급 (최상)` / `A급 (양호)` / `B급 (보통)` / `C급 (사용감)` / `D급 (하자)`) — 색상 분기
- **conditionClass** 한글 라벨 (`clean → 깨끗`, `mint → 민트`, `unopened → 미개봉`, ...)
- **신뢰도** % 표시 (condition_confidence × 100)
- **conditionChips** — 파란 chip 으로 분석 시그널 노출
- **conditionFlags** — collab/tailored/seasonAnchor 같은 boolean flags — 보라 chip 으로 강조 (true 만)

### 2. condition_chips 노출

DB `mvp_listing_parsed.condition_chips` (text[]) — Wave 714k 의 5-tier 세분화 chip.
기존 lookup 응답에 미포함 → API 응답 추가, client 가 파란 chip 으로 렌더.

빈 array 면 "분석 시그널" section 자체 hide.

### 3. 시세 회전주기 (velocity)

신규 section — `mvp_market_velocity_daily` 에서 가져옴 (`fetchLatestMarketVelocity`).

표시:
- **24시간 내 판매** (emerald) / **7일 내 판매** (blue) — sold_24h_count / sold_7d_count
- **중앙값** / **빠른 25%** / **느린 25%** — median / p25 / p75 hours_to_sold
- confidence badge (high/medium/low)
- 캡션: "같은 등급 매물 기준으로 등록 → 판매까지 평균 얼마 걸리는지"

formatHours 함수: <24h → "N시간", <14d → "N.N일", ≥14d → "N일".

### 4. pool 자동 등록 + status 표시

조회 매물이 `mvp_candidate_pool` 에 없으면 자동 insert (status=ready):
- 조건: `profit.min > 0 && marketBasis.medianPrice != null` (양수 차익 + 시세 있을 때만)
- 기존 row (invalidated 포함) 는 건드리지 않음 — cron 의 invalidation reason 존중
- `Prefer: resolution=ignore-duplicates,return=minimal` 로 race-safe insert
- best-effort try/catch — 실패해도 lookup 정상 반환

응답에 `poolStatus` 추가:
- 기존 row 있으면 status + invalidatedReason + score
- 신규 insert 면 `{status: 'ready', registeredJustNow: true}`
- 없으면 null

UI:
- ready → 초록 박스 "추천 풀에 등록됨"
- registeredJustNow → "✓ 추천 풀에 방금 등록됐어요 / 다른 회원도 추천 피드에서 이 매물을 볼 수 있어요"
- invalidated → 황색 박스 "추천 풀에 포함 안 됨 / 사유: <reason>"

## 검증 (owner case: 톰브라운 셔츠 pid 410362241)

DB 실측:
- `condition_tier = "B"`, `condition_class = "clean"`, `condition_confidence = 0.4`
- `condition_chips = []` — chip section hide
- `condition_flags = {collab:false, tailored:false, seasonAnchor:false}` — flags chip hide
- pool: `status = invalidated, invalidated_reason = profit_roi_above_70pct_clothing_review`

수정 후 UI 노출:
- `B급 (보통)` tier badge + `깨끗` class badge + 신뢰도 40%
- "추천 풀에 포함 안 됨" 사유 표시 — 사용자가 왜 풀에 없는지 인지 가능

## Trade-off

### Pool 자동 등록 정책

- ⚠️ 사용자 trust 활용 — 사용자가 본 매물은 운영자 검토 안 거치고 ready 풀 등록.
- ✅ profit.min > 0 게이트로 명백한 손실 매물 차단.
- ✅ invalidated 매물 = 자동 추가 안 함 (cron 의 정책 존중).
- ⚠️ score=0, confidence=0.5 default — 다른 ready 매물보다 낮은 우선순위로 노출됨 (의도).
- ⚠️ exposure_count 0, max_exposure 3 — 표준 pool 룰 따름.
- Follow-up: 사용자가 조회 → 등록한 매물 마킹 (`source=user_lookup`) → admin 검토 후 정식 ready 전환 정책 (별도 wave).

### condition_chips 정확도

- DB 의 chips 가 빈 array 인 경우 많음 — Wave 714k 부분 적용 (신발/의류 위주).
- 다른 카테고리는 chips 없음 → section 자체 hide. 잘못된 정보 안 보여줌.

### Velocity 표시

- mvp_market_velocity_daily 의 confidence=all 만 fetch — Wave 394.7.ac 패턴 따름.
- 데이터 없는 SKU 면 section 자체 hide.

## Follow-up

- **사용자 lookup 출처 마킹** — pool row 에 `source=user_lookup` 같은 컬럼 추가, admin 페이지에서 검토 가능.
- **velocity 표본 부족 안내** — confidence=low 면 "표본 부족으로 신뢰도 낮음" 별도 안내.
- **bunjang lookup 실패 root cause** (Wave 799e) — 사용자가 다음 시도 시 step 보고 fix.
- **재투표/peer 추천** — 사용자 N명이 lookup 한 매물 = pool boost (사회적 증명).
