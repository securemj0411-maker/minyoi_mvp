# Wave 656 — Stussy Basic Tee 도시 한정/Collab 차단 (clothing v28→v29)

## 발견

`clothing|stussy_basic_tee|tee|a_grade` (71건, spread 8.25x).

| pid | name | price |
|-----|------|-------|
| 190209629 | [M] 스투시 X DSM 월드투어 화이트 반팔티 | 165,000 |
| 280516562 | 스투시 월드투어 반팔 티셔츠 | 155,000 |
| 261242361 | 스투시 stussy x 갱스타 gang starr 티셔츠 XL 화이트 | 150,000 |
| 376976244 | 스투시 돌리 블러쉬핑크 티셔츠 S | 139,000 |
| 409157316 | 스투시 오사카 반팔 티셔츠 화이트 | 120,000 |
| 337137289 | Stussy Pigment Dyed SS Thermal tee tan | 120,000 |
| 409157511 | 스투시티셔츠 월드투어 썬 페이디드 브라운 L사이즈 | 120,000 |
| 345584563 | 스투시 X 도버스트릿 마켓 선셋 화이트 반팔 티셔츠 | 119,000 |
| 357146478 | 스투시 마틴로즈 반팔 티셔츠 L사이즈 | 115,000 |
| 339574891 | 스투시 아워레가시 반팔티팝니다 | 110,000 |

일반 a_grade = 25~50k → outlier 3~7배.

## 조치

추가 차단어:
- `월드투어` (단독 — Wave 631 강화에도 variant 통과)
- `갱스타` / `gang starr` (랩 그룹 collab)
- `돌리` / `dolly` / `블러쉬 핑크` (한정 컬러)
- 도시 한정: `오사카` / `도쿄` / `파리` / `런던` / `뉴욕` / `osaka` / `tokyo`
- `도버스트릿` / `DSM` / `dover street` (Dover Street Market collab)
- `마틴로즈` / `martine rose` (collab)
- `써멀` / `thermal` (별도 라인)
- `썬 페이디드` / `sun faded` (한정 컬러)
- `our legacy` (Wave 596 강화에도 매물 통과 — 변형 추가)

parser v28 → v29 + invalidate.

## Why

Stussy Basic Tee는 일반 라인 vs 한정 drop vs 도시 collab 가격대 5~7배 차. mustContain 단어 변형이 무수 → mustNotContain 차단 라인 별 명시.

## How to apply

도시명 (오사카/도쿄/파리/런던/뉴욕)은 stussy chapter store 한정. 일반 tee SKU에 광역 차단 — 다른 brand에는 적용 X (도시명 단독은 광범위).
