# Wave 235 (2026-05-19) — SKU 정밀 검증 + parser/catalog 강화

## 배경 / 사용자 지적

사용자: **"우리 지금 sku나 lane 테크기기빼고 다 모든 인터넷 공식몰 홈페이지 신뢰있는 사이트에 무슨 옵션이나 무슨 에디션이나 무슨 등등 다 조사해봤어?? 오류안날정도로?? 확실해?? 확실하냐고"**

정직 답: **확실하지 않음.** Wave 218~233 일부 colorway/collab 만 검증, 200+ SKU 다 인터넷 1:1 대조 X.

## 진단

`mvp_market_price_daily` SQL — fashion SKU 가격 stddev / CV (coefficient of variation) 진단. CV 높은 SKU = mismatch 의심.

**TOP 의심 SKU (cv ≥ 1.0, n ≥ 5):**

| SKU | n | p_min | p_max | cv | 발견 mismatch |
|---|---|---|---|---|---|
| `bag-polo-big-pony-tote` | 22 | 22,900 | **999,999,999** | 4.68 | SOLD placeholder 1B |
| `clothing-adidas-trefoil` | 115 | 5,000 | 2,766,000 | 2.67 | Balenciaga × Adidas 8건 (270만~200만), Gucci × Adidas 1건 |
| `shoe-nike-blazer-mid` | 82 | 15,000 | 950,000 | 1.79 | **Off-White × Blazer Mid** 5건 (95만~25만) |
| `clothing-polo-rrl` | 88 | 63,000 | **11,111,111** | 1.34 | 구매요청 placeholder 11M / 9.9M |
| `shoe-margiela-tabi-boot` | 33 | 100,000 | **9,999,999** | 1.91 | 구매요청 placeholder 9.9M |
| `shoe-vans-old-skool` | 322 | 4,000 | 799,000 | 1.29 | BAPE/Vault Mastermind/FDMTL/Bottega/Supreme 한정 |
| `shoe-vans-era` | 76 | 12,000 | 1,079,000 | 1.57 | 사토시 Era 95 / Fear of God Era 95 / 빈티지 70s·80s |
| `shoe-vans-slip-on` | 170 | 3,000 | 930,000 | 1.45 | Taka Hayashi Vault / 빈티지 70s·90s |
| `shoe-adidas-superstar-broad` | 342 | 1,111 | 900,000 | 1.10 | Clot/Kith/JJJJound/Wales Bonner/Thug Club/Prada/TMNT |
| `shoe-newbalance-530-white-silver-navy` | 12 | 12,000 | 1,450,000 | 1.76 | Miu Miu × NB 530 SL / Ronnie Fieg(Kith) × 530 |
| `bag-cdg-pvc` | 32 | 500 | 1,050,000 | 1.27 | Gucci × CDG 100주년 collab 3건 (105만~56만) |
| `bag-marc-jacobs-tote` | 6 | 20,000 | 1,800,000 | 1.52 | Denim Tears × Marc Jacobs 2건 |
| `bag-stussy-crossbody` | 71 | 1,234 | 380,000 | 1.49 | BAPE × Stussy 메쉬캡 트러커 (모자 cross-category mismatch) |
| `clothing-tnf-mountain-jacket` | 32 | 13,000 | 930,000 | 1.08 | Cecilie Bahnsen × TNF 1건, Mountain Light(다른 모델) 섞임 |

## fix

### A. Global noise 강화 (`src/lib/catalog.ts` `GLOBAL_FASHION_NOISE`)

역경매(구매요청) 매물 + SOLD 패턴 차단 — placeholder 가격 동반 빈도 높음.

```ts
"구매 원함", "구매원함", "구매원해요", "구매 원해요", "구매원합니다", "구매 원합니다",
"(구매)", "[구매]", "구매희망", "구매 희망", "구해 봅니다", "사고 싶어요", "사고싶어요",
"sold", "판매완료", "판완료", "거래완료", "예약완료", "판매됨",
```

### B. CATEGORY_FASHION_NOISE (`clothing` + `bag`)

모자/캡/벙거지/비니/트러커 cross-category mismatch 차단.

```ts
"트러커 캡", "trucker cap", "메쉬캡", "메쉬 캡", "볼캡", "ball cap",
"벙거지", "버킷햇", "bucket hat", "비니", "beanie", "야구모자",
```

### C. SKU별 mustNotContain 강화

| SKU | 추가 차단 |
|---|---|
| `shoe-nike-blazer-mid` | 오프화이트/off-white/offwhite/버질 |
| `shoe-vans-old-skool` | vault/볼트/lx/베이프/bape/마스터마인드/fdmtl/보테가/수베니어/end./fragment |
| `shoe-vans-sk8-hi` | vault/볼트/베이프/마스터마인드/보테가/fragment |
| `shoe-vans-authentic` | vault/볼트/베이프/fragment |
| `shoe-vans-era` | vault/볼트/사토시/fear of god/fog/피오갓/피어오브갓/era 95/wtaps/더블탭스/70s·80s 반스/독타운 |
| `shoe-vans-slip-on` | vault/볼트/타카 하야시/taka hayashi/fear of god/70s·80s·90s 반스/fragment |
| `shoe-adidas-superstar-broad` | 클랏/clot/prada/jjjjound/자운드/kith/키스/wales bonner/웨일즈보너/pleasure/플레저/닌자거북이/tmnt/thug club/떠그/ot-tech |
| `clothing-tnf-mountain-jacket` | cecilie/세실리에/bahnsen/반센/brain dead/junya/gucci/마운틴 라이트/마운틴 파카/마운틴 가이드/안타르티카 |
| `clothing-adidas-trefoil` | 웨일즈보너/balenciaga/발렌시아가/demna/뎀나/gucci/구찌 |
| `bag-cdg-pvc` | gucci/구찌/구찌 100주년/지드래곤/위버멘쉬/louis vuitton/lv |
| `bag-marc-jacobs-tote` | denim tears/데님티어스/tremaine emory |
| `shoe-newbalance-530-white-silver-navy` | ronnie fieg/로니피그/kith/aime leon dore/ald/joe freshgoods/salehe bembury/teddy santis/made in usa |

### D. Placeholder 가격 sanity check (`src/lib/candidate-pool-builder.ts`)

`MAX_POOL_PRICE_KRW=2_000_000` cap 으로 1B/11M/9.9M placeholder 는 차단되지만 **999,999 같은 200만 미만 placeholder** 가 pool 통과 가능. `isPoolPlaceholderPrice` 헬퍼 추가:

```ts
function isPoolPlaceholderPrice(price: number | null | undefined): boolean {
  if (!Number.isFinite(price ?? NaN)) return true;
  const p = Number(price);
  if (p <= 0) return true;
  if (p < 1000) return true; // 500원 같은 매물
  const s = String(Math.floor(p));
  if (s.length >= 5 && /^(\d)\1+$/.test(s)) return true; // 11111 / 99999 / 1111111
  if (p === 1004 || p === 1234 || p === 4321 || p === 12345) return true;
  return false;
}
```

### E. 신규 collab variant SKU 5개 (매물 ≥ 3건 + 일반 친화 + 가품 risk 낮음)

| SKU | laneKey | 매물 / 가격대 |
|---|---|---|
| `shoe-offwhite-nike-blazer-mid` | `offwhite_blazer_mid_collab` | 5건, 25만~95만 |
| `shoe-bape-vans-collab` | `bape_vans_collab` | 4건+, 50만 |
| `shoe-clot-adidas-superstar` | `clot_superstar_collab` | 3건, 30만~90만 |
| `shoe-thugclub-adidas-superstar` | `thugclub_superstar_collab` | 3건, 25만~33만 |
| `shoe-vans-sato-era-95` | `vans_sato_era_collab` | 3건, 85만~108만 |

전부 `LANE_READINESS=ready` (Wave 235 note).

**skip 사유 (변환 안 추가):**
- Miu Miu × NB 530 SL (1건만)
- Denim Tears × Marc Jacobs Tote (2건만)
- Gucci × CDG PVC (명품 collab — 가품 risk)
- Balenciaga × Adidas (200만 cap 초과 → pool 진입 불가)
- Bottega × Vans (명품 가품 risk)

## 영향 측정

`scripts/wave235-rematch.ts` — 모든 active 매물 ruleMatch 재실행 + 신규 sku_id 매칭.

(결과는 commit 후 별도 cron 측정 분석 추가)

## 파일

- `src/lib/catalog.ts` — GLOBAL_FASHION_NOISE / CATEGORY_FASHION_NOISE / SKU mustNotContain / 신규 5 SKU
- `src/lib/generated/catalog-bag-wave91.ts` — bag-marc-jacobs-tote mustNotContain
- `src/lib/generated/catalog-shoe-wave91.ts` — NB 530 mustNotContain
- `src/lib/candidate-pool-builder.ts` — `isPoolPlaceholderPrice`
- `src/lib/category-readiness.ts` — LANE_READINESS 5 신규 lane
- `scripts/wave235-rematch.ts` — rematch script

## next

- ruleMatch 결과 측정 (24h 후 stats)
- pool 진입 매물 정확도 sample 5건씩 다시 검증
- variant SKU 매물 누적 + 시세 daily 형성
