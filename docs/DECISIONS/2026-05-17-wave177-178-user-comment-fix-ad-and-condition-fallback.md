# Wave 177/178 — 사용자 코멘트 2건 fix (광고 차단 + condition fallback)

> 2026-05-17. 사용자 운영자 풀 코멘트 2건 확인. 둘 다 자율 fix (사용자 명령 "둘 다 자율 fix").

---

## 발견

### 코멘트 1 (pid 406085654, smartphone) — "이런거 안거르냐...??"

매물 정보:
- name: "헬로우*비 고객님 (아이폰 15 128G)"
- price: 230,000 / sku_median: 506,000 = **차익 ₩276k (band 3급)**
- comparable_key: `iphone|iphone_15|128gb` — narrow ready lane
- desc: "헬로우*비 고객님 개인 결제창입니다."

사기 패턴 (특정 사용자 결제용 매물 — 일반 거래 X):
- 마스킹 이름 + 고객님 ("헬로우*비 고객님")
- 개인 결제창 ("개인 결제창입니다")

### 코멘트 2 (pid 258306715, shoe) — "새상품이랑 민트급은 다른거아니야??"

매물 정보:
- name: "나이키 덩크 로우 캔더키"
- condition_class: **mint** (parser "새제품급" → mint OK)
- price 80k / sku_median 124.5k

사용자 지적: 카드에 노출되는 시세가 다른 unopened/새상품 매물과 묶여 부풀어지는 거 아니냐.

## 원인

`condition-fallback.ts` chain — **위로 fallback 허용**:
```typescript
mint: ["mint", "unopened", "clean", "normal", "all"],   // ⚠️ mint → unopened
clean: ["clean", "normal", "mint", "all"],              // ⚠️ clean → mint
```

mint 매물 시세 sample < 3건이면 unopened 시세(다나와 새 가격) fallback → 시세 부풀어짐. clean도 mint로. 사용자 의문 정확.

---

## Fix

### Wave 177 — 광고 패턴 추가 (개인 결제창 + *고객님)

`candidate-pool-builder.ts` AD_PATTERNS + `tick-pipeline.ts` AD_PATTERNS_MARKET 양쪽:

```typescript
/개인\s*결제창/,                              // "개인 결제창입니다"
/[가-힣A-Za-z]+\*+[가-힣A-Za-z]?\s*고객님/,   // "헬로우*비 고객님" 마스킹 이름
/고객님\s*(?:개인|전용)\s*(?:결제|페이지|링크)/, // "고객님 개인 결제/전용 링크"
```

DB invalidate:
```sql
UPDATE mvp_candidate_pool
SET status = 'invalidated', invalidated_reason = 'wave177_ad_personal_payment_link'
WHERE pid = 406085654;
```

같은 패턴 다른 ready 매물 — **0건** (1건만 영향).

### Wave 178 — condition fallback chain "위로" 차단

`condition-fallback.ts`:
```typescript
unopened: ["unopened", "mint", "clean", "normal", "all"],   // 그대로 (premium, 아래로만)
mint: ["mint", "clean", "normal", "all"],                    // ❌ unopened 제거
clean: ["clean", "normal", "worn", "all"],                   // ❌ mint 제거 (위로 차단)
normal: ["normal", "clean", "worn", "all"],                  // normal↔clean 가까움 — 유지
worn: ["worn", "normal", "all"],                             // 그대로
low_batt/flawed/all: 그대로
```

원칙: 시세 추정 보수적 (precision > recall) — 위로 fallback (더 비싼 condition 시세 흡수) 차단. mint 매물이 unopened 시세 받는 거 불허, clean 매물도 mint 시세 받는 거 불허. 차익 과대 추정 방지.

---

## 검증

- `npx tsc --noEmit` → 변경 파일 에러 0건
- `npm run test:core` → **325/325 pass / 0 fail**
- 매물 1건 즉시 invalidate (`wave177_ad_personal_payment_link`)
- 동일 패턴 ready 매물 0건 (이 1건만 영향)

---

## Trade-off

| 측면 | 영향 |
|---|---|
| 사기 매물 차단 | 개인 결제창 / 마스킹 고객님 즉시 차단 (정상 매물 false positive risk 0) |
| 시세 정확도 (mint/clean) | sample 부족 시 unopened/mint 위 시세 fallback 차단 — 더 정확. 시세 sample 부족 매물은 `all` fallback (안전) |
| Recall | sample 부족 mint 매물 일부는 fallback 못 잡아 sku_median=0 → pool 진입 X. 정확성 우선 |
| 다른 카테고리 | 영향 X (코드 공통이지만 condition_class 매물 모두 적용 — 의도) |

---

## 다른 세션 알아볼 핵심 포인트

1. **2026-05-17 Wave 177**: AD_PATTERNS에 `개인 결제창`, `*고객님`, `고객님 개인/전용 결제/링크` 추가.
2. **Wave 178**: `condition-fallback.ts` chain 정정 — mint → unopened, clean → mint **위로 fallback 차단**.
3. **사용자 코멘트 (베타테스터 운영자 풀)**: pid 406085654 / pid 258306715.
4. **시세 정확도**: 사용자 매물 (mint)의 시세가 unopened 가격으로 부풀어지지 않음.

## Git Commits

```
[next] Wave 177/178: 광고 차단 (개인 결제창) + condition fallback 위로 차단
```
