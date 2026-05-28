# Wave 795 — "방금 거래된 상품" 표시 진짜 sold 만 (active 73% leak fix)

- 시간: 2026-05-27 KST
- 트리거: owner 우려 — "피드에 방금 거래된 상품이 대부분이에요 뜨는데 진짜 다 판매완료/예약중인 상품인지".

## 발견 — Owner 직감 정확

DB 검증 (오늘 invalidated 매물 1,073건 분포):

| listing_state | sale_status | count | 진짜 sold? |
|---|---|---|---|
| active | SELLING | 550 | ❌ **active 정상 매물** |
| active | selling | 239 | ❌ **active 정상 매물** |
| disappeared | SELLING | 69 | ✓ disappeared |
| sold_confirmed | SOLD_OUT | 66 | ✓ |
| sold_confirmed | JOONGNA_SOLD_PAGE | 45 | ✓ |
| active | ACTIVE | 41 | ❌ active |
| sold_confirmed | RESERVED | 16 | ✓ |
| sold_confirmed | JOONGNA_STATUS_1 | 13 | ✓ |
| missing_suspect | SELLING | 9 | (의심) |
| sold_confirmed | JOONGNA_STATUS_3 | 7 | ✓ |
| 기타 | | 18 | mix |

**73.5% (789건) 가 active 정상 매물인데 "방금 거래" 라벨**.

## 원인

`/api/packs/pool/route.ts` line 389 sold_out fetch:
```ts
${tableUrl("mvp_candidate_pool")}?select=...&status=eq.invalidated&updated_at=gte.${todayIso}...
```

`mvp_candidate_pool.status='invalidated'` 매물 다 가져와서 `soldOut=true` 박음. 그런데 **invalidated 사유 다양**:
- 진짜 sold (sold_confirmed / disappeared)
- 시세 변동 (sku_median 떨어져 차익 -)
- catalog 변경 후 invalidated (Wave 763~794 같은)
- AI audit reject
- 분류 변경 (sku_id 갱신)

→ active 매물 73% 가 "방금 거래" 표시되는 거짓 정보. owner 코드 주석 (line 2778) 에도 "거짓 정보 가능성" 박혀있었음.

## 변경

`/api/packs/pool/route.ts`:

1. **listingStateByPid Map 추가** — 기존 sourceByPid fetch 에 `listing_state` 컬럼 추가.
2. **realSoldPass filter 추가** — `listing_state IN ('sold_confirmed', 'disappeared')` 만 keep.
3. `soldOutFiltered = soldOutRowsRaw.filter((r) => sourcePass(r) && budgetPass(r) && realSoldPass(r));`

## 예상 결과

- "방금 거래" 표시 매물 ~73% 감소 (active 매물 제외)
- 남는 매물 = 진짜 sold_confirmed / disappeared 만
- 사용자 신뢰 ↑ — 거짓 FOMO 신호 차단

## Follow-up

- missing_suspect 매물 (9건) — 추후 sold 확정되면 매물 포함될지 검토.
- invalidated active 매물은 그냥 ready/invalidated 어디에도 안 보임 (drop). 시세 변동으로 invalidated 된 매물은 catalog rematch 후 다시 ready 진입 가능.
- 매물 카드 표시 톤 — "방금 거래" → 진짜 sold 만 보이므로 라벨 유지 OK.
