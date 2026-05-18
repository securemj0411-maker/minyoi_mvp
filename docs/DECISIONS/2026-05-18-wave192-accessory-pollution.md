# Wave 192 — production 액세서리 오염 + 시세 정정 (2026-05-18)

## 배경

Wave 191 (query rotation fair) 박은 후 신규 카테고리 query scan 진척:
- perfume 100% → 16% never_scanned
- lego 100% → 11%
- kickboard 100% → 32%

raw_listings 매물 증가 + parsed/detail 진척 확인. 다음 — production sweep으로 오염률 검토 (사용자 요청).

## 발견

parsed sample 20건 중 액세서리 7건이 본품 SKU로 잘못 매칭됨:

| 매물 title | 잘못 매칭된 SKU | 실제 |
|-----------|-----------------|------|
| Dji 스마트 조종기(컨트롤러) 팝니다 | dji-mini-2 | 조종기 단품 |
| 고프로 볼타 그립 (고프로 9, 10, 11, 12) | gopro-hero-9 | 그립 단품 |
| 가민 피닉스7 바이크 자전거 마운트 | garmin-fenix-7 | 마운트 단품 |
| K&F DJI Mini 4 PRO 2in1 필터 키트 (2087) | dji-mini-4-pro | 필터 키트 |
| DJI 미니4 프로 ND 필터 세트 ND16/64/256 | dji-mini-4-pro | 필터만 |
| DJI 오즈모 포켓3 BRDRC 마운트 홀더 | dji-osmo-pocket-3 | 마운트 |
| K&F Concept DJI 오즈모 포켓 3용 필터 | dji-osmo-pocket-3 | 필터만 |

**시세 영향**:
- dji-mini-2 median 312,800 (정상 80~90만)
- dji-mini-4-pro median 44,160 (정상 100만+)

액세서리 가격이 시세 sample로 들어가서 median 비현실적 낮음 → 본품 매물 profit 음수 → 풀 진입 차단. 시세 오염이 본품 차단을 일으키는 cascade.

## 결정

### 1. DRONE_FILTER_ACCESSORY_NOISE 확장

```ts
const DRONE_FILTER_ACCESSORY_NOISE = [
  "필터만", "필터 단품", "렌즈 필터", "보호 필터", "uv 필터", "cpl", "2in1 필터", "필터 세트",
  // 조종기/컨트롤러
  "스마트 조종기", "조종기 단품", "조종기만", "컨트롤러 단품", "컨트롤러만",
  "rc 컨트롤러", "rc-n1", "rc-n2", "rc2", "smart controller",
  "리모컨만", "리모컨 단품",
  // 그립/마운트/홀더
  "볼타", "그립 단품", "셀카봉만", "셀카봉 단품", "삼각대만",
  "헬멧 마운트", "마운트 단품", "흡착 마운트",
];
```

### 2. GARMIN_ACCESSORY_NOISE 신규 상수

```ts
const GARMIN_ACCESSORY_NOISE = [
  "바이크 마운트", "자전거 마운트", "핸들바 마운트", "퀵 릴리즈 마운트",
  "쿼터 마운트", "마운트 어댑터", "마운트 키트",
  "충전 케이블", "충전 거치대", "충전 도크", "도크만",
  "스트랩 단품", "밴드 단품", "실리콘 스트랩", "메탈 스트랩", "가죽 스트랩",
];
```

가민 11개 SKU 모두 spread (replace_all unique terminator 활용).

### 3. production 정정 (UPDATE)

9건 잘못 매칭된 매물 reset:
- `sku_id NULL`, `sku_name NULL`
- `detail_status = 'pending'`, `score_dirty = true`

다음 tick에 새 catalog (Wave 192) 로 ruleMatch 재실행. 모두 본품 아니라 매칭 실패 → 시세 sample에서 제외.

다음 daily 시세 계산 (자동) 시 잘못된 sample 제거 → median 정상화 → 본품 매물 풀 진입 가능.

## verify / commit

- typecheck clean
- test:core 446/447 (사전 wave159h 1건 무관)
- commit `7dbd835`

## 정책 정합성

§12b 정확성 우선 — false positive 0 목표. 시세 sample 오염은 정확도 손실의 가장 큰 원인. 이번 fix로:
- 액세서리/단품 매물 SKU 매칭 차단 → 시세 sample 정정
- 본품 매물만 profit 계산에 참여 → 추천 정확도 ↑

## 알려진 한계

"고프로 히어로10 블랙 액션캠 + 볼타(Volta)" 같은 **본품 + 액세서리** 매물도 "볼타" 키워드로 차단됨 (false negative). 정책상 false positive 0 우선이라 trade-off 수용. 사용자 노출 X — 실제 셀러는 "고프로 히어로10 블랙" 식으로 재등록하거나 풀 진입 안 함.

## 다음 액션

10~20분 후 measure:
1. mvp_market_price_daily — dji-mini-2 / dji-mini-4-pro median 정상화 확인
2. candidate_pool 신규 카테고리 ready 매물 진입 확인
3. 잔존 오염 매물 추가 발견 시 catalog 추가 보강
