# Wave 818b — 비교매물 query 에 detail_status=eq.done 추가 (시세 vs 비교매물 strict filter align)

날짜: 2026-05-30
범위: 2 endpoint (lookup, market-source) 비교매물 query 1줄 fix
관련: Wave 814-818 (tier-aware 시세 lookup), Wave 886.15 (lookup/market-source 필터 통일)

## 배경

Wave 814-818 박은 후 다른 세션 sanity check (clothing|polo_knit_sweater|knit|b_grade 폴로 빈티지 니트):

| 지표 | 값 | sample |
|------|-----|--------|
| `mvp_market_price_daily` B-tier cc="" | 82,800원 | 8 (strict) |
| 비교매물 peer raw active median | 45,000원 | 790 (lenient) |

→ 시세 자체는 정상 (8 strict sample 82.8K). 모순은 비교매물 list query 의 **lenient filter** 때문 — bundle/구성품/outlier 가 790 raw active 안에 박힘.

`mvp_market_price_daily` 의 sweep query (`daangn-price-sweep.ts:275`) 는 `detail_status=eq.done` 적용. 하지만 lookup + market-source 의 비교매물 fetch query 는 `detail_status` 필터 **없음** → detail fetch 미완료 매물 (price/condition 노이즈) 도 비교매물에 들어감.

## 변경

### `/api/lookup/by-url/route.ts:483`

```diff
- `${tableUrl("mvp_listing_parsed")}?select=...&comparable_key=eq.${...}&needs_review=eq.false&limit=480`
+ `${tableUrl("mvp_listing_parsed")}?select=...&comparable_key=eq.${...}&needs_review=eq.false&detail_status=eq.done&limit=480`
```

### `/api/listings/[pid]/market-source/route.ts:229`

```diff
- `${tableUrl("mvp_listing_parsed")}?select=pid&comparable_key=eq.${...}&needs_review=eq.false&limit=${MAX_COMPARABLES * 6}`
+ `${tableUrl("mvp_listing_parsed")}?select=pid&comparable_key=eq.${...}&needs_review=eq.false&detail_status=eq.done&limit=${MAX_COMPARABLES * 6}`
```

## 영향

- 비교매물 칩 개수 ↓ (detail fetch 미완료 매물 제외).
- 비교매물 가격 분포 = `mvp_market_price_daily` 시세 분포 = 같은 strict filter → 모순 해소.
- 사용자 UX: "비교매물 N 개" 숫자 줄지만, 신뢰도 ↑.

## Backward-compat

- 코드 변경만 — DB schema 무변경.
- 옛 detail_status=null 매물은 비교매물 list 에서 제외, 시세 sweep 에서도 이미 제외 (Wave 90+).

## TS check

`npx tsc --noEmit` — src/ 0 error.

## Follow-up

- 사용자 화면 1회 확인 권장: lookup 비교매물 개수 / market-source detail 모달 비교매물 개수가 시세 sample 수와 비슷한 자리수에 모이는지.
- Wave 886.15 가 박은 condition strict-with-fallback (`requireKnownCondition`) 정책은 그대로 — detail_status 만 추가.

## Sign-off

자율 진행 — Wave 814-818 wave chain 연장 + 사용자 위임 ("결국 해야되는거면 해야지").
다른 세션 (Wave 886.16/886.16b 작성자) 의 sanity check 결과에 직접 응답.
