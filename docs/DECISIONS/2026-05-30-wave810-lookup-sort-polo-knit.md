# Wave 810 — /lookup 비교매물 정렬 + Polo 니트 narrow 차단

- 시간: 2026-05-30 KST
- 트리거: owner — "비교 매물 큰 가격 순으로 / 폴로 메쉬 니트 다른 매물 같은데? 파싱 미스?"

## Owner case (실측)

owner 가 /lookup 으로 조회:
- 본 매물: "폴로 랄프로렌 케이블 니트 S 퍼플(라벤더)" ₩80K
- 시세: ₩101,200 (표본 3건, 상태 신뢰도 35%)
- 비교 매물 12개 — 정렬 first_seen_at.desc (등록 최신순)

문제:
1. **정렬 random** — ₩10K / ₩175K / ₩30K / ₩130K 뒤죽박죽
2. **함정 매물 박힘** — "폴로 랄프로렌 메쉬 니트 코튼 쿼터집 스웨터 M" ₩130K = 케이블 니트 X (메쉬 직조 + 쿼터집)
3. **라벨 헷갈림** — "표본 3건 / 신뢰도 35% / 비교매물 12개" 셋 다 다른 의미인데 명확 X

DB 확인 — 두 매물 다 sku_id = `clothing-polo-knit-sweater`. SKU 가 너무 broad (sku_name: "Polo 니트/케이블/꽈배기/V넥/롤넥/페어아일").

## 변경

### Wave 810a — /lookup 정렬 + 라벨 명확화

**`src/app/api/lookup/by-url/route.ts`**:
```ts
// 기존: order=first_seen_at.desc (등록 최신순)
// 변경: order=price.desc (가격 높은 순) ← 사용자 매물 가격 근처 + 더 비싼 매물이 위
```

**`src/app/lookup/lookup-client.tsx`** 라벨 명확화:
- "표본 N건" → **"시세 계산 표본 N건"** (비교매물 12개와 구분)
- "신뢰도 X%" → **"상태 분석 신뢰도 X%"** (시세 신뢰도가 아님 — condition parsing 신뢰도)
- "비교 매물 12개" → **"비교 매물 12개 · 가격 높은 순"** (정렬 명시)
- 표본 부족 경고: "시세 신뢰도가 낮아요" → **"시세 계산에 쓴 표본이 N건뿐이라 시세 신뢰도가 낮아요. 비교 매물 12개는 display 만 — 일부는 가격 outlier 라 시세 계산에서 제외됨"**

### Wave 810b — Polo 니트 SKU mustNotContain 확장

**`src/lib/generated/catalog-712b-bias-free.ts` 의 `clothing-polo-knit-sweater`**:

추가 mustNotContain:
- **메쉬 니트** / mesh knit (다른 직조)
- **쿼터집 / 쿼터집업** / quarter zip (다른 product type — 케이블/V넥/롤넥 풀오버와 별도)
- **하프집업** / half zip / halfzip / 1/2 zip
- **풀집업** / full zip / full-zip
- **집업 니트** / zip-up knit
- **후드 니트** / hood knit / hooded knit
- **터틀넥** / turtleneck

근거 — Wave 798a (Barbour 콜라보 차단) 패턴 그대로:
- 같은 brand 안에서도 직조/type 다르면 가격대 다 다름
- 같은 SKU 묶이면 시세 평균 왜곡
- catalog 차원 차단 = 가장 안전 (madTrim 임계점 건드리지 않음)

## DB rematch

```
Wave 810b rematch: 136건 (메쉬/쿼터집/하프집업/풀집업/후드 니트/터틀넥)
parser_version = '0' reset → 다음 cron tick 에 재분류
```

136건 = `clothing-polo-knit-sweater` 매물 중 메쉬/쿼터집/하프집업 등 다른 라인 변형. 재분류 후:
- mustNotContain 통과 못 함 → sku_id NULL 됨
- 또는 다른 SKU 매칭 (없으면 unmatched 풀로)
- 결과: polo-knit-sweater 의 시세 표본 더 깨끗해짐

## Follow-up

### narrow split 후보 (별도 wave)
지금은 mustNotContain 차단만. 메쉬 니트 / 쿼터집 / 하프집업 매물 자체는 unmatched 풀로 가서 시세 모름.

만약 owner 가 원하면:
- `clothing-polo-mesh-knit` 별도 SKU (메쉬 직조 라인)
- `clothing-polo-quarter-zip` 별도 SKU (쿼터집업 / 하프집업)
- `clothing-polo-hooded-knit` 별도 SKU (후드 니트)

매물 수 보고 결정 (현재 136건 = narrow split 박을 만 vs broad SKU 안 박는 게 안전한지).

### Wave 806 follow-up 미박힘
- daangn sweep cron throughput (49% stale)
- 별도 wave 검토 필요
