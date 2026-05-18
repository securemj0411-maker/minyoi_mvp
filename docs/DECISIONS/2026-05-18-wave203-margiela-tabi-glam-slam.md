# Wave 203 — 마르지엘라 5 SKU + 향수 dupe 차단 (2026-05-18)

## production sweep deep mining

slm 80건 sample 거의 다 마르지엘라 (압도적):

### 마르지엘라 신발 (시그니처)
| 모델 | 매물 sample | 가격대 |
|------|------------|--------|
| **Tabi** (펌프스/뮬/플랫/하이탑/스니커즈/로퍼) | 다수 (faved 16~66) | 100K~850K |
| German Army Trainer (Replica) | 매물 (faved 16~23) | 125K~149K |
| MM6 더비 / 컷아웃 샌들 / 푸퍼 부츠 | 매물 (faved 18~22) | 150K~365K |
| **MM6 × Salomon** (X-ALP/ACS/Cross) | 매물 4건 (faved 14~25) | 280K~400K |
| Sprinter Low Top / Spray Sneakers | 매물 (faved 11~12) | 318K~750K |
| Socks Runner | 매물 (faved 11) | 430K~450K |

### 마르지엘라 가방 (시그니처)
| 모델 | 매물 sample | 가격대 |
|------|------------|--------|
| **Glam Slam** (토트/미니/숄더) | 다수 (faved 18~32) | 680K~1.5M |
| 5AC Camera / Numeric Cross | 매물 (faved 17) | 460K~698K |
| 체인월렛 woc | 매물 (faved 49) | 400K |
| 투웨이 토트 | 매물 (faved 39) | 490K |
| MM6 재패니즈 트라이앵글 | 매물 (faved 19) | 80K~99K |
| 버킷백 | 매물 (faved 19) | 450K |

### MM6 의류 (별도 sub-line)
- MM6 의류 broad (티/후드/맨투맨/셔츠/자켓) — Numeric 라인 다수

### 🚨 향수 dupe 매물 폭발적
- **"50ml 메종마르지엘라 재즈클럽 type 필드센트 재현향스프레이" 21K (faved 313!)** ⭐
- "마르지엘라 바이더파이어플레이스 type 마이퍼퓸 재현향스프레이" 20K (faved 104)
- 섬유탈취제 / 룸스프레이 / dupe향 등 가품 dupe 시장 매우 큼.

→ Replica 향수 4 SKU mustNotContain 강화:
  - "재현향", "type", "필드센트", "마이퍼퓸"
  - "섬유탈취제", "룸스프레이"
  - "오피셜", "더미 향수"
  - "dupe", "dupe향"

## 신규 SKU 5개

```ts
shoe-margiela-tabi          // 시그니처 (펌프스/뮬/플랫/하이탑/스니커즈/로퍼)
shoe-margiela-german-army   // Replica Trainer
shoe-mm6-salomon-collab     // X-ALP/ACS/Cross
bag-margiela-glam-slam      // 시그니처
clothing-mm6-margiela       // MM6 의류 broad
```

mustNotContain 정교 분리:
- Tabi → MM6 × Salomon / 닥터마틴 collab / Rick Owens / AMI / kids 차단
- German Army → Tabi / Salomon / kids 차단
- MM6 × Salomon → Tabi / CDG / kids 차단
- Glam Slam → 향수 dupe ("재현향" 등) / kids 차단
- MM6 의류 → 향수 dupe / Tabi / Salomon / 닥터마틴 / kids / 가방 / 신발 차단

## 누적 48 SKU → 53 SKU (Wave 198~203)

| 카테고리 | SKU |
|---------|------|
| clothing | 16 |
| bag | 11 |
| shoe | 26 |

| brand | SKU 수 | 비고 |
|-------|--------|------|
| Polo Ralph Lauren | 7 | |
| The North Face | 8 | |
| Stüssy | 9 | |
| Lacoste | 3 | |
| ADER ERROR | 2 | |
| Comme des Garcons | 5 | Nike/NB/Vans/Salomon collab + PVC |
| On Running | 5 | Monster + Cloud + Surfer + Loewe + PAF collab |
| Birkenstock | 4 | Boston/Arizona/Zürich/Milano |
| Lululemon | 1 | Backpack |
| Levis collab | 2 | NB/Nike |
| **Maison Margiela** | **5** | Tabi/German Army/MM6 Salomon/Glam Slam/MM6 의류 |

## verify
- test:core **524/525** (failing 1건 wave207 earphone single-side — 사전 issue, 내 변경 무관)
- commit `22af195`

## 자기 평가

- 마르지엘라 80건 sample 분석 — 향수 dupe 매물 매우 많음 발견 (faved 313 압도적)
- "Replica" 라인 (정품 향수) vs "재현향 스프레이" (가품 dupe) 구분 명확화
- Tabi 시그니처 가격대 매우 다양 (100K~850K) — broad SKU 적정
- MM6 sub-line 별도 SKU 분리 — Main / MM6 / collab 명확 구분
- 시뮬레이션 효과: 마르지엘라 매물 50+건 정상 catalog 매칭 가능

## 다음 자율 진행

- 추가 brand sweep (슈프림/아미/아크네/칼하트/우영미 — sample 검출 X — 따로 query)
- TNF Antarctica/Himalayan 시즌
- 시세 정확도 + 가품 차단 측정 (production deploy 후)
