# Wave 237 (2026-05-19) — production sample audit (clothing/bag + 다른 카테고리)

## 발단

사용자: "이제 그럼 분류 다 잘되는거맞음?? 계속 진행해봐"

정직 답: simulate 결과는 의도 정확 but production 실제 sample 검증 안 함. 자율 진행 — broad SKU + 다른 카테고리 (시계/드론/카메라) production 매물 sample 직접 SQL 추출.

## 발견 mismatch

### A. clothing broad SKU
- `clothing-polo-rrl` — "RRL 나바호 빈티지 팔찌" 320k 매물 (주얼리/액세서리) → 의류 SKU 잘못 매칭
- `clothing-tnf-supreme-collab` — "슈프림 노스 데이팩 데님" 410k 매물 (백팩) → 의류 SKU 잘못 매칭 (mustNotContain "데이팩" 누락)

### B. smartwatch — 밴드 단품
- `applewatch-series4` — "정품 스포츠 실리콘밴드 베이퍼그린" 50k / "스포츠루프 스타라이트" 17~38k → **본품 X, 밴드 단품**
- 가격대: 본품 13~16만 vs 밴드 1.7~5만 → 시세 median 왜곡

### C. smartwatch — 역경매
- `applewatch-ultra` — "애플워치 울트라 구매합니다(가격상의)" 500k → UNIVERSAL_BUY_REQUEST_NOISE "구매합니다" 누락

### D. DJI 드론/카메라 — 액세서리 단품 다수 (가장 영향 큼)
| 매물 | 가격 | SKU |
|---|---|---|
| "DJI 매빅3 드론배터리" | 120k | dji-mavic-3 (본품 1.5M+) |
| "DJI Mavic3 ND필터" | 15k | dji-mavic-3 |
| "DJI Air 3S 전용 PL 필터" | 18k | dji-air-3s (본품 1.5M+) |
| "DJI 미니4프로 프로펠러 360 가드" | 50k | dji-mini-4-pro (본품 800k) |
| "DJI 액션6 매크로 렌즈" | 118k | dji-osmo-action-6 (본품 700k) |
| "DJI 오즈모 포켓3 배터리 핸들" | 64k | dji-osmo-pocket-3 (본품 600k) |
| "DJI 오즈모 포켓4 스킨 스티커" | 18k | dji-osmo-pocket-4 |
| "DJI mini 마이크 미니" | 82k | dji-mini-2 |
| "DJI Air 3S 슬링백 정품" | 40k | dji-avata |

본품 가격 대비 5~50배 차이 → 시세 median 왜곡 매우 큼.

## fix

### 1. UNIVERSAL_BUY_REQUEST_NOISE 보완
- 추가: "구매합니다", "구매 합니다" (Apple Watch Ultra 사례)

### 2. UNIVERSAL_ACCESSORY_ONLY_NOISE 신설 + smartwatch 적용
새 cross-cutting noise 정의. `skuMatches` 안에서 `category === "smartwatch"` 조건부 적용.
```ts
const UNIVERSAL_ACCESSORY_ONLY_NOISE: string[] = [
  "밴드만", "밴드 단품", "스트랩만", "스트랩 단품",
  "줄만", "워치줄만", "워치 스트랩만",
  "스포츠 ?루프", "sport ?loop",
  "버클만", "버클 단품",
];
```

### 3. DRONE_FILTER_ACCESSORY_NOISE 강화
배터리/렌즈/프로펠러/액세서리/마이크/스킨 단품 명시 키워드 추가. 주의: "프로펠러" 단독 차단 X (정상 본품 풀세트도 차단됨), "프로펠러만" / "프로펠러 단품" 만 매칭.

추가 키워드:
- 배터리: "배터리만", "배터리 단품", "배터리 판매(?!용)", "드론배터리", "battery only"
- 렌즈: "매크로 렌즈", "pov 렌즈", "렌즈 단품", "와이드 렌즈 단품", "어안 렌즈만"
- 프로펠러: "프롭만", "프로펠러만", "프로펠러 단품", "프롭 단품"
- 액세서리: "액세서리 4종", "액세서리 세트(?!포함)", "악세서리 모음"
- 기타: "마이크 단품", "스킨 스티커만", "슬링백만", "삼각대로드만", "배터리 핸들만"

### 4. clothing-polo-rrl mustNotContain
주얼리/액세서리 차단:
- "팔찌", "bracelet", "반지", "귀걸이", "earring"
- "주얼리", "jewelry", "터콰이즈", "turquoise"
- "네이티브 어메리칸", "나바호 팔찌", "나바호 반지", "나바호 액세서리"
- "커프", "cuff", "버클\\b"

### 5. clothing-tnf-supreme-collab mustNotContain
가방 패턴 추가:
- "데이팩", "daypack", "day pack"
- "메신저", "messenger"
- "더플", "duffle", "duffel"
- "크로스백", "crossbody"
- "트래블", "travel bag"

## 파일 변경

- `src/lib/catalog.ts` — UNIVERSAL_BUY_REQUEST_NOISE + UNIVERSAL_ACCESSORY_ONLY_NOISE 신설 + DRONE noise 강화 + Polo RRL/TNF Supreme collab mustNotContain

## 측정 (다음 cron)

- DJI/GoPro 매물 sku_id 재매칭 — 액세서리 단품 매물 sku_id=null 처리
- smartwatch 밴드 단품 매물 차단
- 시세 daily 재계산 (median 회복 — 60k 액세서리 빠지면 본품 가격으로 올라감)

## 미완 (다음 wave)

- 다른 카테고리 sample 더 (perfume / kickboard / lego / 작은 가전 / 헤어 기기)
- DJI 본품 매물 sample 검증 — false positive (정상 본품 차단됨) 확인
- broad SKU narrow split (RRL 액세서리 별도 → 이미 일부 narrow 박힘 but 더 정밀)
