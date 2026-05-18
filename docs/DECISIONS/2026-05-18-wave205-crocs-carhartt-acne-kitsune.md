# Wave 205 — 가격 친화 brand 15 SKU (2026-05-18)

## 사용자 정책

> "더 가자 너무 비싸지만 않으면 됌 ㅇㅇ"

→ 25K~300K 범위 가격 친화 brand 우선. 럭셔리 X.

## production sweep 발견

### 🚨 크록스 — 매물 faved 48~108!! ⭐⭐⭐

| 모델 | 매물 faved | 가격 |
|------|-----------|------|
| **Classic Clog** | 28~108 (다수) | 25K~33K |
| **Bayaband** | 39~108 | 26K~45K |
| **Crush / Mega Crush** | 39~91 (다수) | 28K~45K |
| Platform 키높이 | 45~63 | 30K~45K |
| Eco Clog | 75 | 46K |
| 발레 플랫 | 82 | 29K |

**일반인 친화 압도적**: 가격 25K~45K, 매물 매우 다수.

### 칼하트 — 가방 + collab

| SKU | 매물 sample | 가격 |
|-----|------------|------|
| 칼하트 × 타이맥스 시계 | faved 109! | 250K (별도 시계 카테고리 — 보류) |
| 칼하트 클러치 | faved 36 | 20K |
| 칼하트 오버롤 | faved 13 | 149K |
| 살로몬 × 칼하트 등산화 | faved 10 | 439K |
| Converse × 칼하트 척 70 | faved 6~9 | 30K~70K |
| 칼하트 백팩 | faved 8 | 20K~29K |
| 칼하트 메신저백 | faved 7 | 30K |
| Nike × 칼하트 에어맥스 95 | faved 5 | 80K |

### 아크네 스튜디오 — 신발 + 가방 + 의류

| 모델 | 매물 sample | 가격 |
|------|------------|------|
| **Triplo** | faved 10~22 | 200K~300K |
| Bertin Ankle Boots | faved 5~18 | 235K~500K |
| **PVC Tote** | faved 16 | 45K |
| Musubi Clutch | faved 7 | 325K |
| 맨하탄 | faved 16 | 110K |
| 스니커즈/페리 | faved 6~12 | 80K~120K |
| 맥시 오버코트 | faved 6 | 250K |
| 사틴 치노팬츠 | faved 6 | 135K |

### 메종키츠네 — 가방만 (의류 적음, 케이스는 별도 카테고리 보류)

- 카페 키츠네 토트 82K (faved 6)
- 드레시드 폭스 토트 43K (faved 17)
- 그레이폭스 에코백 39K (faved 8)
- 라지 토트백 90K (faved 7)

### 메종키츠네 케이스 — **smartphone_case 신규 카테고리 보류**

매물 압도적 (faved 5~30 다수, 케이스티파이 × 메종키츠네 다수). 별도 wave에서 smartphone_case 카테고리 신규 박을 예정.

## 신규 15 SKU

```
크록스 5:
  shoe-crocs-classic-clog
  shoe-crocs-bayaband
  shoe-crocs-crush
  shoe-crocs-platform
  shoe-crocs-eco-clog

칼하트 4:
  bag-carhartt-backpack
  bag-carhartt-messenger
  shoe-carhartt-converse-collab
  shoe-carhartt-salomon-collab

아크네 5:
  shoe-acne-triplo
  shoe-acne-bertin-boots
  bag-acne-pvc-tote
  bag-acne-musubi
  clothing-acne-apparel

메종키츠네 1:
  bag-kitsune-tote
```

## 가품 차단

각 SKU mustNotContain:
- `"키즈"`, `"kids"`, `"토들러"`, `"복각"`, `"rep "`, `"replica"`, `"이미테이션"`, `"fake"`
- 크록스 — 굿즈 차단 (`"참이슬"`, `"두꺼비"` 등 슬리퍼 굿즈 매물)
- 메종키츠네 가방 — 케이스 / casetify 차단 (smartphone_case 카테고리와 분리)
- 다른 brand collab narrow 분리

## 누적 76 SKU (Wave 198~205)

| 카테고리 | SKU |
|---------|------|
| clothing | 17 |
| bag | 17 |
| shoe | 42 |

| brand | SKU |
|-------|-----|
| Polo Ralph Lauren | 7 |
| The North Face | 8 |
| Stüssy | 9 |
| Supreme | 8 |
| Maison Margiela | 5 |
| **Crocs** | **5** |
| Comme des Garcons | 5 |
| On Running | 5 |
| Acne Studios | 5 |
| Birkenstock | 4 |
| Carhartt WIP | 4 |
| Lacoste | 3 |
| Levis collab | 2 |
| ADER ERROR | 2 |
| Lululemon | 1 |
| Maison Kitsuné | 1 |

## verify
- test:core **535/535 pass** ✅
- commit `e856157`

## 다음 자율

- 푸마 / 아미 별도 query sweep (이전 검출 X)
- 슈프림 모자 / 티 / 후드 (collab 외 시그니처)
- TNF Antarctica / Himalayan / Black Series (시즌 매물)
- 메종키츠네 케이스 — smartphone_case 신규 카테고리 (별도 wave, 작업량 큼)
- Polo Sport / 1992 retro
- 슈프림 액세서리 (모카마스터 / 턴테이블 — 별도 카테고리)
