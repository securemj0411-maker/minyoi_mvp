# Wave 718 + 719 — 광고 셀러 차단 강화 + 카테고리별 outlier max price

**Date**: 2026-05-23
**Trigger**: 사용자 자율 진행 위임. Wave 717 pool sample audit에서 발견한 광고 셀러 + 전자기기 outlier issue 후속.

## Wave 718 — 광고/리테일 셀러 차단 (12 패턴 추가)

### 발견 sample (Wave 717 audit)

- **럭셔리 리테일 셀러 시그니처** (개인 c2c 아님):
  - shoe-hermes-broad 에르메스 제트 스니커즈 170만 + 에르메스 오즈 뮬 156만
  - bag-gucci-broad 140만 "-당일발송- 풀구성"
  - "*실재고 보유중*" + "성별/상품명/사이즈/구성품/매장가" 표 + 컨디션 N/S+/S/A/B/C 등급표 + "가품일시 200% 보상"

- **개인 대량 셀러** (전화번호 우회 + 안전거래 거부):
  - macbook-pro 5건 동일 desc
  - ipad-pro M5 4건 동일 desc
  - "안전거래 불가" / "이상한 쇼핑몰 포인트" / "공1공 4-3-3-9" 전화번호

### Fix

`candidate-pool-builder.ts` AD_PATTERNS 12개 추가:
1. `/\*\s*실재고\s*보유중/` — 실재고 보유중 (별표 강조)
2. `/\*\s*모든제품\s*퀵\s*가능/` — 모든제품 퀵 가능
3. `/매장가\s*[:：]\s*\d{2,3}\s*만/` — 매장가 표기
4. `/N\s*[:：]\s*새상품.{0,40}S\+\s*[:：]/` — 컨디션 등급표
5. `/제품\s*컨디션\s*기준표/` — *제품 컨디션 기준표*
6. `/가품일?\s*시.{0,10}(200|1000|10000)\s*%\s*(?:보상|배상|환불)/` — 200%/1000% 보상
7. `/안전\s*(?:거래|결제)\s*불가/` — 안전거래 불가
8. `/얼굴\s*보고\s*직거래만/` — 얼굴보고 직거래만
9. `/이상한\s*쇼핑몰\s*포인트/` — 이상한 쇼핑몰 포인트
10. `/공\s*[01]\s*공\s+\d-\d-\d-\d/` — 전화번호 우회 표기
11. `/-?\s*성별\s*[:：].{0,40}-?\s*상품명\s*[:：]/` — 명품 표 형식
12. `/-?\s*구성품\s*[:：].{0,40}-?\s*매장가\s*[:：]/` — 명품 표 형식

거짓 양성 risk 낮음 — 정상 c2c 매물은 "구매후 실착 N회" / "보관위주" / "오케이몰 구매" 같은 표현 사용.

**commit**: `8a092f8`

## Wave 719 — Task #25 카테고리별 outlier max price

### 발견 데이터

```
sku_id                  | p50      | p95      | MAX        | 비고
ipad-pro                | 92.7만   | 210만    | 4억5천5백만 | 4500x sentinel
galaxy-z-fold-4         | 38만     | 56만     | 1억        | 263x sentinel
ipad-air                | 58만     | 105만    | 1억        | 172x sentinel
iphone-14-pro           | 60만     | 73만     | 9천만       | 150x sentinel
iphone-16-pro           | 101만    | 137만    | 1.1억      | 111x sentinel
macbook-pro             | 170만    | 459만    | 2200만      | 13x outlier
macbook-air             | 95만     | 194만    | 1750만      | 18x outlier
airpods-max             | 34만     | 68만     | 700만       | 21x outlier
iphone-15-pro-max       | 107만    | 145만    | 1600만      | 15x outlier
```

### 문제

1억 미만이지만 정상 시세 5-10배 outlier가 시세 median 부풀림 → priceGap 왜곡 → 정상 매물 점수 낮아짐.

### Fix

`tick-pipeline.ts` 신설:
- `SKU_PREFIX_MAX_KRW` 테이블 (prefix → 합리적 max KRW)
- `isPriceOutlierForSku(price, skuId)` 함수

prefix 매핑:
| prefix | cap | 비고 |
|---|---|---|
| iphone-16-pro-max | 400만 | 정상 ~330만 |
| iphone-17 | 400만 | 최신 |
| iphone-15 | 250만 | |
| galaxy-z-fold | 500만 | 폴더블 |
| galaxy-s2[5-9] | 350만 | |
| ipad-pro | 500만 | |
| ipad-air | 300만 | |
| macbook-pro | 1200만 | M3 Max 800만 + 50% |
| macbook-air | 400만 | |
| applewatch-ultra | 250만 | |
| airpods-max | 120만 | |
| airpods-pro | 60만 | |
| bag-hermes | 8000만 | 정품 5천~8천만 정상 |
| bag-chanel | 3000만 | 정품 명품 |
| bag-lv | 2000만 | |
| clothing-polo-purple-label | 500만 | |
| clothing-/shoe-/일반 | 300만 | |

### 적용 위치 (3곳)

1. Line 3648 — 시세 median aggregation (outlier 제외)
2. Line 5742 — Score-stage fallback sample (outlier 제외)
3. Line 5907 — Score gap calculation (placeholder 처리)

### 효과

- iphone 1억 / ipad 4.5억 / macbook 22M outlier 모두 차단
- 시세 median 정확도 ↑
- 정상 매물 priceGap 회복

**commit**: `2574f03`

## 관련 commit
- `8a092f8` — Wave 718 광고/리테일 셀러 차단 12 패턴
- `2574f03` — Wave 719 카테고리별 outlier max price + isPriceOutlierForSku

## 다음
- Wave 720 신발 condition grading 10K deep sweep (agent 진행 중)
- Wave 715/716 reparse 결과 24-48h 후 spread 재측정
