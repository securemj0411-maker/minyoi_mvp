# Wave 885 - broad SKU modelName 부속 설명 → comparable_key 누출 fix

## 발견 경위

Wave 884 master log 이후 후속 deepsweep 작업 — pool snapshot + comparable_key 분포 확인 중 발견.

```sql
SELECT comparable_key, COUNT(*) FROM mvp_listing_parsed
WHERE comparable_key ~ '[가-힣]'
   OR length(comparable_key) - length(replace(comparable_key, '_', '')) > 6
GROUP BY 1 ORDER BY 2 DESC LIMIT 30;
```

가장 심각한 케이스:

| comparable_key | 영향 row | 비고 |
| --- | ---: | --- |
| `seiko\|seiko_broad_narrow_미박힘_catch_all` | 486 | 한글 "미박힘" placeholder 그대로 사용자 노출 |
| `seiko\|seiko_prospex_broad_diver_turtle_alpinist_speedtimer` | 141 | narrow lane 나열이 토큰화 |
| `seiko\|seiko_5_broad_srpd_sbsa_외` | 51 | "외" 한글 토큰 |
| `sport_golf\|callaway_driver_broad_paradym_rogue_epic_mavrik_ai_smoke` | 128 (50+43+35, loft 포함) | 모델 5개 나열 |
| `sport_golf\|taylormade_wedge_broad_milled_grind_mg3_mg4` | 33 | 동일 |
| `sport_golf\|vokey_sm_wedge_broad_sm7_sm8_sm9_sm10` | 78 | 동일 |
| `sport_golf\|odyssey_putter_broad_white_hot_stroke_lab_two_ball_versa` | 68 | 동일 |
| `sport_golf\|taylormade_driver_broad_r7_m_sim_stealth_qi10` | 33 | 동일 |
| `home_appliance\|dyson_airwrap_i_d_hs08_co_anda_2x` | 104 | `(HS08, Co-anda 2x)` paren 누출 |
| `home_appliance\|dyson_v8_v10_v11_무선_청소기_구형_broad` | 69 | 한글 + slash 모델 나열 |

총 영향 row: **약 1,194 pid** (parsed) / 48 pool / 17 ready.

## 원인

`src/lib/option-parser.ts` 의 `modelFromSku` fallback:

```ts
return name || id || null;
```

여기서 `name = slug(skuName)`. 위 SKU 들은 explicit ID mapping 이 없어 fallback 진입.
catalog `modelName` 필드의 부속 설명 (paren / em-dash / slash 나열) 이 `slug()` 의해 모두 underscore 로 변환되어 그대로 comparable_key 에 박힘.

예시:
- `"Seiko (broad — narrow 미박힘 catch-all)"` → slug → `"seiko_broad_narrow_미박힘_catch_all"`
- `"TaylorMade Driver (broad — R7/M/SIM/Stealth/Qi10)"` → slug → `"taylormade_driver_broad_r7_m_sim_stealth_qi10"`

## 수정

### `src/lib/option-parser.ts`

1. **`PARSER_VERSION` v61 → v62** — drift gate trigger 로 영향 rows reparse 자동 처리.
2. **`cleanCatalogName(value)` helper 추가** — paren `(...)`, em-dash `—`, en-dash `–`, slash-모델 나열 (`/V10`) 떼어내기.
3. **`modelFromSku` fallback** 가 `cleanCatalogName(skuName)` 결과를 slug 처리.

```ts
function cleanCatalogName(value) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/—.*$/, " ")
    .replace(/–.*$/, " ")
    .replace(/\/\s*[A-Za-z0-9가-힣\-+_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

기존 explicit ID mapping (iPad/AirPods/Garmin/Seiko narrow/Casio narrow 등) 은 fallback 진입 X → 영향 0.

## 검증

### 신규 regression test: `tests/wave885-broad-modelname-cleanup.test.ts`
- PARSER_VERSION bump 확인.
- Seiko broad / Seiko 5 broad / TaylorMade Driver broad / Dyson Airwrap broad 4개 케이스 comparable_key 정리 확인.

### 기존 test 무영향
- `tests/fashion-catalog-regression.test.ts` 81/81 통과.
- `tests/cross-category-deepsweep-regression.test.ts` 3/3 통과.
- `tests/fashion-parser-version-sync.test.ts` 통과 (tick-pipeline 의 17개 non-fashion category 가 OPTION_PARSER_VERSION constant 참조 — 자동 sync).

## DB 후속

```sql
UPDATE mvp_raw_listings SET score_dirty = true
WHERE pid IN (
  SELECT pid FROM mvp_listing_parsed
  WHERE comparable_key IN (위 깨진 12 key)
);
-- 1,194 rows updated
```

Score 재계산 prime — parser drift gate 가 v61 → v62 reparse 처리 후 score worker 가 새 clean comparable_key 로 expected_profit 재계산.

## 영향 예상

- **사용자 노출 정리**: "미박힘" 한글 placeholder, "외" 한글 토큰, 긴 모델 나열이 비교 매물 그룹 키에서 사라짐.
- **시세 정확도**: narrow lane 별로 분산되어 있던 broad sample 들이 단일 broad key 로 통합 → median 안정성 ↑.
- **parser drift load**: option-parser v61 → v62. tick-pipeline 의 17 non-fashion 카테고리 모두 영향 → 약 33K rows reparse 대기 (drift gate 가 점진 처리).

## What Not To Do

- catalog `modelName` 필드를 lookup 으로 강제 단축 X — 필드는 admin 페이지/UI 표시 용도. parser 만 cleanCatalogName 으로 정리.
- explicit ID mapping (예: `if (id === "watch_seiko_broad") return "seiko_broad"`) 30~50 개 일일이 박는 방식 X — systemic cleanCatalogName 적용이 future SKU 도 자동 보호.

## 후속 (다음 wave 검토)

- 24h 후 drift gate 진행률 확인 (parser_version v62 count).
- ready pool 의 seiko/golf/dyson 카테고리 expected_profit 재계산 확인.
- option-parser v62 기준 deepsweep 재실행 (cross-category-db-deep-sweep).
