# Wave 243 (2026-05-19) — variant 패턴 system-wide 확장 (CV outlier 측정)

## 발단

사용자: "RRL 벨트 / Vans CDG 만 하는 거?? 같은 패턴 다른 SKU 에서도 발생할 텐데"

→ Wave 241 패턴 일반화 (Wave 242) 이후도 CV 큰 SKU 30+개. 추가 SQL 측정 → outlier 매물 sample → 누락 brand 다수 발견.

## CV TOP outlier 매물 sample (Wave 242 fix 후)

| SKU | outlier 매물 | 누락 패턴 |
|---|---|---|
| `clothing-adidas-trefoil` | "떠그클럽 Track Top" 7+건 1M~220k / "Adidas x Bape Track Top" / Pearrell collab | thug club / bape / fear of god collab 누락 |
| `clothing-polo-pique-classic` | 펜디 750k / 캐피탈 650k / 몽클레어 396k / 폴로 치프키프 380k / 지포어 250k / 버버리 250k / 톰브라운 175k | 럭셔리 + 골프 brand 다수 |
| `clothing-reebok-apparel` | 팔라스 360k / 코트와일러 189k | streetwear 누락 |
| `bag-acne-pvc-tote` | "무수비 토트백" 2.2M (mustNotContain 박혀있는데도) / "테디 쇼퍼" 1M / "테디 데님" 730k | Acne 별 라인 분리 |
| `clothing-acne-denim` | 골드마인 1.12M / 트롱프뢰유 키제인 750k / Petit 기장 745k / 슈퍼배기핏 710k / 2021m 트라팔가 640k | Acne 한정 모델 |
| `shoe-crocs-classic-clog` | 999,999 placeholder + Crocs x BAPE 410k / 살레헤 벰버리 355k | placeholder 통과 |
| `clothing-polo-rrl` | 발견 모델 별 가격 큼 | edition 분리 미흡 |

## fix — GLOBAL_DESIGNER_COLLAB_NOISE 보강 (50+ → 80+)

추가 brand (production sample 발견 일반화):

```ts
// Streetwear / 일본 designer 누락
"thug club", "thugclub", "떠그클럽", "떠그 클럽", "떠그",
"palace", "팔라스",
"cottweiler", "코트와일러",
"kapital", "캐피탈",
"mastermind", "마스터마인드", "mastermind japan", "mastermind world",
"raf simons", "라프시몬스",

// 럭셔리 (fashion 일반)
"fendi", "펜디",
"burberry", "버버리",
"valentino", "발렌티노",
"balmain", "발맹",
"celine homme", "셀린 옴므",
"saint laurent", "생로랑",
"givenchy", "지방시",
"loewe", "로에베",
"prada x", "프라다 x",

// 골프 brand (polo-pique false positive 빈번)
"g/fore", "gfore", "지포어",
"titleist", "타이틀리스트",
"callaway", "캘러웨이",
"hazzys", "헤지스",
"vilebrequin", "빌보콰",
"paul smith", "폴스미스",

// 한정/collab patterns
"chief keef", "치프키프",
"tom sachs x", "톰삭스 x",
"trefoil firebird x",

// Acne Studios 한정/별 라인
"골드마인", "goldmine",
"트롱프뢰유", "trompe loeil",
"키제인", "keissen",
"테디 쇼퍼", "teddy shopper", "테디 데님",
"트라팔가", "trafalgar",
```

## 추가 catalog SKU fix

`bag-acne-pvc-tote` mustNotContain:
- "테디 쇼퍼", "teddy shopper", "테디 데님", "teddy denim", "테디\\b" (Acne Teddy 라인 별 SKU)
- defaultProductType: "tote" 추가

## 효과

- GLOBAL_DESIGNER_COLLAB_NOISE → **모든 fashion SKU 자동 적용** (Wave 242 intersect-aware 정책 그대로)
- Adidas Trefoil broad SKU 의 떠그클럽 collab 9+건 자동 차단
- Polo Pique 의 럭셔리/골프 brand 매물 자동 차단
- Reebok apparel 의 팔라스/코트와일러 차단
- Acne PVC Tote 의 테디 라인 차단

## 미완 (다음 wave)

- production cron 60min 후 누적 측정
- Acne 한정 모델 (골드마인/트롱프뢰유/키제인) narrow split 검토
- 999,999 placeholder 통과 — candidate-pool-builder isPoolPlaceholderPrice 추가 검증
- Nike AF1 / Jordan 1 broad SKU 의 outlier narrow split (별도 colorway/edition)
