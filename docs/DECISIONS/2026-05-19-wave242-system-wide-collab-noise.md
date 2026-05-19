# Wave 242 (2026-05-19) — system-wide designer collab 자동 차단 (intersect-aware)

## 발단

사용자: "아니 왜 특정 옷들 fashion만 내가 코멘트 단것만 하는거야?? ㅋㅋㅋ 해당 패턴이 왜 일어났는지 다른 fashion sku, lane 에서 같은거 발생하겠구나 생각한다음에 제대로 근본적으로 다 해결해야되는거 아닌가...??"

→ Wave 241 가 8건 코멘트만 좁게 fix. **패턴은 system-wide** — designer collab variant mismatch 는 fashion 전반 발생.

## 근본 진단

| 패턴 | 좁게 발견 | system-wide 일반화 |
|---|---|---|
| designer collab 가격 차 | Asics × Thom Browne | Nike × Off-White/Sacai/Travis Scott / Adidas × Yeezy/Wales Bonner/Pharrell / NB × Kith/ALD / BAPE × CDG/Travis/Stussy/세인트미카엘 ... 모든 brand |
| cross-category brand | BaoBao × Camper 신발 | 모든 bag SKU 의 brand 신발/clothing, clothing SKU 의 bag/신발 |
| 한정판/collab 가격대 차 | BAPE tee 45~520k | Stussy hoodie/Polo Bear/FOG/TNF Supreme/Coach broad 다 같은 패턴 |
| edition/material variant | RRL 벨트 caiman | LV/Gucci/Prada vintage, Margiela Tabi 소재 |

## fix architecture

### GLOBAL_DESIGNER_COLLAB_NOISE 신설

`src/lib/catalog.ts` — 모든 designer collab brand 한 위치 정의 (50+ brand):
- 즉시 fix patterns 일반화 (톰브라운/jjjjound/kiko/anderson bell)
- designer/럭셔리 (travis scott/tom sachs/off-white/sacai/fragment/dior/tiffany/lv/cdg/kaws)
- streetwear (supreme/fog/stussy/wtaps/neighborhood)
- 신발 designer (wales bonner/pharrell/sporty rich/kith/ald/joe freshgoods/salehe bembury/ronnie fieg)
- 한정 한국/일본 (세인트미카엘/swarovski/newjeans)
- 명품/collab (moncler/cecilie bahnsen/brain dead/junya/denim tears)

### intersect-aware 차단 로직 (skuMatches)

```ts
if (sku.category === "clothing" || sku.category === "shoe" || sku.category === "bag") {
  // ... existing checks ...
  
  // Wave 242: system-wide designer collab 자동 차단.
  const skuTokens = new Set<string>();
  for (const group of sku.mustContain) {
    for (const t of group) skuTokens.add(t.toLowerCase());
  }
  for (const token of GLOBAL_DESIGNER_COLLAB_NOISE) {
    if (skuTokens.has(token.toLowerCase())) continue; // 자기 brand 면 skip
    if (tokenHit(normalizedText, token)) return false;
  }
}
```

**policy:**
- sku.mustContain 토큰 set 추출 (자기 brand)
- noise 의 brand 가 mustContain 에 있으면 skip (의도된 collab SKU 정상)
- 그 외 brand 매물 text 에 있으면 차단 (broad SKU 자동 차단)

## production 검증 결과

SQL 으로 GLOBAL noise brand 매칭 매물 분포 확인:

**의도된 collab SKU (mustContain skip — 정상):**
- shoe-nike-sakai-collab: sacai 191건 ✓
- shoe-cdg-nike-collab: cdg 67건 ✓
- shoe-converse-chuck70-cdg-play-white: cdg 62건 ✓
- shoe-nike-jordan-1-low-travis-scott-mocha: travis scott 33건 ✓
- shoe-adidas-samba-pharrell: pharrell 24건 ✓
- shoe-offwhite-nike-blazer-mid: off-white 14건 ✓
- shoe-adidas-samba-wales-bonner-*: wales bonner 11건 ✓
- clothing-stussy-dior-collab: dior 17건 ✓
- shoe-adidas-samba-kith: kith 5건 ✓

**broad SKU 자동 차단 (mustContain 없음):**
- shoe-asics-gel-kayano: 22건 (톰브라운) → **자동 차단** ✓
- shoe-nike-blazer-low: 22건 (off-white) → **자동 차단** ✓
- shoe-nike-blazer-broad: 8건 (off-white) → **자동 차단** ✓
- clothing-bape-tee: 9건 (콜라보) → **자동 차단** ✓
- shoe-newbalance-990v3/v4: 14/6건 (designer) → **자동 차단** ✓
- shoe-newbalance-2002r: 5건 (designer) → **자동 차단** ✓

## 효과

- **모든 fashion SKU 자동 collab 차단** — 사용자 SKU별 코멘트 박지 않아도 됨
- **의도된 collab SKU 정상** — mustContain skip 로직으로 false negative X
- **시스템 wide** — 향후 새 designer collab brand 등장 시 GLOBAL noise 한 줄 추가로 모든 SKU 자동 적용

## 파일

- `src/lib/catalog.ts` — GLOBAL_DESIGNER_COLLAB_NOISE 신설 + skuMatches intersect-aware 차단

## 미완

- Wave 241 의 정책 유지 4건 (RRL 벨트 / Thug Club Superstar / Vans CDG 에디션) — 다음 wave narrow split
- production cron 후 60min 측정 (Wave 236~242 누적 효과)
