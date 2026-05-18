# Wave 202 — On Running / Birkenstock / Lululemon / Levis collab catalog (2026-05-18)

## production sweep deep mining 결과

사용자 명시 "계속 진행" → Tier 3+ mining 계속.

### On Running 매물 폭발적 (60건+ sample / 14d)

| 모델 | 매물 sample | 가격대 |
|------|------------|--------|
| **Cloud Monster** | 다수 (faved 5~31) | 75K~745K |
| Cloud (5/X/Z5) | 다수 (faved 5~14) | 90K~210K |
| Cloudsurfer | 다수 (faved 5~11) | 100K~200K |
| Cloud Boom | 1건 | 500K |
| Cloudaway | 2건 | 100K~180K |
| Cloud Nova | 1건 | 98K |

**collab**:
- **Loewe × Cloudtilt** 620K~650K (faved 6~16)
- **PAF × Cloud Monster** 320K~745K (faved 6~18) — 한국 매우 인기
- **PLEASURES × Cloud Monster** 232K (faved 8)
- 라스포르티바 × On 265K

→ 5 SKU 박음 (시그니처 3 + collab 2)

### Birkenstock 매물 매우 많음 (faved 5~38)

| 모델 | 매물 sample | 가격대 |
|------|------------|--------|
| **Boston** | 다수 (faved 11~36) | 75K~350K |
| **Arizona** | 다수 (faved 7~10) | 59K~150K |
| **Zürich** | 다수 (faved 7~18) | 140K~210K |
| **Milano** | 매물 다수 (faved 6~11) | 81K~300K |
| Buckley (Boston EVA) | 매물 (faved 14) | 56K |
| Gizeh | 매물 (faved 21) | 131K |
| 1774 Tibo Denis | 매물 (faved 10) | 500K |

**collab**:
- Dior × Tokio Mule 850K (한정)
- Fear of God × Los Feliz 350K (한정)
- ADER ERROR × Milano Tech 300K
- Stüssy × Boston (이미 Wave 198 stussy SKU에서 자연 매칭)
- Disney × Mickey 100K (Mini Mouse 한정)

→ 4 SKU 박음 (Boston / Arizona / Zürich / Milano broad). collab은 narrow 보류 (매물 적음).

### Lululemon — 백팩 시그니처 매물 압도적

| 모델 | 매물 sample | 가격대 |
|------|------------|--------|
| **Lululemon Backpack (정품)** | 다수 (faved 91!⭐ 최고) | 70K |
| 패스트 트랙 백 2.0 | 1건 (faved 3) | 84K |
| 어드저스터블 미니 숄더 | 1건 (faved 9) | 80K |
| 시티 어드벤처 더플 | 1건 (faved 7) | 200K |
| 슬라우치 슬링백 | 1건 (faved 11) | 55K |
| 미니 퍼 키링백 | 1건 (faved 10) | 30K |
| 시티버스 스니커즈 | 1건 (faved 5) | 150K (신발) |
| 데일리 멀티 포켓 토트백 | 1건 (faved 8) | 70K |

→ broad 1 SKU (`bag-lululemon-backpack` — 모든 가방 종류 포함).

### Levis collab

| collab | 매물 sample | 가격대 |
|--------|------------|--------|
| **NB × Levi's 990v3** | 매물 5건+ (faved 5~20) | 128K~335K |
| **Nike × Levi's Air Max 95** | 매물 3건 (faved 5~11) | 189K~230K |
| NB × Levi's 327 | 매물 1건 (faved 5) | 150K |

→ 2 SKU 박음 (NB collab / Nike collab).

## 박은 SKU 12개 정리

```ts
// On Running 5
shoe-onrunning-cloud-monster
shoe-onrunning-cloud-basic
shoe-onrunning-cloudsurfer
shoe-onrunning-cloudtilt-loewe-collab
shoe-onrunning-paf-collab
// Birkenstock 4
shoe-birkenstock-boston
shoe-birkenstock-arizona
shoe-birkenstock-zurich
shoe-birkenstock-milano
// Lululemon 1
bag-lululemon-backpack
// Levis collab 2
shoe-newbalance-levis-collab
shoe-nike-levis-collab
```

LANE_READINESS 12 lane ready
queryFamily 룰루레몬 (clothing) / 온러닝/버켄스탁 (shoe)
DEFAULT_SEARCH_QUERIES 16 query

## 누적 catalog 48 SKU

| 카테고리 | SKU |
|---------|------|
| clothing | 15 |
| bag | 10 |
| shoe | 23 |

| brand | SKU 수 | 비고 |
|-------|--------|------|
| Polo Ralph Lauren | 7 | 피케/포니티/옥스포드/Bear/RRL/big pony tote/모카신 |
| The North Face | 8 | Nuptse/Mountain/Denali/Purple Label/Supreme/borealis/hotshot/bigshot/뮬/등산화 |
| Stüssy | 9 | Nike collab 의류/Nike collab 신발/basic/hoodie/waist/crossbody/dior/converse |
| Lacoste | 3 | 스니커즈/토트/피케 |
| ADER ERROR | 2 | 쇼퍼백/컨버스 collab |
| Comme des Garcons | 5 | Nike/NB/Vans/Salomon collab/PVC bag |
| **On Running** | **5** | Monster/Cloud/Surfer/Loewe collab/PAF collab |
| **Birkenstock** | **4** | Boston/Arizona/Zürich/Milano |
| **Lululemon** | **1** | Backpack |
| **Levis collab** | **2** | NB/Nike collab |

## verify
- test:core **480/480 pass** ✅
- commit `1f7e000`

## 다음 자율 진행 후보

1. **추가 brand mining**: 푸마(스피드캣)/칼하트/아크테릭스/아미/아크네 스튜디오 매물 검출 (이전 sample에서 누락)
2. **메종키츠네 케이스 — smartphone_case 신규 카테고리** (별도 wave)
3. **TNF Antarctica/Himalayan 겨울 시즌**
4. **production deploy 후 catalog 48 SKU 수집률 측정**
5. **시세 정확도 + 가품 차단 효과 측정**
