# Wave 138b + 139 — 다중 ID 사기 그룹 차단 + UI 카운터

> Wave 138a 후속: 같은 description 복붙 다중 셀러 ID = 부캐 그룹 사기 패턴. UI에 "도매 업자/사기 그룹 차단 X건" 표시.

## 1. 시간 + 동기
- 2026-05-16 (Wave 138a commit 866b374 후속)
- 사용자 명령:
  1. "ㅇㅇ 진행 ㄱㄱ하자" (138b)
  2. "추천상품받기에 위험 매물 이번주 차단 이거 여기서 도매 사기꾼 차단? 이런거도 보여줘서 UI로 와 이사이트 진짜 사기도 걸러내는구나 이런느낌"

## 2. Wave 138b — description hash 다중 ID 차단

### 2a. DB 발견 (Wave 138a 분석 직후)
```
동일 description text (복붙)              매물수    셀러수
─────────────────────────────────────────────────────
"에어팟프로 2세대 C타입 OR 8핀 A급 세트..."   27       7 ⚡
"택포) 에어팟 프로 2세대 오른쪽 SS급..."      12       7
"**정상 해지폰 공기계폰** S23 256GB..."      15       7
"✔제품정보 갤럭시S25울트라 512GB..."          9       6
```
→ 동일 description 27건이 7명 셀러 ID로 분산 = 같은 사람 부캐 그룹.

### 2b. 변경
- DB schema (`wave138b_description_hash_column`):
  - `mvp_raw_listings.description_hash text` 컬럼 + partial index
  - SHA256(trim(description_preview[:500]))[:32] hex
- `tick-pipeline.ts`:
  - `computeDescriptionHash()` 함수 신규 (Node crypto)
  - detail-worker 2 위치 (normal + sold_confirmed) hash 박음
  - `loadFraudGroupHashes()` 함수: hash → unique seller set, size ≥ 2 filter
  - buildCandidatePoolRows 호출 시 `fraudGroupHashes` 전달
- `candidate-pool-builder.ts`:
  - `PoolCandidateInput.descriptionHash` 추가
  - `MIN_SELLERS_FOR_FRAUD_GROUP = 2` const
  - hash가 fraud group set에 있으면 차단 (reason `multi_id_fraud_group_2_sellers`)
- `pipeline.ts`: `PipelineRow.descriptionHash` 추가
- ScorableRawRow + SELECT columns + score 단계 매핑

### 2c. One-time backfill (SQL)
- `mvp_raw_listings.description_hash` SHA256 계산 (pgcrypto digest)
- pool 매물 중 fraud group hash → invalidate
- **결과: 3건 차단** (Wave 138a 후 남은 잔여 multi-ID)

## 3. Wave 139 — UI 카운터 추가

### 3a. `src/app/api/public/safety-stats/route.ts`
- 4 신규 count: `wholesaler_comment_7d` / `wholesaler_qty_7d` / `seller_multi_listings_7d` / `multi_id_fraud_group_7d`
- `wholesaler_total_7d` 합계
- invalidated_reason LIKE 패턴 매칭으로 Wave 132/137/138a/138b 차단 수 집계

### 3b. `src/components/safety-stats-badge.tsx`
- 옛 4 카테고리 (가품/통신사/가격dummy/시세부적합) 하단에 신규 "🏭 도매 업자 / 사기 그룹 차단" 섹션
- 4 sub-row 추가:
  - 💬 호가-실거래 괴리 (댓글 ≥ 8) — Wave 132
  - 📦 대량 보유 매물 (수량 > 1) — Wave 137
  - 🔁 위장 업자 (같은 셀러 여러 매물) — Wave 138a
  - 🎭 부캐 사기 그룹 (다중 ID) — Wave 138b
- 하단 카피 업데이트: "가품 · 잠금 · 통신사 약정 · 셀러 거래 거부 · 도매 업자 · 부캐 사기 그룹"

## 4. 검증
- 177/177 test pass
- tsc clean
- backfill 실측: Wave 138b 3건 / 누적 187건 차단

## 5. 누적 차단 효과 (사용자 노출 전)
```
Wave 132 (댓글 ≥ 8 호가 inflated):              94건
Wave 137 (qty > 1 대량 매물):                   19건
Wave 138a (셀러 N≥2 위장 업자):                 71건
Wave 138b (다중 ID 사기 그룹):                   3건
──────────────────────────────────────────────────
누적 도매/사기 차단:                          187건
+ 기존 4 카테고리 (가품/통신사/가격/시세 부적합) 다수
= 전체 7d 차단 1,500~2,000건 추정
```

## 6. retention 효과 (목적)
- safety-stats-badge에 "도매 업자 / 사기 그룹 차단 X건" 표시
- 사용자 인상: "와, 이 사이트 진짜 사기/업자도 걸러내는구나"
- 단순 "위험 매물 차단" 보다 더 구체적 — 도매 업자 / 부캐 사기 그룹 명시
- Wave 129 L4 retention 시그널 강화

## 7. 위험
### 7a. description_hash 충돌 (32자 hex = 128bit)
- 충돌 확률 매우 낮음 (2^128)
- 단 짧은 description (< 50자) NULL → fraud detection 적용 X (default)

### 7b. 정상 셀러가 description 복붙
- 한 사람이 부캐 2개 운영 + 동일 description = 차단됨
- 진짜 사기 그룹과 구분 어려움. 보수적 차단 정당

### 7c. fraudGroupHashes fetch 비용
- pool tick마다 raw_listings 전체 active fetch (20K limit)
- 20K row × 2 컬럼 → response 작음 (< 1MB)
- 매번 fetch라 cache 미적용 — race 시 작은 sample 부정확 가능 (보수적 OK)

## 8. 다음
- 24h 후 측정 — wholesaler/fraud 차단 증가 추이
- 사용자 UI에서 badge 펼쳤을 때 반응 확인
- 보고서 7-Layer + 추가 보강 거의 끝 (L7 보류만)
- 다음 ROI: AI L2 활성화 / 베타 traffic 측정 / 다른 영역

## 9. 거론 금지
- 셀러 reputation 기반 예외 (proshop 인증 등) — 별도 wave
- description_hash 길이 확장 (64자) — 32자로 충분
