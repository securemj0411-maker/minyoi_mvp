# Wave 179 — 에어팟/이어폰 한쪽 단품(유닛) 본품 시세 흡수 차단

> 2026-05-17. 사용자 코멘트 pid 343583659 "??? 왼쪽이 어떻게 올라온거지?". 즉시 fix.

---

## 발견

매물 pid 343583659:
- name: "에어팟프로2세대 C타입 **왼쪽**, A-급,7B21(GX5L~), A3048"
- comparable_key: `airpods|airpods_pro_2` — narrow ready lane
- price 69,100 / sku_median 142,000 = **차익 ₩72,900 (band 2)**
- condition_class: worn
- desc: "C타입의 프로2세대 **유닛입니다** ... A2968 **본체와 호환**됩니다"

문제: 에어팟 **한쪽(왼쪽 유닛)만** 매물인데 본품(좌+우+케이스) 시세 142k 대비 매겨져 priceGap 부풀어짐. 사용자 카드에 본품인 척 노출. parser/catalog 단계 차단 실패.

원인: `airpods-pro-2` 등 일부 SKU에 `HEADPHONE_NOISE` spread 안 들어가 있었음 + HEADPHONE_NOISE 자체에 "한쪽/유닛" 패턴 누락.

---

## Fix

### Fix A — `HEADPHONE_NOISE` 패턴 확장 (catalog.ts)

```typescript
// Wave 179 추가:
"왼쪽만", "오른쪽만", "좌측만", "우측만",
"왼쪽 유닛", "오른쪽 유닛", "좌 유닛", "우 유닛",
"한쪽만", "한쪽 구매", "한쪽 판매", "한쪽 유닛",
"유닛만", "유닛 판매", "유닛입니다",
"본체와 호환",  // 부품 시그널 ("이건 본체 아님")
"충전 케이스만", "충전케이스만",
```

원칙: 명시 패턴만 (false positive 차단). 단독 "왼쪽" / "유닛" 은 정상 매물도 사용 → 제외.

### Fix B — SKU inconsistency 해소

`airpods-pro-1`, `airpods-pro-2` SKU에 `HEADPHONE_NOISE` spread 추가:
- airpods-pro-3, airpods-4-anc 는 이미 박혀있음
- airpods-pro-1, airpods-pro-2 만 빠져있었음 → 일관성 정정

이제 모든 AirPods SKU + earphone 카테고리에 단품 차단 자동 적용.

### DB invalidate

```sql
UPDATE mvp_candidate_pool
SET status = 'invalidated', invalidated_reason = 'wave179_earphone_single_unit'
WHERE pid = 343583659 OR ... 같은 패턴 매물;
```

같은 ready 매물 — **pid 343583659 단 1건만** (다른 패턴 매물 0).

---

## 검증

- `npx tsc --noEmit` → catalog.ts 에러 0건
- `npm run test:core` → **325/325 pass / 0 fail**

---

## 영향

| 측면 | 영향 |
|---|---|
| AirPods 단품 매물 | catalog ruleMatch 단계에서 차단 → comparable_key 안 생김 → pool 진입 X |
| 정상 매물 false positive | 패턴 명시("만"/"입니다"/"호환") — risk 매우 낮음 |
| 다른 earphone SKU | HEADPHONE_NOISE 공통 적용 — Sony WH, Beats 등 자동 보호 |
| 시세 daily | 이 매물 자체가 시세 sample에서도 제외됨 (catalog 매칭 X) |

---

## 다른 세션 알아볼 핵심 포인트

1. **2026-05-17 Wave 179**: 에어팟 한쪽 단품 매물 본품 시세 흡수 차단.
2. **HEADPHONE_NOISE 확장** — 카테고리 공통 reject 패턴 (왼쪽만/유닛만/본체와 호환 등).
3. **SKU inconsistency 해소**: airpods-pro-1, airpods-pro-2 에 HEADPHONE_NOISE spread 추가.
4. **본체와 호환 패턴** — "A2968 본체와 호환" 같은 부품 시그널 차단.

## Git Commits

```
[next] Wave 179: 에어팟 한쪽 단품 본품 시세 흡수 차단 + airpods-pro-1/2 HEADPHONE_NOISE 일관성
```
