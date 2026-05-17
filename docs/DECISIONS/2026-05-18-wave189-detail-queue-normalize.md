# Wave 189 — detail_queue 진입률 normalize + 신모델 (2026-05-18)

## 배경

Wave 188 follow-up 완료 후, 신규 카테고리 (drone/garmin/lego/kickboard) 매물 분포 sweep 돌렸더니 충격적 결과:

```sql
SELECT bucket, raw_total, has_parsed FROM ...
-- kickboard  raw 119 → parsed 0
-- garmin     raw  76 → parsed 0
-- gopro      raw  62 → parsed 0
-- lego       raw  57 → parsed 1
-- osmo       raw   7 → parsed 0
```

raw_listings에는 321건 들어왔는데 **detail_queue 진입은 1/321** (0.3%).

`tick-pipeline.ts:845` 로직 분석:
```ts
const sku = titleOnly.sku ?? ruleMatch(item.name, "");
if (!sku) return { queue: false, reason: "title_unknown_sku", ... };
```
→ title-only ruleMatch가 catalog SKU 매칭 못 하면 detail_queue 진입 자체 차단.

## 매물 sample 분석

본품인데 ruleMatch 실패한 패턴 3종:

1. **공백 없는 표기**
   - "가민 피닉스7x판매합니다" — mustContain `["fenix 7x", "페닉스 7x", "피닉스 7x", "fenix7x"]` 모두 매칭 fail (한글 "피닉스7x" 변형 없음)

2. **축약 매물 (시리즈명 생략)**
   - "고프로 12 + 3웨이(그립/암/삼각대 기능)" — mustContain `["hero 12", "히어로 12"]` 매칭 fail ("12" 단독)
   - "가민 965 블랙 판매합니다" — mustContain `["forerunner 965", "포러너 965"]` 매칭 fail

3. **catalog gap (신모델 누락)**
   - "가민 포러너 970 (구성품o,박스o)" — Forerunner 970은 2025.05 출시, catalog에 없음

## 결정

3가지 layer 보강:

### 1. NORMALIZATIONS에 garmin/gopro 공백 정규화 추가

```ts
[/(피닉스|페닉스)\s*(7s|7x|7|8|6s|6x|6)/gi, " 페닉스 $2 "],
[/fenix\s*(7s|7x|7|8|6s|6x|6)/gi, " fenix $1 "],
[/(포러너|forerunner)\s*(\d{3})/gi, " $1 $2 "],
[/\bfr\s*(\d{3})/gi, " fr $1 "],
[/(고프로|gopro)\s*(9|10|11|12|13)(?!\d)/gi, " $1 히어로 $2 hero $2 "],
[/(고프로|gopro)\s*맥스/gi, " $1 맥스 max "],
```

핵심: GoPro 정규화는 시리즈명 단축 매물에서 "히어로/hero" 토큰을 inject — mustContain 매칭 가능하게.

### 2. garmin-forerunner-970 신모델 SKU 추가

```ts
{
  id: "garmin-forerunner-970",
  brand: "Garmin", category: "smartwatch", laneKey: "garmin_forerunner_970",
  modelName: "Garmin Forerunner 970",
  mustContain: [["garmin", "가민"], ["forerunner 970", "포러너 970", "fr 970", "fr970"]],
  mustNotContain: ["forerunner 245/255/.../965", "포러너 265/.../965", "fenix", ...],
  msrpKrw: 999000, released: 2025,
}
```

+ category-readiness `garmin_forerunner_970 → ready` 등록
+ option-parser `defaultWatchSizeMm` → 47mm 매핑
+ Forerunner 965 mustNotContain에 "forerunner 970" / "포러너 970" 격리

## 영향 범위 / 정책 정합성

- raw 321건 중 garmin/gopro 본품 매물 (대략 raw 30~40건) detail_queue 진입 가능.
- kickboard 119건은 대부분 샤오미 가전 (공기청정기/미박스/짐벌) — 본품 킥보드 거의 없음. 정상 skip 유지.
- lego 57건은 "그레고리 백팩" (그**레고**리 부분 매칭) / "엑박원 레고 게임" 등 noise. catalog mustContain "lego" + 모델 번호 결합이라 정상 skip.

§12b 정확성 우선 충족 — false positive risk 없음 (정규화는 본품에만 적용, mustNotContain 그대로).

## 다음 액션 (24h 후)

production sweep 재측정:
- garmin/gopro detail_queue 진입률 → 목표 >50%
- 신규 카테고리 매물 pool 진입 후 false positive rate 측정 (Wave 188 follow-up 패턴)

## commit

- `62809f8` Wave 189: detail_queue 진입률 — garmin/gopro normalize + 신모델 추가
