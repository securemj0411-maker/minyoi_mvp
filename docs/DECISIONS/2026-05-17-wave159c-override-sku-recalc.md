# Wave 159c — override 시 sku_id 재계산 (필수 fix)

- 시간: 2026-05-17 KST

## 발견

Wave 159 박은 후 sample 측정:
```sql
SELECT listing_type, COUNT(*) FILTER (WHERE sku_id IS NOT NULL ...)
FROM mvp_raw_listings WHERE listing_type IN ('accessory', 'parts', ...)
```

**결과: 차단된 매물 100% sku_id NULL.**
- accessory 10,744건 중 0건 sku_id 보유
- parts 5,280건 중 0건
- unknown 84,014건 중 0건

이유: `pipeline.ts ruleType()` 이 listing_type을 normal이 아니면 SKU 매칭을 건너뛰고 sku_id=null 반환. detail-worker가 그대로 raw_listings.sku_id=null 박음.

scoreStage query는 `&sku_id=not.is.null` 조건 → 운영자가 override 박아도 풀 진입 불가. **Wave 159 override 인프라 사실상 무용지물이었음.**

## 변경

[/api/admin/listing-type-override](mvp/src/app/api/admin/listing-type-override/route.ts):
- override='normal' 박을 때 sku_id가 null이면 ruleMatch(name, description_preview)로 재계산
- 결과 sku/skuName을 patch payload에 같이 박음
- response에 `skuRecalculated` 필드 추가 (디버깅용)

```typescript
if (override === "normal") {
  // fetch raw row → ruleMatch → sku_id 재계산
}
```

## 검증
- typecheck production clean.
- ruleMatch는 `@/lib/catalog`에서 export — 동일 함수 사용 (일관성).
- description_preview 500자 cap이라 부정확 가능. 대부분 매물은 title+짧은 desc로 충분.

## 위험
- ruleMatch가 SKU 못 찾으면 (catalog 미등록 카테고리) sku_id=null 그대로 → override 박혀도 풀 진입 X. 단 그건 catalog 부재 문제 (별도). 운영자에게 알림: response `skuRecalculated=null`이면 catalog 등록 안 됨.
- override='normal'이 아닌 다른 값 (예: 'accessory' override) 시 sku_id 재계산 안 함 — 의도된 동작 (풀에 안 넣을 거니까).

## 다음
- UI에서 `skuRecalculated=null` 시 경고 표시 (catalog 미등록).
- ruleMatch 실패 매물 → AI L2 분류 escrow 트리거 검토 (별도).
