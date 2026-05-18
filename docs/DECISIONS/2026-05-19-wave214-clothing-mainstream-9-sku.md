# Wave 214 — 의류 mainstream 9 SKU (2026-05-19)

## 사용자 명시

> "그래도 옷 아까 한거 계속 해야지 않을까?? 그만하려고 우리 옷 인기매물들 진짜 하루에 몇건이상 꾸준히 올라오는거 카탈로그 해야지 않을까??"

→ 옷 안 버림. 의류 mainstream 추가 mining.

## production sweep 결과 (14d, 가격 2~80만, faved ≥ 5)

| brand | 매물 14d | 평균가 | faved | 평가 |
|-------|---------|--------|-------|------|
| **BAPE (A Bathing Ape)** | **118** | 100K | **94** ⭐⭐⭐ | 단일 brand 매물 1위 |
| **마뗑킴 (Matin Kim)** | 63 | 77K | 12 | 한국 designer 친화 |
| **리복** | 47 | 107K | 11 | 의류/트랙수트 |
| **아크테릭스** | 29 | 190K | 23 | 등산복 |
| **휠라** | 27 | 76K | 13 | 친화 |
| **파타고니아** | 17 | 101K | 19 | outdoor |
| MLB | 14 | 58K | 12 | 모자/티 |
| 디스커버리 익스페디션 | 11 | 88K | 8 | outdoor |
| 우영미 | 9 | 257K | 16 | **skip 명품** |

## 신규 9 SKU

```
clothing-bape-tee              // Ape Head/카모 broad
clothing-bape-shark-hoodie     // 시그니처 한정
clothing-matinkim              // 한국 designer
clothing-reebok-apparel        // 트랙수트/티
clothing-arcteryx              // Beta/Gamma/Alpha
clothing-fila-apparel          // 트랙수트/빅로고
clothing-patagonia             // Retro X/다운/Snap-T
clothing-mlb-cap               // 모자/티
clothing-discovery-expedition  // outdoor
```

## 가품 차단

- 모든 SKU `rep/replica/이미테이션/fake/복각` 차단
- BAPE 가품 risk 매우 큼 → mustNotContain에 신발/스니커즈/카본 collab 차단
- 신발/가방 brand 의류 SKU에 신발 차단 (Reebok/Fila 등)

## 누적 138 SKU (Wave 198~214)

| 카테고리 | SKU |
|---------|------|
| clothing | **26** ⭐ (Wave 198 17 + Wave 214 9) |
| bag | 20 |
| shoe | 92 |

| brand 추가 (Wave 214) | SKU |
|----------------------|-----|
| **BAPE** | 2 (tee/Shark Hoodie) |
| **Matin Kim** | 1 (한국 designer) |
| **Reebok / Fila / Patagonia / Arc'teryx** | 4 (mainstream outdoor) |
| MLB / Discovery | 2 |

## verify
- test:core **550/550 pass** ✅
- commit `9ad011a`

## 사용자 정책 충족

- ✅ 매물 ⭐⭐⭐ (BAPE 118건/14d, 마뗑킴 63건)
- ✅ 가품 식별 가능 (BAPE 시그니처 Ape Head/카모/샤크 명확 + mustNotContain)
- ✅ 친화 가격 (5~30만 mainstream + BAPE 한정 30~70만)
- ✅ 명품 X (우영미 257만 skip)

## 다음 자율 후보

매물 sweep 더:
- 슈프림 의류 추가 (collab 외 basic 티/후드/모자)
- 노스페이스 추가 (Antarctica/Himalayan — 시즌)
- 폴로 SS 시즌 컬렉션 (이미 polo-pony-tee 박혔지만 컬렉션 narrow)
- 베이프 신발 (BAPE STA — collab 한정)
- Stüssy 8 Ball Knit / Shadow Pants

또는 D 측정 단계 (Wave 213 reparse 후 24h 추적).
