# Wave 800 — 의류 14 brand bias-free deep sweep

**날짜**: 2026-05-24
**Owner**: Claude (사용자 명시 "큰거 다해야될듯?")
**Status**: 24-48h verification 대기

## 개요
Wave 750 (9 brand bias-free) + Wave 751 (Champion broad / Arcteryx LEAF) 이후 다음 큰 의류 brand 14개 systemic sweep. Pareto 임팩트 큰 brand만 (≥30 매물 + ≥40x spread).

## 14 brand audit 완료

### Phase 1 (4 brand)
| Brand SKU | Spread | 매물 | 차단 |
|-----------|--------|-----|------|
| clothing-moncler-broad | 44x | 345 | Chloé/Loewe/Off-White/Valentino/Dior/Celine collab + 허드슨/리바후르/캔비/달레스 sub-line |
| clothing-polo-bear-collab | 68x | 204 | stc 어항/버터플라이베이비베어 bait + n켤레 양말 + 그릇 잡화 |
| clothing-polo-rrl-jacket-coat | 124x | 98 | 류준열·정해인·공유·박서준 셀럽 착용 + 전세계 1개 unique + 라이더/모터사이클/카우보이/제프렌-M 자켓 sub-line |
| clothing-junya-watanabe-apparel-broad | 41x | 71 | Bates 가죽 라이더 + M65 파카 (CP collab) + by CDG 더블/싱글코트 + 해외발송 pattern |

### Phase 2 (5 brand)
| Brand SKU | Spread | 매물 | 차단 |
|-----------|--------|-----|------|
| clothing-thombrowne-apparel-broad | 113x | 666 | 밍크/시어링/캐시미어/구스다운/금장/프린스 오브 웨일즈/헤링본 luxury material + 정장 세트 bundle |
| clothing-stone-island-broad | 47x | 460 | 알칸타라/다비드TC/프로스트/메탈 한정 + 17fw~25ss 시즌 코드 |
| clothing-polo-knit-sweater | 95x | 241 | 믹쏘/자라/Wolsey/POSZER 다른 brand "polo knit" generic + 캐시미어 100% top tier + 나바호 한정 |
| clothing-polo-shirt-pattern | 68x | 115 | 블레이저/도스킨/울 플란넬 blazer (different product) + 금장/리미티드 |
| clothing-acne-tee | 72x | 88 | skincare "크리미 폼"/페어 아크네 + 스톡홀름 한정 라인 |
| clothing-acne-sweat | 68x | 126 | skincare "크리미 폼 80g"/마스터 패치/바디워시 |
| clothing-stussy-pigment-dye-hoodie | 324x | 44 | Martin Rose collab + Dyed Nylon Bomber (다른 product type) |
| clothing-patagonia-synchilla | 72x | 74 | MARS 한정/90s vintage/모음 bundle/핫핑크 |

### Phase 3 (Polo RRL family)
| Brand SKU | Spread | 매물 | 차단 |
|-----------|--------|-----|------|
| clothing-polo-rrl (broad) | 70x | 52 | 오버나이트백/브리프케이스 (가방 false match) + 무스탕/시어링 premium + 토트/더플/메신저 |
| clothing-polo-rrl-shirt | 40x | 121 | 웨스턴 로브 (1.5M robe outlier) |

## 잡은 systemic 패턴

### 1. **다른 brand의 "polo" generic** (Polo Knit Sweater)
- 믹쏘 / 자라 (ZARA) / Wolsey / POSZER / 스파오 / 유니클로 등 generic polo knit 의류가 Polo Ralph Lauren SKU 흡수
- 1만~2만 원 cheap items이 broad mean 끌어내림
- Fix: brand whitelist 명시

### 2. **Acne 여드름 한국어 의미 false match** (Acne Tee/Sweat)
- "아크네" = Acne Studios brand + 여드름 skincare 둘 다
- 페어 아크네 크리미 폼 / 코스알엑스 핌플 패치 / 시카 일리윤 → clothing-acne-* 흡수
- Wave 751b Acne Apparel에 이어 Tee/Sweat에도 동일 차단 적용

### 3. **셀럽 착용 bait** (Polo RRL Jacket Coat)
- "류준열 착용 카코트" / "정해인 착용" / "공유 착용" / "박서준 착용"
- 한국 셀럽 착용 매물 = +20-30% premium markup
- "전세계 1개" / "unique piece" / "원피스 한정" 같은 unique-listing pattern도 dummy 시세 부풀림

### 4. **Luxury material differentiation** (Thom Browne)
- broad SKU가 cashmere/shearling/mink/goose down 차단 안 됨
- Same Thom Browne brand이지만 material에 따라 가격 5-10배 차이
- 의류 product type narrow 외에 material level narrow도 필요할 수 있음

### 5. **bag/accessory leak in clothing SKU** (Polo RRL broad, Stussy)
- "오버나이트백" / "브리프케이스" → 가방인데 clothing SKU 흡수
- "Dyed Nylon Bomber" → 봄버 자켓인데 hoodie SKU 흡수

### 6. **시즌 코드 보강** (Stone Island, Supreme broad)
- 17fw, 18fw, 19fw, 20fw, 21fw, 22fw, 23fw, 24fw, 25ss 등 빈티지 시즌
- broad 시세군 변화 큼 → 시즌 코드 차단 → broad는 current-season으로 한정

## 잡은 collab/sub-line (별도 시세군)

| Brand | Collab/Sub | 시세 |
|-------|-----------|------|
| Moncler | Chloé / Loewe / Rick Owens / Palm Angels / 허드슨 / 캔비 / 달레스 | 2.4M-2.85M |
| Stussy | Martin Rose | 1234원 dummy + bait |
| Polo Knit | 캐시미어 100% / 나바호 핸드니트 | 359K-950K |
| Junya | Bates / CP M65 / by CDG (CDG sub-line) | 2M-3.2M |
| Patagonia | MARS reversible / 90s vintage | 480K-3.6M |
| Polo RRL | Overnight bag / Briefcase / Western Robe (의류 X) | 1.4M-3.5M |
| Thom Browne | 밍크 fur / 시어링 / 캐시미어 / 구스다운 / 헤링본 / 프린스 오브 웨일즈 / 정장 세트 | 1.5M-7.8M |
| Stone Island | 알칸타라 / 다비드TC / 프로스트 베스트 / 25ss 한정 | 1.6M-2.1M |

## Files Touched
- `src/lib/catalog.ts` — Acne Tee/Sweat, Patagonia Synchilla, Polo RRL Jacket Coat, Polo RRL broad, Polo RRL Shirt
- `src/lib/generated/catalog-712b-bias-free.ts` — Stussy Pigment Dye Hoodie, Polo Knit Sweater, Polo Shirt Pattern, Junya Watanabe
- `src/lib/generated/catalog-wave266-clothing.ts` — Thom Browne, Stone Island, Moncler

## Pending verification (24-48h 후)
- Wave 752 v3 reparse 효과 측정 (135K matters)
- Wave 800 brand 매칭률 + spread 회복
- 누락 brand sample 재검증

## Pareto 정리
- **임팩트 큰**: Wave 752 v3 bump (135K matters), 의류 14 brand sweep (총 ~2,640 매물 영향)
- **임팩트 작은 (skip)**: Logitech/Xiaomi small fragments (각 5-50건 단위), 10-30건 작은 brand catalog
- **다음 cycle**: Wave 752 verification 결과 보고 작업 결정
