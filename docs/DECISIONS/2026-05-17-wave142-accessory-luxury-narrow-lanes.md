# 2026-05-17 — Wave 142: accessory/luxury narrow lane 3 신설

## 사용자 의도

> "내가 원래하고있는게 우리 상품 다양화로 파츠랑 악세사리 이런거 확장하려던거 아니야? 에플펜슬이나 매직키보드나 등등??"

5-iteration 정밀 검토 후, 액세서리/luxury 영역에서 narrow lane으로 ready 가능한 후보 압축.

## 정밀 검토 (한번 더, "없으면 지금 찾은거만 하자")

### 후보 평가표

| 후보 | 단독 매물 (sample) | median | 판단 |
|---|---:|---:|---|
| **매직키보드 (iPad용)** | 43 (51 catalog 룰 시뮬) | ₩330k | ✅ ready |
| **애플워치 Hermes S10** | 42 | ₩962k | ✅ ready |
| **애플워치 Hermes S8** | 29 | ₩528k | ✅ ready |
| 애플펜슬 (2/1세대) | **0 단독** (192건 모두 iPad 번들) | - | ❌ drop |
| Hermes Ultra/S5/S6/S7/S9 | 각 <10 | - | ❌ 표본 부족 |
| 매직키보드 맥용 | 0 | - | ❌ 매물 없음 |
| 매직마우스/트랙패드/에어태그/홈팟/애플TV/비전프로 | 각 <15 | - | ❌ 표본 부족 |
| 갤럭시 버즈 | 98 | - | ❌ narrow accessory 아님 (본품 카테고리 영역) |
| 아이패드미니/에어/맥북 sku_id NULL | 92~55 | - | ❌ catalog 매핑 영역 (DAMAGED false positive cleanup 별개) |

### 핵심 발견 (정밀 검증)

- **애플펜슬 단독 매물 = 0건**. 192건 모두 "아이패드 프로 + 애플펜슬 2세대" 형태의 iPad 번들. 펜슬 단독 SKU 신설하면 잘못된 시세 잡힘 → drop.
- **Hermes는 밴드가 아닌 애플워치 Hermes Edition 본품**. 가죽 밴드 일체형 매물. luxury body lane 으로 처리.

## 변경

### Patch 1 — catalog.ts magic-keyboard-ipad 신설

- `src/lib/catalog.ts:2312+` (ipad-11 SKU 다음, tablet 영역 끝):
  - id: `magic-keyboard-ipad`, category: `tablet`, laneKey: `magic_keyboard_ipad`
  - mustContain: `[["매직 키보드","매직키보드","magic keyboard"], ["아이패드","ipad","에어","air","프로","pro","미니","mini"]]`
  - mustNotContain: 맥북/imac/단품/부품/케이스만/스마트키보드/폴리오/구매 + **본품 옵션 token (256gb/128gb/512gb/64gb/1tb/wifi/wi-fi/셀룰러/cellular/lte)** — 본품 + 키보드 번들 매물 차단, 키보드 단독만 narrow lane
  - confusionNote: "iPad Pro/Air 11/12.9/13인치 다 호환. Smart Keyboard Folio (저가) 와 분리."
  - 11인치 vs 13인치 표기 불명확 매물 25/43건 多 → 단일 SKU 통합

### Patch 2 — catalog.ts Apple Watch Hermes 2 SKU 신설

- `src/lib/catalog.ts:4531+` (applewatch-ultra2 SKU 다음):
  - `applewatch-series8-hermes` (category: smartwatch, laneKey: `applewatch_s8_hermes`)
    - mustContain: `[["애플워치","apple watch","applewatch","에플워치"], ["시리즈 8","series 8","s8","워치8",...], ["에르메스","hermes"]]`
    - mustNotContain: se/ultra/타 시리즈/밴드만/스트랩만/부품/매입 등
    - msrp 1799000
  - `applewatch-series10-hermes` (category: smartwatch, laneKey: `applewatch_s10_hermes`)
    - mustContain 동일 패턴 (S10)
    - msrp 1899000

### Patch 3 — 기존 broad SKU 격리 (mustNotContain 에 "에르메스/hermes" 추가)

- `applewatch-series8` mustNotContain 끝에 `"에르메스","hermes"` 추가
- `applewatch-series10` mustNotContain 끝에 `"에르메스","hermes"` 추가
- → broad Hermes 매물이 일반 SKU 로 잘못 잡히는 collision 차단

### Patch 4 — LANE_READINESS 3 entry

- `src/lib/category-readiness.ts:385+` (LANE_READINESS map 끝):
  - `magic_keyboard_ipad`: status=ready, note (43건/₩330k/p25-p75/단일 SKU 통합 사유)
  - `applewatch_s8_hermes`: status=ready, note (29건/₩528k/밴드 별매 차단 양방향 격리)
  - `applewatch_s10_hermes`: status=ready, note (42건/₩962k/+₩300~400K 시세 차이/격리 사유)

## 검증

### 테스트 / 타입체크
- `npm run test:core` → **288/288 pass** ✅
- `npx tsc --noEmit` → 기존 wave141-152 fixture에 `released` 필드 누락 + `riskHits/scoreFlags` 누락 (이번 변경 무관). 신규 SKU 영역 영향 X.

### Reparse 전체 (26,513 matched 매물)
27 batch × 1,000건 sweep:
- offset 0~22000: reclassified 62 (catalog 변경 직후 sample)
- offset 23000~26513: reclassified **787** (옛 매물 catalog 갱신 효과)

### DB 적용 (최종)

| sku_id | listing_type | cnt | median |
|---|---|---:|---:|
| `applewatch-series10-hermes` | normal | **33** | ~₩962k |
| `applewatch-series8-hermes` | normal | **15** | ~₩528k |
| `magic-keyboard-ipad` | normal | **12** | ~₩330k |

핵심 검증 — `pid=370677269` "애케플 애플워치 10 에르메스 42mm" → 이전 `applewatch-series10` (broad, 잘못) → reparse 후 `applewatch-series10-hermes` ✅

### narrow lane 가 못 잡은 Hermes 매물 분포 (의도 영역)
- `applewatch-ultra3`: 7, `applewatch-ultra2`: 5, `applewatch-ultra`: 1, `applewatch-series9`: 5, `applewatch-series7`: 3, `applewatch-series6`: 1
- → Ultra/S5/S6/S7/S9 Hermes narrow lane 안 만들었으니 broad 잡는 게 정상. 표본 < 10 으로 narrow 만들지 않은 정책. 추후 표본 누적 시 lane 추가 가능.

## 위험

- **매직키보드 false positive**: 본품 + 키보드 번들 매물 일부가 narrow lane 으로 잘못 흡수될 가능성 — mustNotContain 본품 옵션 token (gb/wifi 등) 으로 1차 차단. 정확도 만점은 아니지만 magic-keyboard-ipad 단독 매물만 잡는 방향으로 strict 함.
- **Hermes 일반 SKU recall 감소**: broad series8/10 매물 중 "에르메스" keyword 있는 매물이 reject — 일반 Apple Watch 매물 풀에 들어가지 않음. 단, 그 매물은 narrow lane 으로 정확하게 잡힘.
- **Ultra Hermes/S9 Hermes 시세 오염**: 일반 ultra2/ultra3/series9 SKU 풀에 Hermes 매물 1~7건씩 섞임. 시세 distribution 다소 흔들릴 수 있으나 표본 작아 영향 미미. 표본 누적 시 narrow lane 추가 결정.

## 다음

- 14일 누적 후 신규 lane 매물 수 추세 측정 (`mvp_market_price_daily` 표본 충분도)
- Ultra Hermes / S9 Hermes narrow lane 추가 결정 (표본 누적 시)
- 사용자 노출 풀 (admin-pool + pack-reveal + user-reveal-dashboard) 에서 신규 SKU 카드 정상 렌더 확인
