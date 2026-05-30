# Wave 809 — Tier S 5 카테고리 catalog 박기

- 시간: 2026-05-30 KST
- 트리거: owner — "다 박자" (Wave 808 deepsweep 후)

## Background

Wave 807 cluster 분석 + Wave 808 sample 기반 parseability 진단 결과:
- daangn active 3일 안 158K건, SKU 매칭 49%, **미매칭 51% (80,892)**
- 그 중 Tier S (parseability ⭐⭐⭐⭐+ AND 함정 ≤30% AND 저~중저가) 5 cluster 식별

owner 결정:
- 명품 X (가격 비쌈)
- 비싼 거 X (다이슨 V11/V12 ₩20~38만 skip)
- 저~중저가 (₩2만~₩17만) 위주
- 일반인 친화 (메모리 `project_core_principle_consumer_friendly`)

## 박은 SKU 9개

신규 파일: `src/lib/generated/catalog-wave809-tier-s.ts`

| # | SKU id | category | msrpKrw | mustNotContain 핵심 패턴 |
|---|---|---|---|---|
| 1 | `lego-general-broad` | lego | 60K | 일괄/묶음/북스/미니피규어만 |
| 2 | `game-switch-title-broad` | game_console (isGameTitle=true) | 50K | 본체 포함/북미판/DS 게임칩/조이콘만 |
| 3 | `sport-golf-utility-broad` | sport_golf | 200K | 임팩드라이버 (Wave 787)/조던/벨트만 |
| 4 | `sport-golf-shoes-broad` | shoe | 100K | 조던 골프/장갑/벨트 |
| 5 | `sport-golf-wear-broad` | clothing | 80K | 골프화/골프채/유틸리티/골프공 |
| 6 | `earphone-airpods-4` | earphone | 199K | Pro/Max/ANC/노캔/왼쪽·오른쪽 유닛만 |
| 7 | `earphone-airpods-4-anc` | earphone | 249K | Pro/Max/일반 4세대와 분리 (confusionNote) |
| 8 | `home-appliance-dyson-v8` | home_appliance | 800K | V10/V11/V12/본체만/거치대만/Supersonic·에어랩 |
| 9 | `home-appliance-dyson-v10` | home_appliance | 1000K | V8/V11/V12/본체만/Supersonic |

## DB 검증 (rematch SQL 실행 후)

```
catalog 매칭 가능 매물: 4,021건 (Wave 807 추정 1,750~3,250 보다 많음)
  - 이미 mvp_listing_parsed row 있음 (parser_version reset): 139
  - parsed row 없음 (다음 cron tick 에 신규 분류): 3,882
```

cron 1~2 tick 후 측정:
- 신규 sku_id 매칭 카운트 (per SKU)
- ready pool 진입 비율
- 너무 적으면 → mustContain 보강
- 너무 많거나 함정 매물 들어오면 → mustNotContain 추가

## 박힌 함정 패턴 (sample 검증된 것)

### 1. 레고
- "다양한 중고레고 11종 일괄" — 묶음
- "DK 북스 레고 스타워즈" — 책
- "레고 스타워즈 피규어 판매" — 미니피규어만

### 2. 닌텐도 게임
- "닌텐도 스위치 구매하시면 별의 커비 서비스" — 본체 + 게임 묶음
- "마리오 래비드 킹덤 (북미판)" — 지역판
- "닌텐도 DS 게임칩 3종" — 멀티팩

### 3. 골프
- "닌텐도 스위치 마리오골프" — 게임 (오타 매칭)
- "스위치 게임 ... 마리오 카트8 ... 골프" — 게임 묶음
- "조던 1 로우 골프 코트 퍼플" — 스니커즈 콜라보 (₩140K)
- "임팩드라이버" — 전동 공구 (Wave 787 P0 catalog bug 재발 차단)

### 4. 에어팟 4세대
- "에어팟 4 c타입 본체 (노캔O)" — ANC 와 분리 필요
- "에어팟4 오른쪽 유닛" — 단편 (시세 불가)
- "에어팟 4세대 + 오른쪽 풀박스 노캔x" — 노캔 없는 일반 4세대

### 5. 다이슨 V8/V10
- "다이슨 V11 메인모터 구합니다" — 구매 글
- "다이슨 V10 V12 SV18 모터헤드" — 부속품
- "다이슨 V8 충전 거치대" — 부속품
- "다이슨 V12 슬림 플러피 헤드" — V12 (비쌈, skip)

## Trade-off

### Broad SKU vs Narrow
- 레고/닌텐도 게임: broad 1개 SKU 로 일단 잡고 narrow 분리 추후 (set 별로 가격 다양 → 시세 분산 클 수 있음)
- 골프 3 SKU (유틸/골프화/웨어): product type 분리 ↑
- 에어팟 4: ANC 분리 강제 (가격 +50K)
- 다이슨 V: V8/V10 narrow (V11/V12 별도, 비싸서 skip)

### Risk
- `lego-general-broad` 시세 분산 가능성 — sample 상 ₩10K (책/피규어) ~ ₩610K (베나터). madTrim 으로 자체 outlier 차단 기대 (Wave 90).
- 시세 분산 너무 크면 catalog narrow split 별도 wave 필요.

### Wave 727 / Wave 735 와 겹침
- 기존 `WAVE_727_GOLF_BROAD`, `WAVE_735_GOLF_BROAD_2` 존재
- 본 SKU 와 매칭 충돌 가능 — production 검증 후 mustNotContain 조정 (충돌 시).

## Follow-up

### 즉시 모니터
- cron 1~2 tick (약 30분~1h) 후 신규 sku_id 매칭 카운트 측정
- ready pool 진입율 확인
- 비교 매물 카드 (lookup / pack reveal) 에 새 SKU 정상 노출 확인

### 다음 wave 후보 (Wave 808 의 Tier A)
- **신발 누락 모델** (이지부스트 350/700, 삼바, 슈퍼스타, 가젤) — 기존 catalog 확장
- **애플 매직 키보드** — narrow per 사이즈 (11/12.9/13") + 호환품 (AITEWO/Nimin/HOU) 50% 차단
- **다이슨 V11/V12** — owner 결정 (비싼지 검토)

### 다음 wave 후보 (Wave 807 의 Tier B 검토)
- 케이스티파이/슈피겐 — 시세 분산 10x 라 narrow split 박을 만하면 (basic vs collab)
- 향수 (딥디크/이솝) — 라인+사이즈+제품 type 3축 narrow split

### 보류 (의도)
- 명품 가방/의류 (owner X)
- 게임기 본체 (비쌈)
- 카메라/노트북 (비쌈)
- 반려동물/모자/운동복 generic (normalize 어려움)
