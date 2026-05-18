# Wave 200 — Tier 3 mining 꼼데가르송 + Stussy×Converse + Polo Big Pony (2026-05-18)

## 배경

Wave 199 commit 후 사용자 명시 "진짜 계속 돌리라고" → Tier 3 brand + 누락 모델 mining.

## production 14d sweep — Tier 3 검증

### 꼼데가르송 (Comme des Garcons / CDG) 압도적

매물 60+ 검출 (faved 5+):

**Nike × CDG 신발 collab (가장 인기)**:
- 옴므 플러스 에어 폼포짓 700K (faved 38) ⭐
- 와플레이서 299K (faved 30)
- 블레이저 로우 139K, 120K, 70K, 55K (faved 17~23)
- 폼포짓 블랙 430K (faved 18)
- 에어맥스 95 230K (faved 14)
- 에어맥스 선더 SP 205K, 270K (faved 15)
- 에어맥스 180 169K (faved 15)
- 에어맥스 TL 660K, 480K, 430K (faved 9~14)
- 센스 96 359K, 에어 포스 1 미드 204K
- 다이너스티 235 210K

**New Balance × CDG (준야 와타나베)**:
- AM574 그린 159K, 베이지 150K (faved 16)
- 1906R 화이트 400K
- 574 스웨이드 190K

**Vans × CDG**:
- 반스 볼트 OG 어센틱 65K, 올드스쿨 135K, 올드스쿨 LX 149K, 반스 X CDG 180K

**Salomon × CDG**:
- XA-알파인2 439K
- 펄사 플랫폼 699K
- XT-6 익스펜스 플랫폼 729K

**꼼데가르송 가방 (시그니처)**:
- **PVC 가방 70K (faved 51!)** ⭐⭐⭐ 단일 SKU 매물 1위
- 더블지퍼 숄더백 650K (faved 42)
- 걸즈 라인 페인트 백 680K (faved 18)
- 걸 리본 토트백 430K (faved 17)
- 아오야마백 520K, 620K (faved 10~13)
- 칸예 백팩 270K (faved 10)

**꼼데가르송 자체 신발 (collab X)**:
- 첼시 부츠 480K
- 셔츠 스니커즈 80K
- 옴므 브로그 옥스포드 185K
- 옴므 스웨이드 블로퍼 뮬 350K

### Stussy × Converse 척테일러 70 collab

매물 (faved 4~30):
- 척테일러 하이 100K, 99K, 50K, 80K
- 컨버스 X 스투시 척70 레더 스네이크스킨 248K
- 핑크 하이 120K, 285 80K

Wave 198 `clothing-stussy-nike-collab`과 별도. 매물 다수 → narrow SKU.

### Polo Big Pony Tote (시그니처 누락)

매물:
- 메탈릭 캔버스 빅 포니 토트백 129K (faved 17)
- 네이비 빅포니 토트백 50K (faved 17)
- 폴로 빅포니 토트백 85K (faved 11)

Wave 198/199에 polo 가방 SKU 없었음 (옷 + 신발만). 시그니처 토트백 = 폴로 가방 시장 핵심.

### 칼하트 / 아크테릭스 (sample 검출 X)

raw 14d faved 3+ 매물 0건 검출. 매물량 부족 → 보류.

### TNF 평창 한정 (매물 적음)

- 평창올림픽 백팩 35K (faved 11)
- 평창 한정 다른 1~2건

매물 적어서 별도 narrow SKU 안 박음. broad TNF 가방 SKU에 자연 매칭.

## 결정 — 4 SKU 추가

```ts
{
  id: "shoe-cdg-nike-collab",
  brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_collab",
  modelName: "Nike × CDG Homme Plus (collab 신발)",
  mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons"]],
  mustNotContain: ["newbalance", "뉴발란스", "vans", "반스", "salomon", "살로몬", ...],
}
{
  id: "bag-cdg-pvc",
  brand: "Comme des Garcons", category: "bag", laneKey: "cdg_pvc_bag",
  modelName: "CDG PVC Bag (시그니처)",
  mustContain: [["꼼데", "cdg", "comme des garcons"], ["pvc"]],
}
{
  id: "shoe-stussy-converse-collab",
  brand: "Converse x Stussy", category: "shoe", laneKey: "stussy_converse_collab",
  modelName: "Converse × Stüssy (척테일러 70)",
  mustContain: [["stussy", "스투시"], ["컨버스", "converse"]],
  mustNotContain: ["nike", "나이키", ...],
}
{
  id: "bag-polo-big-pony-tote",
  brand: "Polo Ralph Lauren", category: "bag", laneKey: "polo_big_pony_tote",
  modelName: "Polo Big Pony Tote Bag",
  mustContain: [["폴로", "polo"], ["빅포니", "big pony"], ["토트", "tote"]],
  mustNotContain: ["RRL", "purple label", ...],
}
```

## 누적 catalog 33 SKU

| 카테고리 | SKU 수 |
|---------|--------|
| clothing | 14 |
| bag | 9 |
| shoe | 10 |

| brand | SKU 수 |
|-------|--------|
| Polo Ralph Lauren | 7 (피케/포니티/옥스포드/Bear/RRL/big pony 토트/모카신) |
| The North Face | 8 (눕시/마운틴/데날리/퍼플라벨/Supreme/borealis/hotshot/bigshot/뮬/등산화) |
| Stüssy | 9 (Nike collab 의류/Nike collab 신발/basic/hoodie/waist/crossbody/dior/converse) |
| Lacoste | 3 (스니커즈/토트/피케 폴로) |
| ADER ERROR | 2 (쇼퍼백/컨버스 collab) |
| Comme des Garcons | 2 (Nike collab/PVC) |

## verify
- test:core **480/480 pass** ✅
- commit `60cc0d3`

## 다음 자율 진행 후보

1. **Polo Sport / Polo 1992 retro** (vintage 라인) — raw 검색 추가 필요
2. **TNF Antarctica Parka / Himalayan Parka** (겨울 시즌 후 mining)
3. **Stüssy 8 Ball Knit / Shadow Pants / Tribe** (한정)
4. **칼하트 / 아크테릭스** — raw 매물 늘어나면 박기
5. **꼼데가르송 collab 분리** (NB × CDG / Vans × CDG / Salomon × CDG — 각자 narrow)
6. **메종키츠네 케이스** (smartphone_case 신규 카테고리)
7. **시세 시뮬레이션** — Wave 198~200 catalog 박은 후 production deploy 측정

## 자기 평가

- 사용자 명시 "계속 돌리라고" + "24h 안 기다려도 됨" 자율 진행 ✅
- production raw 즉시 sweep → catalog gap 4개 발견 + 박음
- 꼼데가르송 압도적 매물량 발견 — 다음 wave에 NB/Vans/Salomon collab도 narrow 분리 가능
- 칼하트/아크테릭스 매물 부족 보류 — 미발견이 아니라 사전 검증 후 결정

## 시뮬레이션 효과 추정

- Stussy × Converse 매물 12+건 정상 분류 (이전 매칭 X)
- Polo Big Pony Tote 매물 3+건 정상 분류
- CDG PVC 가방 매물 1+건 시그니처 분류 (faved 51 단일 매물)
- Nike × CDG 신발 매물 20+건 정상 분류

총 35~50건 신규 매물 catalog 매칭 가능 → pool 진입 후보.
