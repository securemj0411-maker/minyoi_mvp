# Wave 220 — orphan SKU cleanup + mustNotContain 강화 (2026-05-19)

## 사용자 명시

> "뭐 어쩌자고 ? 계속하라니까?? 뭐 기다리는거 필요하다고?"

→ Wave 219 후속 자율 진행.

## 진단 결과

### 1. Orphan sku_id 2개 (catalog 없는데 raw_listings 박힘)

| sku_id | n | 진단 |
|--------|---|------|
| `bag-lv-monogram-key-pouch` | **96건** | **완전 broken** — "클레" 단어 매칭 (FOG 신발 / 마뗑킴 백팩 / 크록스 / 호카 / 푸마 다 잘못 묶임). catalog 옛 버전에서 박혔다가 사라짐. raw에 stale sku_id 남음 |
| `shoe-nike-airforce-1-low-black` | 79건 | 진짜 AF1 Low Black 매물 — catalog 박혀있어야 하는데 누락. 정상 매물 |

### 2. CV 큰 SKU mustNotContain 부족

- `shoe-fog-fear-of-god-self` (CV 1.46): 매물에 "피어오브갓 8th 밀라노 티셔츠" 의류 매물도 매칭 → shoe SKU 시세 망가짐
- `shoe-crocs-classic-clog` (CV 1.38): 라이트라이드 / 별무늬 디스코 / 퍼클로그 / 베이글리터 / 딜런 / 스톰프 등 별모델 차단 부족

## 코드 fix

### A. `shoe-nike-airforce-1-low-black` catalog 신규 추가
```ts
{
  id: "shoe-nike-airforce-1-low-black",
  brand: "Nike", category: "shoe", laneKey: "nike_airforce_1_low_black",
  modelName: "Nike Air Force 1 Low Black (Triple Black)",
  mustContain: [["에어포스","air force","airforce","af1"], ["블랙","black","검정","올블랙","올검","트리플 블랙"]],
  mustNotContain: [..., "white","화이트","트리플 화이트","흰색", "high","하이","mid","미드",
    "supreme","구찌","off-white","sacai","travis"],
  msrpKrw: 139000,
}
```

→ 83건 매물 정상 매칭 + 풀 진입 가능.

### B. `shoe-fog-fear-of-god-self` mustNotContain 강화
의류 매물 차단: `티셔츠 / tee / 맨투맨 / 후드 / 후디 / hoodie / v넥 / 밀라노`

### C. `shoe-crocs-classic-clog` mustNotContain 강화
별모델 차단: `디스코 / 별무늬 / 라이트라이드 / 딜런 / 스톰프 / 베이 글리터 / 글리터 / 퍼 클로그 / 언퍼게터블 / 비건`

### D. orphan `bag-lv-monogram-key-pouch` 96건 cleanup (destructive)

```sql
UPDATE mvp_raw_listings 
SET sku_id = NULL, sku_name = NULL, score_dirty = true, updated_at = now()
WHERE sku_id = 'bag-lv-monogram-key-pouch';
```

영향:
- 매물 자체 보존 (UPDATE only, DELETE 아님)
- sku_id NULL → 다음 cron 재매칭 시도 (새 catalog 규칙으로 정확한 분류)
- 시세 daily 옛 키 자연 expire

검증: bag-lv-monogram-key-pouch 96 → 0 매물 ✅

### E. LANE_READINESS — `nike_airforce_1_low_black` 신규 ready

## verify

- test:core **562/562 pass** ✅ (Wave 219 fail 났던 me-comment-count-gate-contract 도 통과)
- orphan cleanup OK
- AF1 Low Black 83건 매물 catalog 매칭 가능

## 다음 자연 처리

- 자연 cron → AF1 Low Black 83건 풀 진입 시도
- "클레" 잘못 매칭됐던 96건 → 새 catalog 규칙으로 재매칭 (FOG/마뗑킴/크록스 등 정확한 SKU)
- shoe-fog / shoe-crocs CV 감소 측정 (Wave 221 후속)

## decision log

이 파일 push 후 사용자에 보고.
