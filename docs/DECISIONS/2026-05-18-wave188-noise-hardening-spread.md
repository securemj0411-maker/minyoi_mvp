# Wave 188 후속: WAVE188_NEW_CATEGORY_NOISE 일관 spread

- 시간: 2026-05-18 KST
- commit: `132a23b`

## 발견

production DB sweep (Wave 188 internal test) 에서 신규 5개 카테고리 (drone/perfume/kickboard/lego/home_appliance 신규 SKU)
false positive rate ~50%. 주된 노이즈:

- "포토카드/굿즈/특전/박보검" — 아이돌 포카·굿즈 매물
- "다이슨 저렴이/짝퉁/이미테이션/lepin/카피/복제" — 가품
- "거치대/스탠드만/벽거치/케이스만/박스만" — 액세서리 단품
- "충전기만/어댑터만/케이블만/배터리만" — 부품 단품
- "필름만/보호 필름만" — 보호필름 단품

각 SKU 별로 noise 박는 게 누락되어 어디는 차단, 어디는 통과 — 일관성 없음.

## 변경

`src/lib/catalog.ts` 상단에 공통 상수 추가:

```ts
const WAVE188_NEW_CATEGORY_NOISE = [
  "포토카드", "포카", "특전", "굿즈", "한정 굿즈", "박보검",
  "휙", "다이슨 저렴이", "다이슨 짝퉁", "이미테이션", "정품 아님", "lepin", "카피", "복제",
  "거치대", "스탠드만", "벽거치", "케이스만", "정품 케이스", "박스만",
  "충전기만", "어댑터만", "케이블만", "배터리만",
  "필름만", "보호 필름만", "보호 필름 단품",
];
```

신규 카테고리 모든 SKU mustNotContain 끝에 `...WAVE188_NEW_CATEGORY_NOISE` spread:

| 카테고리 | 적용 SKU 수 | 주요 모델 |
|---|---:|---|
| home_appliance (헤어) | 9 | Dyson Supersonic HD08/Origin, Airwrap HS05/Origin, Corrale HS07, Cyaars Glampam/Magic Prov, Panasonic EH-NA0J/9C/98, BaByliss Pro 2174U |
| drone (DJI 드론) | 11 | Mini 2/3 Pro/4 Pro, Mavic 3/3 Pro/3 Classic, Air 2S/3/3S, Avata, Avata 2 |
| drone (DJI Osmo) | 8 | Osmo Action 3/4/5 Pro/6, Pocket 2/3/4, Osmo Nano |
| drone (GoPro) | 6 | Hero 9/10/11/12/13, Max |
| laptop (Galaxy Book) | 5 | Galaxy Book 4/4 Pro/4 Ultra/5/5 Pro |
| perfume | 22 | Jo Malone 5 + Le Labo 3 + Diptyque 3 + Tom Ford 4 + Replica 4 + Memo 3 |
| smartwatch (가민) | 10 | Fenix 7/7S/7X/8, Forerunner 265/955/965, Instinct 2, Venu 3, Epix Pro |
| lego | 12 | 75192 Falcon UCS + 75313 AT-AT + 75331 Razor Crest + 75355 X-Wing + 10297/10312/10326 Modular + 42143/42115 Technic + 21319/21338/21054 Ideas/Arch |
| kickboard | 9 | Xiaomi Mi Scooter Pro 2/3/4/4 Pro/4 Ultra + Ninebot Max G2/F40/F30/E45 |
| **합계** | **92** | — |

추가로 일부 SKU mustContain 강화:

- `dyson-corrale-hs07`: 본체/본품/풀세트/무선 고데기/고데기 (액세서리 단품 reject)
- `dyson-airwrap-hs05`: 본체/본품/풀세트/컴플리트/complete/멀티스타일러/스타일러
- `dyson-supersonic-hd08`: 헤어드라이어/드라이어/본체/본품/풀세트/hd08/hd15
- 향수 22개 mustNotContain 에 "테스터/tester/방향제/디퓨저/디스커버리/discovery" 추가

## 검증

```
npx tsc --noEmit
  → catalog.ts/option-parser.ts/sku-base-options.ts/category-readiness.ts/pipeline-config.ts 에러 0
  (다른 test 파일들의 pre-existing Sku type 에러는 무관)

npm run test:core
  → 438 tests / 434 pass / 4 fail
  → fail 4건은 모두 pre-existing (pack-open-race 3건 + wave159h 1건). 이번 변경 무관.
  → Wave 182~188 fixture (drone 22, perfume 22, lego 12, kickboard 9, garmin 10, galaxy-book 5, hair appliance 9) 다 통과
```

## 위험

- recall 일부 손해 예상 (예: "본품 + 거치대 포함" 매물의 거치대 토큰 hit → reject).
  - §12b 정확도 우선 원칙으로 OK. AI L2 fallback이 broad recall 담당.
- WAVE188_NEW_CATEGORY_NOISE 상수는 신규 카테고리 한정. 기존 (smartphone/tablet/laptop core) 적용 X — 기존은 카테고리별 noise map 별도 박혀있음.
- 추가 토큰 (예: "한정 굿즈") 이 catalog 정상 매물 명에 등장하면 self-block 가능성. spot check 권고.

## 다음

- production 24h 후 false positive rate 재측정. 50% → 10% 이하 목표.
- 만약 recall 손해가 너무 큰 SKU 발견 시 mustContain 화이트리스트 추가 또는 noise 토큰 SKU별 제외.
- 신규 SKU 추가 시 default 로 WAVE188_NEW_CATEGORY_NOISE spread 박는 게 기본 패턴.
