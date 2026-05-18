# Wave 210 — 호카 + FOG + 챔피온 + 토미힐피거 (2026-05-19)

## 사용자 명시

> "다 하라니까??"

→ 모든 추가 brand 박음. 럭셔리 X (사용자 정책 유지).

## production sweep 결과

### 호카 추가 매물 (기존 catalog Bondi 7/8/9/X + Clifton 9/10 외)
- **Bondi 9 신상품 99K (faved 155!)** — 단일 매물 최고 신발
- 마파테 스피드 4 매물 다수 (faved 12~48)
- 마하 5/6 (faved 16~24)
- 카하 2 GTX 등산화 (faved 12)
- 아나카파 브리즈 로우 (faved 14)

### Fear of God (FOG) — Nike/Adidas collab 다수
- Nike × FOG: Air FOG 1 / 라이트본 OG / 트리플블랙 / Raid / 스카이론2 / 모카신 (faved 5~23)
- Adidas × FOG Athletics 86 / 바스켓볼 (faved 5~17)
- FOG 자체: 8th 모크 니트 / 8th 로퍼 / 디스턴스 러너 / 캘리포니아 뮬 / 101 레이스업
- 가품 risk 큼 → narrow 분리 + Wave 196 floor 적용

### 챔피온 / 토미힐피거 (매물 적음 but 가품 risk 낮음, 가격 친화)
- 챔피온 트레이너 53K (faved 18)
- 챔피온 슬리퍼 8K (faved 5)
- 토미힐피거 신발 80K (faved 21)
- 토미힐피거 크로스백 30K (faved 11)

## 신규 9 SKU

```
호카 4:
  shoe-hoka-mafate-speed
  shoe-hoka-mach
  shoe-hoka-kaha-gtx
  shoe-hoka-anacapa

FOG 3:
  shoe-nike-fog-collab
  shoe-adidas-fog-collab
  shoe-fog-fear-of-god-self

mainstream 2:
  shoe-champion-trainer
  bag-tommy-hilfiger
```

## 누적 catalog 110 SKU (Wave 198~210)

| 카테고리 | SKU |
|---------|------|
| clothing | 17 |
| bag | 18 |
| shoe | **75** |

| brand | SKU |
|-------|-----|
| The North Face | 8 |
| Asics | 8 |
| Stüssy | 9 |
| Supreme | 8 |
| Polo Ralph Lauren | 7 |
| Salomon | 7 |
| Comme des Garcons | 5 |
| Maison Margiela | 5 |
| Crocs | 5 |
| Acne Studios | 5 |
| Mizuno | 5 |
| On Running | 5 |
| Puma | 5 |
| Birkenstock | 4 |
| Carhartt WIP | 4 |
| **Hoka** (Wave 134/140 기존 + Wave 210 추가) | 4 신규 |
| Lacoste | 3 |
| Fear of God | 3 |
| Levis collab | 2 |
| ADER ERROR | 2 |
| Lululemon | 1 |
| Maison Kitsuné | 1 |
| Champion | 1 |
| Tommy Hilfiger | 1 |

## verify
- test:core 547/547 pass ✅
- commit `3b28bce`

## 누적 진척

Wave 198~210 — 12 phase 자율 진행:

| Wave | 내용 | SKU |
|------|------|-----|
| 198 | 의류 카테고리 + Tier 1 | 19 |
| 199 | 정정 + Tier 2 | 10 |
| 200 | Tier 3 (CDG/Stussy×Converse/Polo Tote) | 4 |
| 201 | CDG collab | 3 |
| 202 | On Running/Birkenstock/Lululemon/Levis | 12 |
| 203 | 마르지엘라 | 5 |
| 204 | 슈프림 8 collab | 8 |
| 205 | 크록스/칼하트/아크네/메종키츠네 | 15 |
| 206 | 푸마 | 5 |
| 207 | 미즈노 | 5 |
| 208 | 살로몬 | 7 |
| 209 | 아식스 | 8 |
| 210 | 호카/FOG/챔피온/토미힐피거 | 9 |

**총 110 SKU 추가** (clothing 17 + bag 18 + shoe 75).

## 다음 자율 후보

매물 sweep 더 필요 brand:
- 아디다스 mainstream (포럼/슈퍼노바 — 이미 일부 catalog)
- 나이키 추가 (덩크/조던/포스 narrow)
- 아미 (sample 검출 X 별도 query)
- 우영미 / 김상천 (한국 디자이너)
- 골프 brand (말본/PXG/타이틀리스트 — 이미 sport_golf 카테고리)
