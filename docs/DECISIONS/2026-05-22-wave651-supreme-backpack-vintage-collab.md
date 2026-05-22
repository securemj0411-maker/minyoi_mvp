# Wave 651 — Supreme Backpack 빈티지/Collab outlier 차단 (bag v20→v21)

## 발견

sample audit (`supreme_backpack_broad` spread 5.8x outlier):

| pid | name | price | comparable_key |
|-----|------|-------|---------------|
| 404980509 | FW2011 슈프림 박스로그 다미에 코듀라 백팩 | 550,000 | `bag\|supreme_backpack_broad\|backpack\|era_unknown\|unknown_size_variant\|b_grade` |
| 380716061 | 슈프림 x B.B. 사이먼 BB 사이먼 데님 백팩 블랙 - 25SS | 550,000 | `bag\|supreme_backpack_broad\|backpack\|era_unknown\|bb` |
| 396906080 | 슈프림 비비사이먼 B.B사이먼 백팩 우드랜드 카모 | 500,000 | `bag\|supreme_backpack_broad\|backpack\|era_unknown\|unknown_size_variant\|b_grade` |

일반 supreme backpack 시세 = 24~28만, broad b_grade는 9~13만 → outlier 4배 차이.

## 조치

1. **catalog**: `bag-supreme-backpack` SKU mustNotContain 확장.
   - `fw2000`~`fw2011`, `ss2005`~`ss2010` 빈티지 표기
   - `다미에` / `damier` (다미에 코듀라 패턴)
   - `bb 사이먼` / `b.b 사이먼` / `비비사이먼` / `bb simon` 등 collab 변형
   - `바운티 헌터` / `bounty hunter` collab
2. **parser**: `wave92-bag-v20` → `v21` bump.
3. **tick-pipeline**: `LATEST_PARSER_VERSION_BY_CATEGORY.bag` → `v21`.
4. **invalidate**: 2 comparable_keys (broad b_grade + bb variant) priority 90~95 reparse 큐.

## 부수 fix

`clothing-stussy-basic-tee` mustNotContain 닫는 `]]` 중복 제거 (이전 세션 syntax error).

## Why

spread audit이 단순 IQR 계산 외에 collab/빈티지를 본 SKU broad에 흘려보내면 시세 신뢰 떨어짐. 일반 Supreme backpack과 빈티지/collab은 가격대가 별개 시장 (4~5배 차).

## How to apply

신규 outlier 감지 시 모델명 + 시즌 표기 + 협업 브랜드명 모두 mustNotContain에 명시. 빈티지는 시즌년도 (fw20xx/ss20xx) 키워드 범위 차단이 효과적.
