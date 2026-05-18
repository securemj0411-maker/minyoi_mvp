# Wave 204 — 슈프림 8 SKU 폭발적 mining (2026-05-18)

## production sweep 결과

80건 sample 거의 다 슈프림 — 매물 압도적.

## 신규 SKU 8개

### 신발 collab (6)
| collab | 매물 sample | 가격 |
|--------|------------|------|
| **Supreme × Nike Air Force 1** | 20+건 (faved 13~28) | 80K~415K |
| Supreme × Nike Air Max (98/테일윈드/휴마라/샥스) | 매물 다수 | 200K~420K |
| Supreme × Nike SB (덩크/블레이저/AF2) | 매물 4건 | 90K~270K |
| **Supreme × Timberland** (3아이/6인치/보트슈즈) | 매물 4건 (faved 13~29) | 250K~1.5M |
| Supreme × Dr.Martens (1461/2046/램지/펜톤) | 매물 4건 (faved 11~17) | 300K~530K |
| Supreme × Vans (올드스쿨/스컬 슬립온/하프 캡) | 매물 4건 (faved 11~22) | 85K~199K |

### 가방 (2)
| SKU | 매물 sample | 가격 |
|-----|------------|------|
| **Supreme Backpack** (FW/SS 시그니처) | 매물 10+건 (faved 11~21) | 140K~410K |
| Supreme Shoulder/Mesh/Side bag | 매물 5건 (faved 12~19) | 69K~250K |

## 가품 차단 강화

슈프림 가품 시장 매우 큼. 각 SKU mustNotContain 강력:
- `"rep "`, `"replica"`, `"이미테이션"`, `"imitation"`, `"fake"`, `"복각"`
- 구찌 GG Supreme (구찌 라인) 차단
- 노스페이스 collab (Wave 198 별도 SKU) 차단
- 다른 brand collab narrow 분리 (Nike collab에 Timberland/Vans 차단 등)

## 누적 catalog 61 SKU (Wave 198~204)

| 카테고리 | SKU |
|---------|------|
| clothing | 16 |
| bag | 13 |
| shoe | 32 |

| brand | SKU 수 |
|-------|--------|
| Polo Ralph Lauren | 7 |
| The North Face | 8 |
| Stüssy | 9 |
| Lacoste | 3 |
| ADER ERROR | 2 |
| Comme des Garcons | 5 |
| On Running | 5 |
| Birkenstock | 4 |
| Lululemon | 1 |
| Levis collab | 2 |
| Maison Margiela | 5 |
| **Supreme** | **8** |

## verify
- test:core **535/535 pass** ✅ (wave207 earphone fix 같이 통과)
- commit `e69409a`

## 다음 자율 진행

- 아미 / 아크네 스튜디오 / 칼하트 / 우영미 sweep (sample 검출 X — 매물 적거나 다른 query 가려짐)
- 푸마 / 크록스 (의류 외 운동화)
- 슈프림 모자 / 후드 / 티셔츠 (의류 — 추가 narrow 가능)
- TNF Antarctica / Himalayan (겨울 시즌)
- 시세 정확도 + 가품 차단 측정 (production deploy 후)
