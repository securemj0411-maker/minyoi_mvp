# Wave 198 — 의류 Tier 1 전수조사 (라인/모델/collab/가품) (2026-05-18)

## 사용자 정책 결정

| 항목 | 결정 |
|------|------|
| 1. 사이즈 분리 | **D broad 사이즈 무관** ("사이즈마다 가격 다르지 않다") |
| 2. 한정판/collab | **F narrow 분리** ("진짜 옷 좋아하는 사람이 인정할 수준 전수조사") |
| 3. collab 식별 | **2번 잘하면 자동 분리** (라인/collab narrow SKU) |
| 4. 가품 차단 | **잘 학습** (의류 특화 패턴) |
| 5. 시세 그래프 | **보류** (별도 wave) |

## brand 라인 전수조사

### Polo Ralph Lauren 라인업

**라인 구조** (가격대 ↑ 순):
1. **Polo Ralph Lauren** (Standard) — 일반 retail 5~15만 ⭐ mainstream
2. **Polo Sport** — vintage 90년대 부활, 매니아층 ⭐
3. **Polo 1992/1993** — 스타디움 컬렉션 retro, 한정 다수
4. **Polo Bear** — 테디베어 모티프 한정판, 시즌별 매물
5. **Purple Label (Ralph Lauren)** — 정장/수트 100~500만 (일반인 친화 X)
6. **RRL (Double RL)** — premium denim/heritage 30~80만 (매니아)

**시그니처 모델**:
- **Pique Polo Shirt** (피케 폴로 셔츠) — Custom Slim / Classic Fit / Big Pony
- **Oxford Shirt** (옥스포드 셔츠) — Custom Fit
- **Pony Logo T-Shirt** (포니 로고 반팔)
- **Cardigan / Sweater** (카디건/스웨터)
- **Field Jacket / Denim Jacket (RRL)** — 자켓류
- **Polo Bear Print** — 곰 자수 한정 (Tee/Sweater/Hoodie)

### production 검증 (14일 raw)

| sub | cnt | median | 분류 |
|-----|-----|--------|------|
| RRL (premium) | **28건** | 60만 | narrow |
| 피케 폴로셔츠 | **18건** | 87K | broad |
| Purple Label (수트) | 6건 | 37만 | narrow |
| Big Pony | 4건 | 65K | broad |
| Polo Bear (한정) | 3건 | 68K | narrow |
| 옥스포드 셔츠 | 2건 | 57만 | narrow (RRL 추정) |

**경고**: 옥스포드 매물 평균 57만은 RRL의 oxford 셔츠. Standard Polo oxford은 5~10만. **반드시 분리.**

### 가품 패턴 (Polo)
- 포니 자수 quality (정품: 깔끔한 그라데이션, 가품: 단색/거친 자수)
- 라벨 표기 ("MADE IN" 국가, sizing tag 위치)
- **가품 다발 모델**: Big Pony 자수 / Polo Bear (한정판 inflation)
- 광고 패턴: "병행수입" (50/50), "정품 보장" 강조 (가품 frequent)

---

### The North Face 라인업

**라인 구조**:
1. **Standard (White Label)** — 한국 retail, 일반 10~30만 ⭐
2. **Urban Exploration** — 도심 outdoor 컨셉 시즌 컬렉션
3. **Mountain Athletics** — 운동/러닝/트레일
4. **Summit Series** — 전문 등산 30~100만 (일반인 친화 X)
5. **Purple Label (Nanamica)** — 일본 라인, 한국 라인의 1.5~2배
6. **Black Series** — premium minimalist 고가
7. **collab 라인**:
   - **Supreme × TNF** — 가장 유명 (FW Box Logo Nuptse, Trans Antarctica)
   - **Gucci × TNF** (2021 collection)
   - **MM6 Maison Margiela × TNF**
   - **CDG × TNF**
   - **Junya Watanabe × TNF**
   - **Brain Dead × TNF**
   - **Stüssy × TNF**

**시그니처 모델**:
- **1996 Retro Nuptse Jacket** — 시그니처 다운 자켓
- **Mountain Jacket** — 고어텍스 outer
- **Denali Jacket** — 시그니처 플리스
- **Antarctica Parka** — 익스트림 다운
- **Himalayan Parka** — 극지방 다운
- **Borealis Backpack** — 대학생 시그니처
- **Hot Shot Backpack** — 인기 백팩
- **Recon Backpack** — Borealis 상위
- **Big Shot Backpack** — 대용량
- **Nuptse Mule** — 슬리퍼 (신발 카테고리)
- **Base Camp Duffel** — 더플백

### production 검증 (14일 raw)

| sub | cnt | median | 분류 |
|-----|-----|--------|------|
| **Supreme×TNF collab** | **12건** | 26만 | narrow (한정판 inflation) |
| Big Shot 백팩 | 7건 | 60K | narrow |
| Purple Label (Nanamica) | 6건 | 87K | narrow |
| 1996 Nuptse | 4건 | 72K | narrow |
| Hot Shot 백팩 | 4건 | 72K | narrow |
| Borealis 백팩 | 3건 | 64K | narrow |
| Mountain Jacket | 1건 | 200K | narrow |

### 가품 패턴 (TNF)
- TNF logo 자수 / 박음질 quality
- 라벨 (정품 holographic seal, JapanLabel)
- **가품 다발**: Supreme×TNF Box Logo Nuptse / Antarctica Parka / Denali
- 광고 패턴: "S급 미러급" (= 가품), "수령후 환불 보장"

---

### Stüssy 라인업

**라인 구조**:
1. **Stüssy (Main)** — 5~25만 ⭐
2. **Stüssy Sport** — sportswear sub
3. **Stüssy Tribe** — 한정 멤버십 컬렉션
4. **collab**:
   - **Nike × Stüssy** ⭐⭐⭐ (Fleece, Air Max 등) — 한국 매물량 1위
   - **Dior × Stüssy** (FW21) — 매우 한정
   - **Birkenstock × Stüssy** (Boston Clog)
   - **Levi's × Stüssy**
   - **Carhartt WIP × Stüssy**
   - **Our Legacy × Stüssy**
   - **Burberry × Stüssy**

**시그니처 모델/그래픽**:
- **Basic Tee** (8 Ball, World Tour, Stock Logo, Script Logo)
- **Big Logo Hoodie** — 시그니처 후드
- **Stock Logo Crewneck** — 맨투맨
- **Waist Bag** — 시그니처 가방
- **Shadow Pants** — 카고 팬츠
- **8 Ball Knit** — 스웨터
- **Striped Polo** — 폴로 셔츠

### production 검증 (14일 raw)

| sub | cnt | median | 분류 |
|-----|-----|--------|------|
| **Nike × Stüssy collab** | **109건!** | 150K | narrow ⭐⭐⭐ 압도적 |
| Dior × Stüssy (한정) | 3건 | 70만 | narrow (한정판) |
| Birken × Stüssy | 1건 | 35만 | narrow |
| Waist Bag | 1건 | 50K | broad (검색어 한계, 실제 더 많을 듯) |
| Basic Tee/Hoodie | 1건 | 34K | broad (검색어 한계) |

**🚨 가장 큰 발견**: 스투시 매물 195건 중 **Nike collab이 56%** (109건). 분리 안 하면 시세 완전 망가짐.

### 가품 패턴 (Stussy)
- Stüssy script logo 자수 quality
- Made in USA tag (정품은 USA/Portugal)
- **가품 다발**: 8 Ball Hoodie / World Tour Tee / Nike Stussy Fleece
- 광고 패턴: "S급", "정품 100%", "리테일 직구" 강조

---

## 의류 카테고리 catalog 후보 list (총 16~18 SKU)

### 폴로 (5 SKU)
```ts
{
  id: "clothing-polo-pique-classic",
  modelName: "Polo Pique Classic Fit",
  // broad — 사이즈/색상 무관
  mustContain: [["폴로", "polo", "ralph lauren", "랄프로렌"], ["피케", "pique", "pk"]],
  mustNotContain: ["RRL", "purple label", "퍼플라벨", "polo bear", "베어", "키즈", "kids"],
}
{
  id: "clothing-polo-pony-tee",
  modelName: "Polo Pony Logo T-Shirt",
  mustContain: [["폴로", "polo", "ralph lauren"], ["반팔", "티셔츠", "tee", "t-shirt"]],
}
{
  id: "clothing-polo-oxford-shirt",
  modelName: "Polo Oxford Shirt (Standard)",
  // RRL 옥스포드와 분리
  mustContain: [["폴로", "polo"], ["옥스포드", "oxford", "shirt"]],
  mustNotContain: ["RRL", "purple label", "더블 알엘"],
}
{
  id: "clothing-polo-bear-collab",
  modelName: "Polo Bear Print (한정)",
  mustContain: [["폴로", "polo"], ["베어", "bear"]],
}
{
  id: "clothing-polo-rrl",
  modelName: "Polo RRL Double RL (premium)",
  // 별도 SKU — 가격대 다름
  mustContain: [["RRL", "rrl", "더블 알엘", "double rl"]],
}
```

### 노스페이스 (7 SKU)
```ts
{
  id: "clothing-tnf-nuptse-1996",
  modelName: "TNF 1996 Retro Nuptse",
  mustContain: [["노스페이스", "north face", "tnf"], ["눕시", "nuptse", "1996"]],
  mustNotContain: ["supreme", "슈프림", "gucci", "구찌"],  // collab은 별도 SKU
}
{
  id: "clothing-tnf-mountain-jacket",
  modelName: "TNF Mountain Jacket",
  mustContain: [["노스페이스", "north face", "tnf"], ["마운틴", "mountain jacket"]],
}
{
  id: "clothing-tnf-denali-fleece",
  modelName: "TNF Denali Fleece",
  mustContain: [["노스페이스", "north face"], ["denali", "데날리"]],
}
{
  id: "bag-tnf-borealis",
  modelName: "TNF Borealis Backpack",
  // category: bag (별도)
}
{
  id: "bag-tnf-hotshot",
  modelName: "TNF Hot Shot Backpack",
}
{
  id: "bag-tnf-bigshot",
  modelName: "TNF Big Shot Backpack",
}
{
  id: "clothing-tnf-purple-label",
  modelName: "TNF Purple Label (Nanamica)",
  // 일본 라인 별도 SKU
  mustContain: [["노스페이스", "north face"], ["퍼플라벨", "purple label", "nanamica", "나나미카"]],
}
// collab 별도:
{
  id: "clothing-tnf-supreme-collab",
  modelName: "Supreme × TNF",
  mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"]],
}
```

### 스투시 (5 SKU)
```ts
{
  id: "clothing-stussy-nike-collab",
  modelName: "Nike × Stüssy (collab)",
  mustContain: [["nike", "나이키"], ["stussy", "스투시"]],
  // 109건 매물 압도적
}
{
  id: "clothing-stussy-basic-tee",
  modelName: "Stüssy Basic Tee",
  mustContain: [["stussy", "스투시"], ["반팔", "티셔츠", "tee", "basic", "8 ball", "8ball", "world tour", "월드투어", "stock", "스톡"]],
  mustNotContain: ["nike", "나이키", "dior", "디올", "birken"],
}
{
  id: "clothing-stussy-hoodie",
  modelName: "Stüssy Big Logo Hoodie",
  mustContain: [["stussy", "스투시"], ["후드", "hoodie", "맨투맨", "크루넥", "sweatshirt"]],
}
{
  id: "bag-stussy-waist-bag",
  modelName: "Stüssy Waist Bag",
  // category: bag
}
{
  id: "clothing-stussy-dior-collab",
  modelName: "Dior × Stüssy (한정)",
  mustContain: [["dior", "디올"], ["stussy", "스투시"]],
}
```

---

## 가품 floor 정책 (의류 카테고리)

`upsertMarketPriceDaily()` 의 `FAKE_FLOOR_CATEGORIES_MARKET` 에 `clothing` 추가 + ratio **0.30** (Wave 196 신발 0.25보다 strict, 의류 가품 시장 더 큼).

추가 가품 광고 패턴 (clothing 특화 — `candidate-pool-builder.ts` AD_PATTERNS):
- "병행수입" (정품 가능성 50/50, 셀러 신뢰도 + 결합 검증)
- "S급" / "A급" (replica grade)
- "리테일 매장 수급" (Wave 153 이미 박힘)
- "rep" / "replica" / "복각" / "이미테이션"
- "수령후 가품 100배 환불"

---

## 새 카테고리 / 기존 카테고리 매핑

| 매물 | 카테고리 |
|------|----------|
| Polo / Stussy 의류 | `clothing` (신규) |
| TNF Nuptse / Mountain / Denali | `clothing` |
| TNF 백팩 (Borealis / Hot Shot / Big Shot) | `bag` (기존) |
| TNF Nuptse Mule (슬리퍼) | `shoe` (기존) |
| Stüssy Waist Bag | `bag` (기존) |

→ **3개 카테고리 (clothing 신규 + bag/shoe 확장)**

---

## 다음 phase 작업량 견적

| 작업 | 예상 시간 |
|------|----------|
| catalog SKU 16~18개 박기 | 30분 |
| queryFamily 의류 brand 보강 | 10분 |
| category-readiness `clothing` 등록 | 5분 |
| `upsertMarketPriceDaily` 의류 가품 floor 0.30 | 5분 |
| candidate-pool-builder AD_PATTERNS 의류 추가 | 10분 |
| typecheck + test + commit + decision log | 15분 |

**총: 75분 + verify** (catalog 박기 약 75분 1 phase)

## 사용자 검토 요청

위 audit + catalog 후보 list 검토:

1. **누락된 시그니처 모델** 있나? (예: TNF Antarctica Parka 등)
2. **추가하고 싶은 라인** 있나? (예: Polo Sport / 1992 / Stussy Tribe)
3. **catalog 박을 SKU 수** — 16~18 OK? 더 박을지/줄일지?
4. **collab 별도 narrow SKU** — Supreme×TNF (12건) / Nike×Stussy (109건) / Dior×Stussy (3건) 모두 박을지?
5. **가품 floor 0.30** OK? 더 strict 또는 완화?

검토 완료 후 catalog 박기 시작.

## audit 자기 평가

- production 매물 검증 ✓ (14d raw sweep)
- brand 라인 분류 ✓ (내 knowledge)
- 시그니처 모델 ✓
- collab 매물량 압도적 발견 (스투시 56% Nike collab)
- 가품 패턴 학습 자료 정리 ✓
- 추가 web research 필요 시점: 시그니처 모델 정확한 정품 변별 정보 (정품 사진/태그 quality 차이)

→ catalog 박기 시작 전 사용자 확인.
