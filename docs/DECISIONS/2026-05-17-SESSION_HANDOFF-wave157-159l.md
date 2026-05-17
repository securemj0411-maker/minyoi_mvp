# 2026-05-17 Session Handoff — Wave 157~159l 종합

> 다음 에이전트가 이 세션을 이어가기 위한 종합 정리. 박은 변경, 자동 발견 critical bug, 측정 효과, 정책 결정 대기 사항, 다음 우선순위.

## 1. 박은 commit (시간순)

| Wave | Commit | 영역 | 내용 |
|---|---|---|---|
| 157 | [b104e0c](https://github.com/securemj0411-maker/minyoi_mvp/commit/b104e0c) | hotdeal | net 차익 (운영자풀과 일치) + 원 단위 표시 |
| 158 | [c592c81](https://github.com/securemj0411-maker/minyoi_mvp/commit/c592c81) | parser | bunjang 영어 enum 6개 매핑 + AI trigger 조건 수정 |
| 158b | [401c56f](https://github.com/securemj0411-maker/minyoi_mvp/commit/401c56f) | AI/backfill | mvp_listing_ai_classifications.condition_class 컬럼 + 3,798건 backfill + 신발 1,010건 복구 |
| 159 | [9a8b37a](https://github.com/securemj0411-maker/minyoi_mvp/commit/9a8b37a) | admin | listing_type_override 컬럼 + 분류 검증 view (/me/admin-classification) |
| 159b | [dfadf3e](https://github.com/securemj0411-maker/minyoi_mvp/commit/dfadf3e) | classifier | descriptionMultiHits (다중상품 가격+옵션 3+) |
| **159c** | [99a2e95](https://github.com/securemj0411-maker/minyoi_mvp/commit/99a2e95) | **CRITICAL** | override='normal' 시 ruleMatch 호출해서 sku_id 재계산 |
| 159d | [1d5e762](https://github.com/securemj0411-maker/minyoi_mvp/commit/1d5e762) | UI | override 후 catalog 미등록 경고 alert |
| **159e** | [0e5c8a6](https://github.com/securemj0411-maker/minyoi_mvp/commit/0e5c8a6) | **CRITICAL** | detail-worker 재분류 시 candidate_pool 자동 invalidate |
| **159f** | [86057fd](https://github.com/securemj0411-maker/minyoi_mvp/commit/86057fd) | **CRITICAL** | tick-pipeline 시세 fallback chain (unopened 누락 + 임의 fallback) fix |
| 159g | [27b4013](https://github.com/securemj0411-maker/minyoi_mvp/commit/27b4013) | DRY | pack-open + landing + market routes 4곳 동기화 |
| 159h | [a3426c0](https://github.com/securemj0411-maker/minyoi_mvp/commit/a3426c0) | DRY | shared module `condition-fallback.ts` 통합 (5곳 refactor) |
| 159h test | [8adb2dc](https://github.com/securemj0411-maker/minyoi_mvp/commit/8adb2dc) | test | shared module 회귀 test 13/13 pass |
| 159i | [40acaa8](https://github.com/securemj0411-maker/minyoi_mvp/commit/40acaa8) | parser | flawed false positive negation 보강 + PARSER_VERSION v48 + 5 test |
| 159j | [edeee5e](https://github.com/securemj0411-maker/minyoi_mvp/commit/edeee5e) | infra | tickScoreLimit 150 → 800 (backlog throughput 5x) |
| 159k | [666a3a9](https://github.com/securemj0411-maker/minyoi_mvp/commit/666a3a9) | infra | score-stage AI condition trigger (env limit 통제, default 0) |
| **178** (사용자) | [80904b9](https://github.com/securemj0411-maker/minyoi_mvp/commit/80904b9) | **policy** | condition fallback chain "위로 fallback 차단" + test |
| 159l | [9ef69cf](https://github.com/securemj0411-maker/minyoi_mvp/commit/9ef69cf) | parser | isWatchBodyListing 패턴 확장 (애플워치9 같은 직접 표기) |

**총 17개 commit. 자동 사이클로 critical bug 10+ 발견 + fix.**

## 2. 자동 사이클로 발견한 critical bug

### A. 시세 정확도 부풀려짐 (3개)

1. **hotdeal 알림이 raw 차익 사용** (Wave 157 fix)
   - 운영자풀: `expected_profit_min` (net, 수수료/배송비/buffer 차감)
   - 알림: `sku_median - price` (raw) → 매물당 ~5만원 부풀려짐
   - 사용자 메모리 정책 "안전결제 의무 → 수수료 차감 명시 필요" 위반

2. **시세 fallback chain unopened/mint 임의 잡힘** (Wave 159f → 159g → 159h, **CRITICAL**)
   - `byCondition.values().next().value` (Map 첫 entry — 임의 condition)
   - iPhone 14 (pid 408329098) flawed 매물에 unopened 시세 ₩1,287K 박힘
   - 4-5곳 (tick-pipeline / pack-open / landing-showcases / market-history / market-source) 동일 버그
   - Wave 159h에서 shared module로 통합

3. **위로 fallback** (사용자 Wave 178)
   - mint 매물에 unopened 시세 / clean 매물에 mint 시세 fallback
   - 사용자 통찰 pid 258306715 "새상품이랑 민트급은 다른거아니야??"

### B. 분류 인프라 미작동 (3개)

4. **bunjang label 매핑 100% 실패** (Wave 158 fix)
   - 한글 정규식만 박힘. 실제 API 응답은 영어 enum
   - 3,798건 metadata 무시되고 description 단독 분류
   - LIGHTLY_USED 매물이 normal이어야 하는데 description 신호 따라 임의 분류

5. **AI condition 호출 0건** (Wave 159k fix, env 활성 대기)
   - mvp_listing_ai_classifications.condition_class 누적: 0건
   - trigger 대상 매물 11,243건인데 detail-worker만 호출 → 기존 매물 영구 미작동
   - 159k가 score-stage에서도 호출 가능하게 박음 (env `PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT` 활성 필요)

6. **score_dirty backlog 13시간 추정** (Wave 159j fix)
   - 119K backlog, scoreStage limit 150 → 1tick 150건만 처리
   - 150 → 800으로 5x

### C. 운영자 view 인프라 미작동 (2개)

7. **listing_type override 후 sku_id NULL이라 풀 진입 불가** (Wave 159c, **CRITICAL**)
   - 차단된 매물 100% sku_id NULL (분류기가 normal 아닌 매물 SKU 매칭 skip)
   - scoreStage query `sku_id=not.is.null` → 영원히 진입 X
   - Wave 159 인프라 사실상 무용지물이었음 (159c 박기 전까지)

8. **listing_type 재분류 시 candidate_pool 자동 invalidate 미작동** (Wave 159e, **CRITICAL**)
   - detail-worker가 매물 재분류 시 (normal → multi 등) candidate_pool 그대로
   - 사용자 코멘트 pid 364899054 (다중상품인데 ready 풀에 잔류) 검증으로 발견
   - 13건 ready 잘못 잔류 매물 invalidate

### D. 분류 false positive (2개)

9. **flawed 4,835건 중 ~80% false positive 의심** (Wave 159i fix)
   - "정품 배터리 교체" / "잔상이나 화면 하자 없" / "모든 기능 정상" 표현
   - negation regex 보강 + v48

10. **accessory 4/5 sample false positive** (Wave 159l fix)
    - "애플워치9 풀박스" 같은 본품 매물이 accessory로 분류
    - isWatchBodyListing 패턴 확장 (시리즈/mm 명시 없어도 본품 인정)

## 3. 측정 효과 (자동 측정)

### 박은 cleanup
- candidate_pool 13건 잘못 잔류 매물 invalidate (Wave 159e backfill)
- 신발 1,010건 condition_class 복원 (Wave 158b backfill)
- AirPods Pro 2 / iPhone 14 / Max 등 수백 건 score_dirty=true (Wave 159f)
- mint/clean 163건 score_dirty=true (Wave 178)

### parser version 적용
- option-parser-v47 매물 23,860건 (v48 commit 후 새 detail부터 v48)
- v46 옛 매물 4건만 (대부분 cron으로 갱신됨)

### 미작동 발견
- AI condition 호출 누적: 0건 (정상 호출은 listing_type 1,748건만)
- score_dirty backlog: 119K (Wave 159j 후 throughput 5x — 약 2.5h 처리 예상)

## 4. 정책 결정 대기 (운영자 입력 필요)

### 즉시 결정 권장
1. **AI condition enable**: `PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT=N` env 박을지
   - 추천: 100/day 시작 (cost $0.60/month) → 24h 측정 후 500/day ($3/month)로 확장
   - 11,243건 trigger 대상 매물 backfill 효과
2. **PIPELINE_TICK_SCORE_LIMIT env**: production에 이미 박혀있으면 default 800 무시. 확인 + env 변경 권장.

### 보류
3. **다중상품 정책** — 일괄 차단 vs N개로 분리 (현재 일괄 차단)
4. **공식 리퍼 condition_class** — flawed vs 별도 카테고리 (사용자 "잘 모름")
5. **id 146/148 negation backfill** — 기존 flawed 잘못 분류 매물 대량 reparse (cost: bunjang API rate limit)
6. **fashion-mobility 가방/자전거 condition** — parser 미구현 normal default. 별도 wave 처리 여부.

## 5. 다음 우선순위 (다음 에이전트 시작점)

### A. 24h 측정 (즉시)
```sql
-- A1. score_dirty backlog 진행 (Wave 159j 효과)
SELECT COUNT(*) FILTER (WHERE score_dirty = true) AS pending
FROM mvp_raw_listings;

-- A2. condition_class 분포 변화 (Wave 158b backfill + 159f/g/h 시세 정정)
SELECT condition_class, COUNT(*) FROM mvp_listing_parsed GROUP BY 1 ORDER BY 2 DESC;

-- A3. iPhone 14 (pid 408329098) sku_median 정정 확인
SELECT pid, sku_median, price FROM mvp_listings WHERE pid = 408329098;
-- 예상: 1,250,000 → 400,000 (worn 시세) 또는 다른 안전 fallback

-- A4. AI condition 호출 누적
SELECT COUNT(*) FROM mvp_listing_ai_classifications WHERE condition_class IS NOT NULL;
-- 환경 PIPELINE_SCORE_AI_CONDITION_DAILY_LIMIT 미설정이면 0 그대로

-- A5. mvp_candidate_pool ready 매물 수 (시세 정정 후 풀에서 빠진 매물 수 측정)
SELECT status, COUNT(*) FROM mvp_candidate_pool GROUP BY 1;
```

### B. 운영자 first-time UX (운영자 검증 view 실제 활용)
- 운영자가 `/me?view=admin-classification` 첫 방문
- accessory 드롭다운 → 본품 false positive 매물 sample 검증
- "본품 override" 버튼 박기 → 다음 tick에 풀 진입 검증
- 즉시 fix 가능한 알려진 매물:
  - pid 406163013 "애플워치9 풀박스"
  - pid 407056441 "애플워치10 에르메스"
  - pid 396365964 "아이패드 에어 5세대"
  - pid 407434354 "갤럭시 z플립4"

### C. 자율 진행 가능 영역 (사용자 결정 없이)
1. **accessory false positive 추가 sample 분석** — 더 많은 pattern 발견
2. **descriptionMultiHits 효과 측정** — 새 detail-fetch 매물에서 multi 분류 증가 확인
3. **shared module 확장** — bunjangLabelToConditionClass 등 다른 helper도 통합 가능
4. **option-parser test 확장** — negation regex 회귀 차단 더 깊이

### D. 정책 결정 대기 작업 (사용자 입력 후)
- AI condition env 활성화 → cost 측정
- 다중상품 정책 결정 → AI L2 prompt 보강
- negation backfill 정책 결정 → backfill script 실행

## 6. 핵심 파일

| 파일 | 영역 | 상태 |
|---|---|---|
| `src/lib/condition-fallback.ts` | 시세 fallback shared module (Wave 178 정책) | 신규 |
| `src/lib/hotdeal.ts` | net 차익 + 원 단위 표시 | Wave 157 + 사용자 직접 수정 |
| `src/lib/option-parser.ts` | parser v48 (영어 enum + negation) | 활성 |
| `src/lib/pipeline.ts` | listing_type classifier + AI condition classifier | 활성 |
| `src/lib/tick-pipeline.ts` | score-stage AI condition trigger | env 활성 대기 |
| `src/lib/pack-open.ts` | shared module 사용 | 통합 |
| `src/app/api/admin/classification-listings/route.ts` | 분류 검증 view API | 활성 |
| `src/app/api/admin/listing-type-override/route.ts` | override + sku_id 재계산 | 활성 |
| `src/components/admin-classification-browser.tsx` | 운영자 UI | 활성 |
| `tests/wave159*.test.ts` | 회귀 test 37 시나리오 | 모두 pass |

## 7. 위험 / 주의

- **PIPELINE_TICK_SCORE_LIMIT production env**: 박혀있으면 default 변경 무시. 확인 필요.
- **AI condition env 활성 시 cost**: 매물당 ~$0.0002. limit 통제 작동 확인 필요.
- **DRY shared module 변경 시 5곳 영향**: condition-fallback.ts 수정 시 회귀 test 필수.
- **PITR 미박힘**: 시세 historical 손실 risk. 직접 SQL UPDATE 금지 (사용자 메모리 정책).
- **Wave 159e 자동 invalidate가 override='normal' 매물 skip**: override 의도 보존. 운영자 override 박은 매물은 풀에서 안 빠짐.
