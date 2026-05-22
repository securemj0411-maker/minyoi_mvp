# 2026-05-22 — Launch additional: detail-access liveType=unknown 통과

## 사용자 짚음
> "잠깐만 이거뭐야??? 크레딧 999인데 크레딧 부족이 아닌데 상세보기 대상이
>  아니에요... 레고 75331 Ucs딘자린 만달로리안... 방금 거래된 상품 이런식으로
>  된거도 아닌데"

## 진단 (DB 직접 확인 — pid=404521545)
| 항목 | 값 |
|---|---|
| candidate_pool.status | `invalidated` |
| invalidated_reason | **`detail_access_live_unknown`** ← 핵심 |
| ai_audit_status | reject ("부품만, 풀세트 아님") |
| listing_state | `active` |
| sale_status | `SELLING` |
| last_seen | 9시간 전 (살아있음) |

= 번개엔 살아있는데 우리 verify 가 막은 거.

## 원인
`/api/packs/pool/detail-access/route.ts:266~310` 의 `verifyBeforeDetailAccess`:
- `classifyListing` 호출 → SKU rule match 실패 → `listingType="unknown"` 반환
- 기존 코드: `if (liveType !== "normal")` → unknown 도 invalidate
- LEGO 75331 = 우리 SKU 카탈로그에 없음 → 항상 unknown → 항상 막힘

**두 검증 룰 충돌**:
- 풀 진입: comparable_key + AI audit → ready 통과
- detail-verify: classifyListing SKU rule → unknown → invalidate

사용자 입장 = 카드는 보이는데 클릭하면 막힘 → 신뢰 박살.

## fix (옵션 A — 빠른 친화)
`verifyBeforeDetailAccess` 의 두 분기 (joongna, bunjang) 다 변경:
```ts
if (liveType !== "normal" && liveType !== "unknown") {
  // invalidate
}
```

unknown 만 통과. multi/callout/part/batch 등 다른 분기는 그대로 invalidate.

## DB 복구
잘못 막힌 매물 자동 복구:
```sql
UPDATE mvp_candidate_pool
SET status='ready', invalidated_reason=NULL, updated_at=now()
WHERE status='invalidated' AND invalidated_reason='detail_access_live_unknown'
  AND ... (listing_state='active' AND sale_status='SELLING' AND 최근 7일)
```

영향 = **5개 매물 복구** (404521545 LEGO 포함).

## 안 풀린 거 (후속)
- `ai_audit_status='reject'` 인 매물이 풀에 ready 노출되는 별 이슈
- AI audit 결과를 candidate_pool.status 에 반영하는 게 정공법 — 별 wave
- 풀 진입 룰과 detail-verify 룰 통합 (옵션 B) — 후속 wave

## 검증
- TypeScript compile clean
- DB 5개 매물 ready 복구
- production deploy 후 LEGO 매물 클릭 → 통과 확인 필요
