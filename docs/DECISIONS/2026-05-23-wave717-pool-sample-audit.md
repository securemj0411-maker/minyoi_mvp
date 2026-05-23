# Wave 717 — pool ready sample audit + sentinel cleanup

**Date**: 2026-05-23
**Trigger**: 사용자 지시 "지금 pool ready에 들어온거 보고 뭐가 문제점이다 이런거 없음?? 한번 더 봐야되는거 아닌가?"
**SQL spread만 보면 missed — 실제 ready 매물 sample 직접 검사.**

## Phase 0 — pool 상태 확인

| state | n (clothing 14d) |
|---|---|
| pool_clean | 5,442 |
| parsed_not_pool | 4,492 |
| pool_dirty_pending_reparse | 3,263 |

## Phase 1 — Sample audit 발견 issues

### 1. 🚨 stussy_dior_collab — 가방 흡수 (의류 SKU에 가방 들어옴)

`clothing-stussy-dior-collab` ready 매물 중:
- pid 264008470 "디올옴므 스투시 새들백" 270만 ⚠️ 가방
- pid 240178517 "디올 호보백 스투시라인" 240만 ⚠️ 가방

나머지 8건은 정상 의류 (자켓/봄버/가디건/블레이저/니트/트러커).
가방 시세군 (200~300만)이 clothing 의류 시세군과 별 → 시세 오염.

**Fix**: mustNotContain 가방 키워드 9개 추가:
- 새들백/saddle bag/호보백/hobo bag
- 백팩/메신저/토트백/숄더백/크로스백
- 지갑/카드지갑/가방 etc

### 2. 🚨 Sentinel price stale flag (placeholder filter 우회)

`pool_eligible=true` 인데 가격 9,999,999 / 1억+ 매물:
- clothing-champion-apparel-broad 1건 (9,999,999 = 사이즈교환용 placeholder)
- bag-chanel-broad 10건 (9.3M~18M — 정품 명품 vs sentinel 혼재)
- macbook-pro 6건 (9~22M)
- bag-hermes-broad 3건 (9.2~12.5M legit)
- iphone-16-pro 1건 (111,110,111 = 같은 자리수 반복 sentinel)
- galaxy-z-fold-4 1건 (100,000,000 = 1억 sentinel)
- iphone-14-pro 1건 (90,000,000)

**원인**: `isPoolPlaceholderPrice` 함수는 정상 작동하지만,
이미 pool에 박힌 매물의 `mvp_raw_listings.pool_eligible` flag가 stale.
실제 `mvp_candidate_pool` table에는 없음 (pool 진입 자체는 차단됨).

**Fix**: score_dirty 트리거 74건 → 다음 reparse cycle에서 flag 정리.

### 3. ✅ 의류 pool 매물 sample 20건 검토

```
arcteryx_alpha 우먼사이즈 / polo_rrl_denim 셔츠+jeans 둘 다 매칭 OK
tnf_nuptse_1996 220k / arcteryx_atom 230~270k / fog_essentials_hoodie 200k
acne_jacket_coat 160k
```

큰 contamination 없음. (참고: 여성 사이즈 vs 남성 사이즈 시세 분리 가능성 있으나 풀 부족으로 defer.)

### 4. ✅ 신발 pool 매물 sample 25건 검토

```
shoe-asics-cecilie-bahnsen-collab 339k / shoe-hoka-bondi-eg-collab 330k
shoe-hoka-mafate-satisfy-collab 280k / shoe-newbalance-kith-collab 380k
미즈노 Wave Prophecy MOC 고어텍스 800k (한정 모델 정상)
shoe-asics-novablast 70k / shoe-puma-speedcat 30k
```

큰 contamination 없음.

(참고: pid 252853695 "아디다스 울트라부스트 정품 무료배송 네고불가 아디다스코리아" 89k — 광고/리테일 셀러 의심 매물 1건, 추후 광고 차단 keyword 강화 검토.)

### 5. ✅ 가방 pool 비어있음

사용자 정책상 "가방은 ready 안 함" → pool 비어있는 게 정상.

## Phase 2 — 적용 결과

| Fix | commit |
|---|---|
| stussy_dior_collab 가방 차단 9개 키워드 | (pending) |
| Sentinel-price stale flag 74건 score_dirty 큐 | SQL 실행 완료 |

## Phase 3 — 결론

pool sample audit 큰 contamination 없음. Wave 715+716 narrow split + 7개 broad 강화 cycle 효과 검증됨.

**남은 작은 issue**:
- 여성/남성 사이즈 시세 분리 (defer — 풀 부족)
- 광고/리테일 셀러 키워드 강화 ("네고불가" "아디다스코리아" 등 — 다음 cycle)
- 전자기기 가격 outlier sanity check (Task #25 pending) — 별도 큰 cycle

## 관련 commit
- (Wave 717 commit pending)

## 진행 상황

- [x] Phase 0 — pool 상태 확인
- [x] Phase 1 — sample audit (의류 20 + 신발 25 + 가방 0)
- [x] Phase 2 — stussy_dior 가방 차단 + sentinel cleanup
- [x] Phase 3 — 결론: pool 깔끔, narrow cycle 효과 검증됨

## 다음 cycle 후보

- 광고/리테일 셀러 키워드 강화 (네고불가/아디다스코리아/배송무료 패턴)
- 전자기기 가격 outlier sanity check (Task #25)
- 신발 condition grading deep sweep 10K (Task #49)
