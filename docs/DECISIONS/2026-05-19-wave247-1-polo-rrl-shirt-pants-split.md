# Wave 247.1 — Polo RRL Shirt / Pants narrow split

- date: 2026-05-19
- type: catalog narrow split (additive — SKU 신설 + broad catch-all 보존)
- scope: `clothing-polo-rrl-shirt`, `clothing-polo-rrl-pants` (신설), `clothing-polo-rrl-shirt-pants` (catch-all), `clothing-polo-rrl` (broad mustNotContain 보강)
- branch: `ux/me-cleanup-2026-05-19`

## 배경

Wave 245 narrow split 효과 측정 후속. baseline 75건 → broad RRL CV 1.56 → 6 narrow lane 분리. 그 중 `clothing-polo-rrl-shirt-pants` 만 CV 0.86 — 다른 narrow (CV 0.31~0.61) 의 1/4 정도 분산 미흡.

production sample 74건 분포 (sku_name 별):
- shirt 49건 (66%) median ₩340k (₩13k~215만)
- pants 20건 (27%) median ₩370k (₩14만~95만)
- other/모호 5건 (7%)

shirt 매물 가격 범위 너무 넓음 (₩13k~₩215만 — 200배). pants 도 만만찮음 (7배). product-type 별 분리하면 시세 grouping 더 정확.

## 결정

`polo-rrl-shirt-pants` 를 3 lane 으로 split (Wave 218/245 패턴 — narrow + catch-all):

### 1. `clothing-polo-rrl-shirt` (신설)
- SPECIFIC subtype 키워드만: oxford/옥스포드/버튼다운/체크셔츠/샴브레이/chambray/워크셔츠/린넨셔츠/헨리/플란넬/flannel/남방/다이아 체크/윈드페인
- defaultProductType: "shirt"
- msrp 290k (production median 기반)

### 2. `clothing-polo-rrl-pants` (신설)
- SPECIFIC subtype 키워드만: 치노/chino/슬랙스/오피서 팬츠/jodhpur/조드퍼/조파/트라우저/카펜터/카고 팬츠/카키 팬츠/필드 치노/헤링본 팬츠
- defaultProductType: "pants"
- msrp 380k (production median 기반)

### 3. `clothing-polo-rrl-shirt-pants` (catch-all 보존)
- mustContain 유지 (셔츠/팬츠/코듀로이/워크팬츠/코튼/린넨 등 — broad 모호 매물 잡음)
- mustNotContain 에 narrow specific 키워드 추가 → narrow lane 우선 매칭

### 4. `clothing-polo-rrl` (broad RRL fallback)
- mustNotContain 에 narrow specific 키워드 추가 (슬랙스/jodhpur/조드퍼/oxford/옥스포드/버튼다운/플란넬 등)
- 이유: broad RRL 가 narrow 키워드 매물 매칭하면 narrow+broad 충돌 → null 매칭 (skuMatches 다중 매칭 시 ambiguity).

## 매칭 정책 (Goldilocks)

- **narrow=fallback / broad=차단** (Wave 236d) 원칙 적용:
  - 매물이 SPECIFIC subtype 키워드 가지면 narrow 매칭 (e.g. "RRL 옥스포드 셔츠" → narrow shirt)
  - 일반적 "셔츠"/"팬츠" 매물은 catch-all (e.g. "RRL 셔츠 m사이즈" → catch-all)
  - narrow + broad 충돌 시 broad mustNotContain 으로 강제 narrow 우선

## 검증 (production sample)

15 test case PASS — narrow shirt 5건, narrow pants 4건, catch-all 3건, 다른 lane regression 3건.

20 production 매물 분포:
- 8건 narrow shirt (워크셔츠/체크셔츠/샴브레이/플란넬 등)
- 1건 narrow pants (오피서 필드 치노)
- 11건 catch-all (코듀로이 셔츠/코튼 린넨 필드 팬츠/웨스턴 셔츠 등 — specific subtype 키워드 모자란)

```
PASS clothing-polo-rrl-shirt <- 더블알엘 RRL 패턴 체크 셔츠 M 사이즈
PASS clothing-polo-rrl-shirt <- 더블알엘 슬림 샴브레이 웨스턴 셔츠 L RRL
PASS clothing-polo-rrl-pants <- RRL 슬랙스 30
PASS clothing-polo-rrl-pants <- RRL 조드퍼 팬츠
PASS clothing-polo-rrl-shirt-pants <- rrl 셔츠 m사이즈 팔아요  (모호한 매물 catch-all)
PASS clothing-polo-rrl-denim <- RRL 더블알엘 청바지 32
PASS clothing-polo-rrl-jacket-coat <- RRL 빈티지 트러커 자켓
PASS clothing-polo-rrl-tee <- RRL 후디 L
```

## test:core

기존 562/569 pass — 변경 없음. 7건 pre-existing /me UI contract failure (본 wave 영향 X).

## 후속

- LANE_READINESS: `polo_rrl_shirt`, `polo_rrl_pants` 둘 다 `status: "ready"` 박음.
- production rematch: `mvp_raw_listings.detail_status = 'pending'` 74건 reset → 다음 cron tick 에서 자동 재분류.
- 24h 후 narrow lane 별 CV 측정 — shirt narrow / pants narrow 분포 검증 (별도 wave).

## 정책 준수

- additive only — 기존 catch-all 유지, narrow 신설.
- DB UPDATE 는 detail_status 만 (pending) — 비파괴, classify pipeline 가 재분류.
- decision log 즉시 박음 (이 파일).
- test:core 회귀 검증 완료.
- narrow=fallback / broad=차단 (Wave 236d Goldilocks).
- 사용자 친화 — 운영자/사용자 모두 "셔츠 따로 / 팬츠 따로" 직관적.
