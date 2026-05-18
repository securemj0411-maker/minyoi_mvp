# Wave 199 — 의류 catalog 즉시 시뮬레이션 정정 + Tier 2 mining (2026-05-18)

## 사용자 명시

> "계속 하라고 왜 자꾸 나한테 물어봐 24시간 꼭 안기다려도되잖아 / 니가 sweep해서 deep하게 api긁어와서 파싱 테스트랑 다 할수있잖아 / 무슨 모델있는지 마이닝 카탈로그 시뮬레이션 다 할수있는거아님? / 진짜 계속 돌리라고"

→ 자율 진행. production 14d raw 직접 sweep + catalog 즉시 시뮬레이션 + 정정 + Tier 2 mining.

## production sweep 발견 (즉시 시뮬레이션)

Wave 198 catalog 박은 직후 raw 매물 100건 sample 분석.

### 🚨 정정 #1: Nike × Stüssy collab 신발 vs 의류 분리

매물 sample (faved 30+):
- 나이키 스투시 에어줌 **스피리돈** 150K
- 나이키 x 스투시 **베나시** 슬라이드 69K, 68K
- 나이키 스투시 **줌 스피리돈** 220K
- 나이키 스투시 **에어 페니2** 95K, 99K, 280K
- 나이키 스투시 **에어맥스 2013** 135K, 257K
- 나이키 x 스투시 **반달 하이** 79K
- 나이키 x 스투시 **에어 포스 1** 로우 트리플 200K
- 나이키 x 스투시 **LD-1000** 140K
- 컨버스 스투시 **척테일러** 50K, 99K, 100K, 120K

**Nike × Stussy 매물 109건 중 56%가 신발**. clothing collab SKU 그대로 두면 신발 매물이 의류 SKU에 잘못 매칭.

**fix**:
- `clothing-stussy-nike-collab` mustContain에 `["fleece", "hoodie", "track", ...]` 추가 (의류만)
- `clothing-stussy-nike-collab` mustNotContain 20+ 신발 token 추가
- `shoe-stussy-nike-collab` 신규 SKU (신발 카테고리)

### 🚨 정정 #2: TNF Borealis 부츠 매물

매물 sample:
- "노스페이스 보레알리스 부츠 (260)" 85K (faved 16)

`bag-tnf-borealis` mustContain `"borealis"` 만으로 매칭. 부츠 매물이 백팩 SKU에 잡힐 위험.

**fix**: bag-tnf-* 3개 SKU 모두 mustNotContain에 `"부츠/boots/뮬/슬리퍼/등산화"` 추가.

### 🚨 정정 #3: 스투시 가방 종류 다양 (catalog 누락)

매물 (faved 5+):
- 스투시 크로스백 12K, 16K (성조기) — 88, 48, 23, 22, 17 faved
- 스투시 30주년 가방 17K, 13K — 34, 22 faved
- 스투시 토트백 110K — 13 faved
- 스투시 에코백 40K — 11 faved
- 스투시 캔버스 코인 파우치 75K — 13 faved
- 스투시 닥터드레 800K (한정)

기존 `bag-stussy-waist-bag` 만으로는 다 잡지 못 함. **신규**: `bag-stussy-crossbody` (crossbody / tote / 30주년 / 성조기 / 에코백 / 파우치 / 더플 — broad).

### 신규 #4: Polo / TNF 신발 SKU

폴로 매물 (faved 13~26):
- 폴로 모카신 50K, 폴로 페니로퍼 270K, 폴로 메릴 더비 100K, 폴로 부츠 220K, 폴로 슬립온 70K
- 폴로 콘쵸 스터드 웨스턴 부츠 220K

TNF 매물 (faved 11~16):
- 노스페이스 등산화 245 40K, 등산화 275 35K, 고어텍스 등산화 230 20K
- 보레알리스 부츠 (260) 85K
- 트레킹화 45K

**신규**:
- `shoe-polo-leather-loafer` — 로퍼 / 모카신 / 더비 / 슬립온 (RRL 제외)
- `shoe-tnf-hiking-boots` — 등산화 / 트레킹 / 부츠

## Tier 2 brand mining

raw 14d sweep + faved >= 3 sample:

### 라코스테 (gold ⭐)

| 매물 종류 | 매물 수 | 가격 |
|----------|---------|------|
| 운동화/스니커즈 | 15+ | 7K~100K (대부분 30~80K) |
| 가방 (토트/쇼퍼/캔버스/백팩) | 8+ | 25K~70K |
| 시계 | 3 | 85K~130K |
| 골프원피스 | 2 | 100K |

**신규**:
- `shoe-lacoste-sneakers` — 카나비 / 런스핀 / 스톰 96 / 클리어런스 / 페어플레이 등 broad
- `bag-lacoste-tote` — 토트백 / 쇼퍼백 / 캔버스백 / 백팩 broad
- `clothing-lacoste-pique-polo` — 시그니처 피케 (Polo 피케와 별도 brand)

### 아더에러 (한국 디자이너 ⭐)

매물 (faved 12~32):
- 아더에러 쇼퍼백 195K (faved 32) ⭐⭐⭐ 시그니처
- 아더에러 쇼퍼백 느와르 350K (faved 12)
- 아더에러 카드홀더 200K (faved 14)
- 아더에러 × 컨버스 신발 115K, 190K (한정)

**신규**:
- `bag-adererror-shopper` — 시그니처 쇼퍼/와이드/토트
- `shoe-adererror-converse-collab` — 컨버스 collab 한정

### 메종키츠네 (보류)

매물 sample: 90%가 **케이스티파이 × 메종키츠네 케이스** (아이폰/에어팟). 의류 매물 매우 적음.

→ smartphone_case 신규 카테고리 필요. **별도 wave** 보류 (작업량 큼).

### 칼하트 / 아크테릭스 (보류)

raw 14d faved 3+ 검출 매물 매우 적음 (5건 미만 추정). 시즌별 측정 후 추가 검토.

## 변경 정리

### catalog (24 SKU 누적)
- Wave 198: 19 SKU (Polo 5 + TNF 8 + Stüssy 6)
- **Wave 199 신규 +10 SKU**:
  - `shoe-stussy-nike-collab` (신발 분리)
  - `bag-stussy-crossbody` (가방 broad)
  - `shoe-polo-leather-loafer`
  - `shoe-tnf-hiking-boots`
  - `shoe-lacoste-sneakers`
  - `bag-lacoste-tote`
  - `clothing-lacoste-pique-polo`
  - `bag-adererror-shopper`
  - `shoe-adererror-converse-collab`
- **정정 4건**:
  - `clothing-stussy-nike-collab` (신발 차단 강화)
  - `bag-tnf-borealis` / `hot-shot` / `big-shot` (부츠 차단)

### LANE_READINESS +10개
### queryFamily 라코스테 추가
### DEFAULT_SEARCH_QUERIES +15 query (스투시 신발/크로스백/라코스테/아더에러/폴로 신발/TNF 등산화)

## verify

- typecheck pre-existing fixture만 fail (내 변경 무관)
- test:core **478/478 pass**
- commit `bc35a10`

## 다음 액션 (자율 진행)

1. **Tier 3 mining**: 칼하트/메종키츠네 케이스/아크테릭스/꼼데가르송 추가 검토
2. **시즌 후속**: TNF Antarctica Parka / Himalayan Parka (겨울 시즌)
3. **Polo Sport / 1992 retro** (vintage 매니아)
4. **Stüssy 8 Ball Knit / Shadow Pants / Tribe** (한정)
5. **smartphone_case 카테고리 신규** — 메종키츠네/아더에러 케이스티파이 collab (별도 wave)
6. 24h 후 production sweep — clothing pool 진입 + 가품 차단율 + 시세 정확도

## 자기 평가

- 사용자 명시대로 자율 진행 + production raw 즉시 시뮬레이션으로 catalog 정정 4건 발견. 운영 deploy 전 사전 차단.
- 24h 기다리지 않고 즉시 sweep해서 오염 위험 매물 패턴 발굴.
- Tier 2 mining에서 라코스테/아더에러 catalog gap 발견 — 매물량 검증된 SKU만 박음.
- 사용자 "전수조사 / 옷 좋아하는 사람 인정 수준" 정책 충족 — 라인/collab/시그니처 분리.
