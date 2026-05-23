# Wave 729 — Carhartt broad + double-knee leak fix + Matinkim 확장

**날짜**: 2026-05-24
**Owner**: Claude
**상태**: 적용 (catalog edit)

## 배경

Wave 727 (골프 6 brand) + Wave 728 (supreme/arcteryx leak fix) 직후 의류 deep sweep cycle 연속.

DB sweep 결과 carhartt 117건 / matinkim 10건 / RRL 387건 unmatched (last 14 days, sku_id IS NULL, price > 30000).

## 발견

### Carhartt 더블니 leak (72건)
기존 `carhartt_double_knee_pants` SKU의 mustContain group 3 (`팬츠/pants/바지`)가 한국 셀러 패턴과 불일치.

샘플:
- "칼하트 더블니 32X30" — 사이즈만 적시, 팬츠 단어 없음 ❌
- "Carhartt doubleknee B01 BLK" — 동일
- "칼하트wip 더블니 32" — 동일

**Fix**: mustContain group 3 제거. "더블니/B01"이 carhartt double-knee pants signature 자체 (다른 product 없음).

### Carhartt 4 broad SKU 누락
| Bucket | 건수 | p50 | SKU 신설 |
|--------|------|-----|----------|
| hoodie_sweat | 18 | 77.5k | ✓ carhartt_hoodie_sweat |
| denim_pants | 9 | 91k | ✓ carhartt_denim_pants (Landon/Newel/생지) |
| overall_anorak | 7 | 80-100k | ✓ carhartt_overall_anorak (Nimbus) |
| shirt_flannel | 7 | 80k | ✓ carhartt_shirt_flannel |

### Matinkim apparel leak (75% miss)
기존 `matinkim_apparel` SKU의 mustContain[1]에 다음 누락:
- 니트, 코트, 다운, 패딩, 점퍼, 푸퍼, 베스트, 조끼, 탱크탑, 카디건, 바람막이, 팬츠, 데님, 쇼츠, 스커트, 원피스

샘플:
- "마뗑킴 카고 팬츠 화이트" — 팬츠 없음 ❌
- "마뗑킴 보트넥 긴팔 니트" — 니트 없음 ❌
- "마뗑킴 하이넥 크롭푸퍼다운 숏패딩" — 다운/패딩 없음 ❌

casetify 폰케이스 collab (3건+) → phone accessory 별 시세, 차단.

### RRL — 별도 wave (730+) 보류
- 가격대 p50 23-160만+, p90 271만 (러프아웃 1.6M)
- 사용자 정책 "일반인 친화" 안 맞음
- 387건 unmatched 있지만 일반인 친화 X — 우선순위 낮음.

## 결정

1. **`carhartt_double_knee_pants` mustContain group 3 제거** — 72건 회복 예상
2. **Carhartt 4 broad SKU 신설** (`catalog-729-carhartt-broad.ts`) — 41건 회복 예상
3. **`matinkim_apparel` mustContain[1] 확장 + casetify 차단** — 8건 회복 예상
4. **RRL skip** — 별도 wave (priority lower)

## 영향
- 의류 cover: 117+10 = 127건 회수 (RRL 제외)
- 정책 부합: 모든 SKU 5-15만 가격대 (일반인 친화)
- spread risk: 신설 broad는 narrow에서 차단 보장 (mustNotContain)

## Files touched
- `src/lib/generated/catalog-729-carhartt-broad.ts` (신규, 4 SKU)
- `src/lib/generated/catalog-wave266-clothing.ts` (carhartt_double_knee_pants leak fix)
- `src/lib/catalog.ts` (Wave 729 import + matinkim 확장)
- `src/lib/category-readiness.ts` (4 lane ready)

## Pending
- Wave 730: RRL deep sweep (수익성 분석 후 ready 여부 결정)
- 24-48h 후 carhartt p50/spread 재측정 (signal 정상화 확인)
