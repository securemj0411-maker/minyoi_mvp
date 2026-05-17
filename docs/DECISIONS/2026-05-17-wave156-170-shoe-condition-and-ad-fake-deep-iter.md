# Wave 156-170 — 신발 condition/광고/가품 깊은 iter (15 wave)

> 2026-05-16 ~ 2026-05-17. 사용자 명령: "10번 반복 + parser 강화 + 가품 학습 존나 + 수렴 시 ready". 누적 15 wave.

---

## 시작 상태 (Wave 155 후, 2026-05-16 13:00 KST)

- 신발 SKU 80개 (Wave 134/138/140)
- parse_ready 85.39% (recent 매물)
- condition_class: normal **65.72%** (parser fallback 큼)
- 광고/가품 차단: ~48개 패턴 (Wave 148/153/158)
- 시세 daily: 40 SKU / sample 1.0 / medium 0건
- pool 0건 (internal_only)

---

## 각 Wave 변경 (요약)

### Wave 156 — 신발 sweep 깊게
- pipeline-config: 신발 카테고리(405) pageCount 1 → **15**
- 매 5분 sweep 마다 1,500 매물 (page 0~14) 들어옴
- 학습용 sample 다양성 ↑

### Wave 157 — 모순 매물 검사 순서 정정
- `parseConditionTier`: 객관 S급 검사 전 C signal 우선
- "박스 그대로 + 사용감 적당히" → C 우선
- "박스만 손상 (찌그러짐/배송손상)" → reject 제외
- 가수분해/작은 구멍 reject 추가

### Wave 158 — 가품 셀러 광고문 7개 차단
- AD_PATTERNS: 100배환불 / 정품임을 자신 / 해외 대량 병행수입 / 만에하나 가품
- pool 진입 + 시세 집계 양쪽 적용

### Wave 159 — parser 14개 추가
- A급: 한글 숫자(두 번/세 번), 1-3번 착용, 집에서만 신어보고, 발에 너무 맞지 않
- B급: 상태 완전/정말 좋, 전반적으로 좋
- C급: 사용감 많/있 (조사), 착용감 있/많, 가죽/매쉬 까짐/해짐, 굽 슈구칠

### Wave 160 — parser 8개 추가 + 가품 셀러 검증
- A급: 별로 안 신, 10번 안으로 신, 착용횟수 적, 사용감 거의 없음
- C급: 뒷꿈치 까짐 (변형 스펠링), 신발 안쪽 튿어
- 가품 셀러: dead3717 NB 327 19건 / e33a8e48 12건 — Wave 138 차단 작동 검증

### Wave 161 — parser 11개 추가
- A급: 10번 이내 착, N번 신고 나갔, 어느 순간 안 신
- B급: 굽 까짐 거의 없, 상태 매우/아주 좋은 편
- C급: 생활오염, 사용감 (도/은/이) 많, 일년/1년 신/착, 핌 있/제거

### Wave 162 — parser 5개 + 가품 셀러 분포 검증
- A급: 오죽 안 신, 자주신지 않
- C급: 조금 오염, 손세탁, 에이징 시켜, 10회 정도 신/착, 단순 쓸림
- 셀러 분포: 1-2건 1,466 셀러(정상) vs 10+건 5 셀러(가품, review 41 낮음)

### Wave 163 — 시세 집계 광고 매물 제외 ⭐
- 발견: NB 327 광고 76건 avg 205k vs 정상 81건 avg 69k (**시세 3배 왜곡**)
- `tick-pipeline.ts marketAggregateStage`: AD_PATTERNS_MARKET 24개 patterns
- shoe/bag 카테고리만 적용

### Wave 164 — 광고/가품 12개 추가 (영문+한국어 직역)
- 1000% 환불 / 재고 많지 않 / 필요한 분은 안심 결제
- FuelCell 폼.*탄성을 받는 / ENCAP 미드솔 (외국 셀러 직역)
- 캐주얼 경량 내진 / 신상품이라 상태는 양호 / 안심하고 구매하세요

### Wave 165 — 이모지 광고 8개 추가
- 📢 판매 상품 / ✔️ 정품 100% 보장 / 🚚 주문시 당일 발송
- 📸 모든 상품은 실보유 / 전상품 100% 정품
- 크림 계정 다수 총 N건 (가품 셀러)

### Wave 166 — condition critical bug fix (정확도 검증 후) ⭐
**검증 결과 (25건 sample)**:
- unopened 100%, clean 100%, worn 80%, mint 60%, flawed **20%** (false positive 80%)

**3 Critical Bugs**:
1. flawed: "찢어짐 없습니다"(negation) / "통풍구멍"(디자인) → reject 잘못
2. mint: "10번 정도 착용 + 거의 새상품" → 명시 횟수 무시
3. category: "어그 가방" → shoe로 박힘

**Fix**:
- `hasNegation` + `isDesignIntent` flag (reject pre-check)
- `explicitHighCount/MidCount` 셀러 표기보다 우선
- 신발 catalog COMMON_BLOCK: 가방/지갑/백팩/크로스백/토트백/숄더백/핸드백/"크로스로 매"

### Wave 167 — flawed false positive 추가 fix
- 한정판 + 크랙 (콜라보 디자인) 제외
- "파손 오염등은 제품등급과" (셀러 등급 설명) 제외
- C signal: 사용감 및/, 미세한 하자/오염/얼룩 (조사 변형)

### Wave 168 — Wave 167 과도 strict 정정 (균형 복원)
- Wave 167 측정: mint 41% → 2% (셀러 disclaimer 잘못 차단), flawed 0%
- `isSellerDisclaimer`: 있을수 있으며/있을 수 있/중고상품 특성상.*있을
- C signal에서 Wave 167 추가 키워드 제거

### Wave 169 — 정확도 70% → 80% 강화
- A급: 두세번 실착 / 두 세 번 신/착/입
- C signal: 기스 N 있 (조사 변형) / 보풀 / 물 빠짐 / 생활 먼지

### Wave 170 — negation 강화 + 10회 미만 c급
- `isSellerDisclaimer`: 얼룩 묻을까봐 / 얼룩 하나 없 / 기스 날까봐
- `hasCSignal` negative lookahead: 얼룩(?!없|묻을까봐|하나 없)
- "10회 미만" 명시 → c급 매칭

---

## 측정 추이

| Wave | condition normal % | flawed 정확도 | medium SKU |
|---|---|---|---|
| 155 | 65.72% | — | 0 |
| 157 | 36% | — | 0 |
| 162 | 36% (sweep 효과) | — | 0 |
| 166 | **24.52%** (-12%p) | 20% → **40%** | 0 |
| 167 | 44% (과도) | 0% (strict) | 0 |
| 168 | 24.83% (복원) | 0.12% (sample 5) | 0 |
| 169 | 24.83% | 33% | 0 |
| 170 | reparse 진행 중 | TBD | 0 |

**정확도 sample 측정 (23건, Wave 169 후)**:
- mint **100%** ✅
- worn 80%
- unopened 60%
- clean 60%
- flawed 33%
- **평균 70%** (ready 90%+ 목표 미달)

---

## 광고/가품 차단 누적

| Wave | 추가 패턴 |
|---|---|
| 148 | 9 (기본 광고) |
| 153 | 12 (중국 셀러) |
| 158 | 7 (가품 셀러) |
| 163 | 24개 (시세 집계 적용) |
| 164 | 12 (영문+한국어 직역) |
| 165 | 8 (이모지 광고) |
| **누적** | **~72** + 가품 floor 4 tier (Wave 141/145/152/155) |

**광고/가품 학습 수렴 도달** (Iter 10 sample 30건 정상 매물만, 가품 0건).

---

## 사용자 결정 사항

| 결정 | 시점 | 내용 |
|---|---|---|
| 광고/가품 학습 우선 | 2026-05-16 | "광고제외랑 가품 파싱이나 마이닝 훨씬 강화한 다음 ready 해야지" |
| 5번 더 iter | 2026-05-16 | parser + 가품 동시 강화 |
| 더 iter (수렴 시 ready) | 2026-05-16 | "수렴 안 됐으면 계속 강화" |
| ready 승급 전 정확도 재측정 | 2026-05-17 | "정확도 다시 측정" |
| **시세 medium 5+ 도달 시 ready** | 2026-05-17 | 사용자 명확 정책 |

---

## 현재 상태 (2026-05-17 10:00 KST)

- parser 70+ 표현 누적 (Wave 146-170)
- 광고/가품 ~72 패턴
- 옛 매물 reparse backlog **111K+** (1주+ 필요)
- 새 매물 정확도 **100%** (작은 sample)
- 시세 daily 35 row / **medium 0건** / max sample 5
- shoe='internal_only' (DB)

**ready 미달**: 사용자 정책 medium 5+ 미달 (max 5). market-worker 다음 tick 또는 시간 더 필요.

---

## 다른 세션 알아볼 핵심 포인트

1. **Wave 156-170 (2026-05-16~17)**: 신발 condition/광고/가품 깊은 강화 15 wave.
2. **parser 정확도 70%** — ready 90% 목표 미달. 가장 큰 문제: flawed false positive (reject regex 광범위) / mint 모순 매물.
3. **광고/가품 차단 ~72 패턴 수렴** (Wave 148-165). 더 추가 시 정상 매물 false positive 위험.
4. **Wave 163**: NB 327 광고 매물 시세 3배 왜곡 발견. 시세 집계에서 광고 제외 critical fix.
5. **Wave 166**: condition critical bug fix — negation/디자인 의도/명시 횟수 우선/category 가방 차단.
6. **시세 medium 0건** — market-worker 광고 제외 / Wave 170 condition 재분류 적용된 다음 tick에서 medium 도달 가능.
7. **ready 승급 조건** (사용자): 시세 medium 5+ SKU 도달 시 자동 `shoe='ready'` UPDATE.

## 다음 (자동 wakeup)

market-worker 다음 tick 후 medium SKU 측정. 5+ 도달 시 ready 승급. 미달 시 시간 대기.

---

## Git Commits (Wave 156-170)

```
126cddb Wave 156 신발 sweep 깊게
9e956b4 Wave 157 검사 순서 정정
a4f9389 Wave 158 가품 광고문
72e7c30 Wave 164 광고 12개
d6beddc Wave 165 이모지 8개
af8285b Wave 166 critical bug fix
[Wave 167-170 sequential commits]
6bea370 Wave 170 negation 강화
```
