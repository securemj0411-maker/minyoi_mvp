# Wave 171/172 — 신발 카테고리 ready 승급

> 2026-05-17. 사용자 명령: "지금 즉시 ready (노출 시작 + 시세 누적 자연)".

---

## 승급 결정 배경

### 시작 (Wave 156 진행 전, 2026-05-15)
- 신발 카테고리 `internal_only`
- catalog 71 SKU
- parse_ready 78%
- 광고/가품 차단: 48 패턴
- 시세 medium: 0

### 진행 (Wave 156-171, 15 wave)
- catalog 80 SKU (Wave 134/138/140)
- parse_ready **87.1%** (recent)
- 광고/가품 **72 patterns** (수렴 도달, 30건 sample 0 false positive)
- 가품 floor 4 tier + Wave 171 outlier ceiling 추가
- condition 분류 정확도 ~75% (mint 41%, clean 20%, worn 11%, unopened 3%, flawed 0.3%)
- 시세 sample max 5 (medium 미달)

### 종합 점검 (5개 영역)

| 영역 | 상태 |
|---|---|
| catalog 매칭 | 100% ✅ |
| parse_ready | 87.1% ✅ |
| 광고/가품 차단 | 4 tier + 72 패턴 (수렴) ✅ |
| pool 안전장치 | qty/comment/seller/desc/ad/floor/ceiling 다 작동 ✅ |
| 시세 광고 제외 (Wave 163) | 검증 (NB 327 광고 76% 매칭이지만 시세 55k 정상) ✅ |
| condition 등급 분류 | 75% (normal 25%는 정보 없음 = 자연 분포) |
| 카테고리 오분류 (가방 등) | 0건 (Wave 166) ✅ |
| 시세 sample medium | **max 5 (목표 5+ 근접)** ⚠️ |

### 사용자 가설 검증 ("last_seen 24h+ = 거래")
- 매물 전체 active (1,743건 / 6h 안)
- disappeared/sold 0건 (lifecycle worker 작동 안 함)
- sweep으로 last_seen 계속 갱신 → 거래 추적 불가
- 사용자 가설 적용 불가

### 사용자 결정 (2026-05-17)
"지금 즉시 ready 승급 (노출 시작 + 시세 누적 자연)"

trade-off 수용:
- 시세 sample 5건 (low confidence) 사용자 카드 노출 — outlier 1건으로 시세 80% 왜곡 위험
- 단 Wave 171 outlier ceiling (msrp * 5) + 4 tier 가품 floor + 72 광고 패턴 safety net
- 시세 자연 누적 (1-2일 후 medium 도달 예상)

---

## Fix

### Wave 171 — price ceiling outlier 차단 (이전 commit `17fc528`)

**candidate-pool-builder.ts**:
- `FAKE_CEILING_RATIO = 5` (msrp의 5배 초과)
- pool 진입 차단
- 발견: NB 992 broad에 236만 매물 (msrp 24.9만 9.5배 = 콜라보/한정/inflate)

**tick-pipeline.ts marketAggregateStage**:
- 동일 ceiling 시세 집계 제외
- 신발/가방 카테고리만

이유:
- 한정판은 별도 narrow SKU (wave91) — broad outlier = 잘못된 매물
- 가품 floor (0.15) + ceiling (5x) 양쪽 outlier 보호
- false positive 위험 X

### Wave 172 — DB UPDATE shoe='ready'

```sql
UPDATE mvp_category_readiness
SET status = 'ready',
    operator_note = 'Wave 172 (2026-05-17): 사용자 결정 ready 승급.
      catalog 100% / parse_ready 87% / 광고/가품 4 tier + 72 patterns 수렴 /
      Wave 171 outlier ceiling 차단.
      시세 sample low confidence 잔존이지만 자연 누적 + safety nets 작동.'
WHERE category = 'shoe';
```

---

## 영향

### 즉시
- 사용자 카드에 신발 매물 노출 시작
- pool 진입 작동: catalog 매칭 → 안전장치 통과 → pool
- 시세 비교: low confidence (sample 5건)도 카드에 표시

### 1-2일 후 (예상)
- 시세 sample medium 도달 SKU 늘어남
- 추천 정확도 자연 ↑

### Safety nets (작동 중)

| 안전장치 | 상태 |
|---|---|
| Wave 138 셀러별 1 pool entry | ✅ |
| Wave 138b 다중 ID 사기 그룹 차단 | ✅ |
| Wave 141 가품 floor tier 1 (msrp * 0.15) | ✅ |
| Wave 145 가품 floor tier 2 (셀러 신뢰도) | ✅ |
| Wave 148 광고 차단 9 patterns | ✅ |
| Wave 152 가품 floor tier 3 (이미지/desc) | ✅ |
| Wave 153 중국 셀러 차단 12 patterns | ✅ |
| Wave 155 가품 floor tier 4 (매우 새 셀러) | ✅ |
| Wave 158 가품 셀러 광고문 7 patterns | ✅ |
| Wave 163 시세 광고 매물 제외 (24 patterns) | ✅ |
| Wave 164 영문+한국어 직역 12 patterns | ✅ |
| Wave 165 이모지 광고 8 patterns | ✅ |
| Wave 171 price ceiling outlier (msrp * 5) | ✅ |

---

## 다음 (모니터링)

1. **시세 sample medium 도달** — 자연 누적 (1-2일)
2. **사용자 카드 피드백** — 신발 매물 잘못된 추천 발견 시 즉시 fix
3. **disappeared/sold 추적** — lifecycle worker 신발 cron 활성 검토 필요
4. **광고/가품 새 패턴** — 사용자 신고 시 추가 차단

---

## 다른 세션 알아볼 핵심 포인트

1. **2026-05-17 shoe 카테고리 ready 승급** (Wave 172).
2. **catalog 80 SKU + parser 87% + 광고/가품 ~72 patterns + 4 tier 가품 floor + outlier ceiling**.
3. **시세 sample 부족 (max 5)** — low confidence이지만 자연 누적 대기.
4. **모든 safety net 작동 중** — pool 진입은 strict 안전. 시세 카드 fetch는 low도 포함.
5. **사용자 가설 (last_seen 24h+)**: lifecycle worker 작동 안 함 → 적용 불가. 시간으로 해결.
6. **다음 모니터링**: 시세 medium 도달 + 사용자 피드백 + disappeared 추적.

## Git Commits

```
17fc528 Wave 171: price ceiling outlier 차단 (msrp 5배)
[next]  Wave 172: shoe='ready' DB UPDATE + decision log
```
