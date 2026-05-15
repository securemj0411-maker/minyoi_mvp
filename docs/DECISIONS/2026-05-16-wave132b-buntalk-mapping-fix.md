# Wave 132b — bunjang.ts commentCount 매핑 fix (사용자 검증으로 발견)

> Wave 132 (commit 81db97f) 직후 사용자 검증으로 발견된 매핑 실수 긴급 fix.

## 1. 발견
사용자 직접 확인: pool 매물 pid 402009410 (아이패드 10세대), 398031598 (갤럭시워치7) 등 번개장터 페이지엔 댓글 15개, 8개 등 표시되는데 우리 시스템은 모두 0으로 박혀있음.

원인 추적:
- `bunjang.ts:222`의 commentCount 매핑이 5가지 path를 보고 있었음:
  `metricsData.commentCount`, `metricsData.comments`, `metricsData.numComments`, `product?.commentCount`, `product?.numComments`
- 실제 bunjang API raw 응답 dump:
  ```json
  metrics: {
    "favoriteCount": 55,
    "buntalkCount": 15,    ← 사용자 UI "댓글 15개"의 진짜 source
    "viewCount": 787,
    "commentCount": 0      ← 우리가 보던 거 (다른 필드, 거의 항상 0)
  }
  ```
- 번개장터 UI "댓글 N개" = **`metrics.buntalkCount`** (번개톡 = 셀러-구매자 채팅 문의 수)
- 우리 매핑은 wrong field 5개만 봐서 항상 0 반환

## 2. 변경
### 2a. `src/lib/bunjang.ts` (line 222)
- `firstNumber()` 첫번째 인자에 `metricsData.buntalkCount` 추가
- 5 옛 path는 fallback으로 유지 (안전)

### 2b. Backfill 재실행
- `scripts/wave132-backfill-num-comment.ts` 동일 — fix만으로 정확한 값 받음
- 결과 (439 pool 매물):
  ```
  성공: 410, 실패: 29 (detail_null = 매물 사라짐)
  떨어뜨림 (>= 8): 94건 (21.4%)
  
  분포:
    0:     120
    1-2:   110
    3-5:    65
    6-7:    21
    8-15:   51 ← 차단
    16+:    43 ← 차단
  
  Top 차단 매물:
    pid 315296103: 댓글 675 (대량 판매업자)
    pid 291040437: 618
    pid 315295294: 533
    pid 254336053: 462
    pid 287930892: 125
  ```

## 3. 검증
- 165/165 test pass
- detail API raw probe로 매핑 검증
- 사용자 본 매물 pid 402009410 → 0 → **15** (이제 차단됨)
- 사용자 본 매물 pid 398031598 → 0 → **8** (이제 차단됨)

## 4. 위험 / 학습
- **5 path 다 wrong field 본 경우** = 진단 어려움. detail API raw dump 검증 없이 추측만 함 = 실수.
- 사용자가 사이트와 비교 검증 안 했으면 못 발견할 일.
- **앞으로**: 외부 API 응답 새 필드 매핑 시 항상 raw dump 한 번 + 사용자 UI 비교.

## 5. 다음
- 24h 후 pool 매물 재측정 — buntalk 분포 변화 추이
- Wave 132 decision log에 buntalkCount 명시 (잘못된 정보 정정 link)

## 6. 거론 금지
- commentCount 옛 5 path 제거 — fallback으로 유지 (혹시 future API 변경 대비)
