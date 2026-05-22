# Wave 653 — 가품 거래 코드 워딩 글로벌 차단 (clothing v25→v26)

## 발견

**pid 408135119 "아크테릭스 베타SL" 130k** — `arcteryx_beta s_grade` (정상 시세 65~95만)에 매물 1건 floor outlier.

description_preview: **"저렴하게 판매해요 / 느낌 아시니깐 연락주세요"**

= 정확히 가품 거래 코드 워딩. 정상가 130k는 Beta SL 시세 1/6 → fake.

## 원인

`ruleMatch` 동작:
- title `"아크테릭스 베타SL"` 만으로 `arcteryx_beta` SKU 매칭 통과 (mustContain 만족 + mustNotContain 없음).
- description의 "느낌 아시" / "저렴하게" 등 가품 표지는 `combined` path에만 적용 — narrow lane veto 없으면 검사 skip.

GLOBAL_FASHION_NOISE에 "느낌" 단독은 있지만 substring collision 보호로 `(?:빈티지한|좋은|멋진|이쁜|예쁜)\s*느낌` skip → "느낌 아시" 명시 패턴 누락.

## 조치

1. **catalog.ts GLOBAL_FASHION_NOISE**: 가품 거래 코드 워딩 추가
   - `느낌 아시`, `느낌아시`, `느낌 알`, `느낌알`, `느낌 오시`, `느낌오시`
   - `저렴하게 판매`, `저렴하게드려요`, `저렴하게 드려요`
   - `오시면 압니다`, `와서 보시면`, `사진 보시면`, `사진보시면`
2. **catalog-wave266-clothing.ts CLOTHING_COMMON_NOISE**: 동일 패턴 + "비매품"/"샘플품"/"직원샘플"
3. **parser**: `wave216-clothing-v25` → `v26`.
4. **tick-pipeline**: `clothing` → `v26`.
5. **invalidate**: arcteryx_beta s_grade comparable_key priority 95~100.

## Why

가품 판매자는 title을 정상 SKU 매칭되도록 깨끗하게 박고 description에 "느낌 아시" 등 코드 워딩으로 짝퉁 협의. ruleMatch title-only path는 SKU 매칭 통과 → 시세에 가품 가격 흘러들어옴.

GLOBAL_FASHION_NOISE는 combined match path에서도 작동 (Wave 230 적용)하지만 "느낌 아시" 명시 안 되어 있어서 통과됐음.

## How to apply

다른 SKU에서 floor outlier 발견 시 매물 description에 가품 거래 코드 워딩 있는지 확인 → 글로벌 noise에 명시 패턴 추가. 단독 "느낌" 같은 광범위 키워드는 substring collision 위험이라 명시 패턴 (앞뒤 컨텍스트 포함)으로만.

가품 floor detection은 별도 시세 산정 layer (IQR/Z-score outlier 제외)에서도 보강 필요 — Task #25 (전자기기 가격 outlier sanity check) 패턴 fashion 확장.
