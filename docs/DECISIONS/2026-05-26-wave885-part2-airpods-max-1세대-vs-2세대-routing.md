# Wave 885 Part 2 - AirPods Max Lightning 1세대 vs USB-C 1세대 vs 2세대 routing 정정

## 발견 경위

Wave 885 part 1 후 deepsweep 중 발견 — `mvp_candidate_pool` 의 airpods_max ready 매물 21건 audit 시 같은 comparable_key 에 1세대 ↔ 2세대 매물이 섞임:

```
comparable_key="airpods|airpods_max|usbc" (12 ready):
  - 에어팟 맥스 스타라이트 (1세대 USB-C 2024 컬러) — 350K
  - 에어팟 맥스2 미드나이트 2026 (2세대) — 540K
  - 에어팟맥스 2세대 c핀 — 350K
  - 2026 에어팟맥스2 단순개봉급 (2세대) — 660K
  - 2026 에어팟맥스2 미개봉 (2세대) — 700-720K
  - 애플 에어팟 맥스 1 2024년형 블랙 (USB-C 1세대) — 400K
```

`expected_profit_min` CV = 88% (avg 70K, stddev 62K) — 시세 noise 가 매물별 200%+ 차이.

## 원인

기존 catalog:

```ts
{
  id: "airpods-max", // Lightning 1세대
  mustContain: [["에어팟", "airpods"], ["맥스", "max"]],
  mustNotContain: ["usb-c", "usbc", "c타입", "타입c"], // explicit "USB-C" 만 차단
},
{
  id: "airpods-max-usbc", // USB-C 1세대 (2024)
  mustContain: [..., ["usb-c", "usbc", "c타입", "타입c", "씨타입"]], // explicit "USB-C" 필요
},
```

매물이 explicit "USB-C" / "c타입" 안 쓰고 색상만 표기 (예: "스타라이트") 하면:
1. `airpods-max-usbc` 매칭 fail (mustContain 에 "usb-c" 없음).
2. `airpods-max` 매칭 success (mustNotContain 에 "스타라이트" 없음).
3. → 1세대 Lightning catalog 으로 routed.

But parser `parseAirpodsMaxGeneration` 은 색상/연도/세대 signal 보고 `airpodsMaxGeneration` 을 `max_usbc` 로 결정. `airpodsConnector` 도 `usbc` 결정.

결과: `comparable_key=airpods|airpods_max|usbc` (SKU model="airpods_max" Lightning + connector="usbc"). 1세대 USB-C ↔ 2세대 USB-C ↔ Lightning 매물 모두 한 키 mixing.

## 수정

### `src/lib/catalog.ts`

**`airpods-max` mustNotContain 강화** — 2024+ 시그널 자동 차단:

```ts
mustNotContain: [
  "usb-c", "usbc", "c타입", "타입c", "씨타입", "c핀", "c 핀",
  // 2024+ USB-C 시그니처 컬러 (Lightning 1세대엔 없음)
  "스타라이트", "starlight", "미드나이트", "midnight", "퍼플", "purple", "오렌지", "orange",
  // 2세대 / Max 2 패턴
  "맥스 2", "맥스2", "max 2", "max2", "2세대", "2 세대",
  // 출시연도 (2024+)
  "2024", "2025", "2026",
],
```

**`airpods-max-usbc` mustContain Group 3 확장** — explicit "USB-C" 외에 색상/세대/연도 시그널로 매칭:

```ts
mustContain: [
  ["에어팟", "airpods"],
  ["맥스", "max"],
  [
    "usb-c", "usbc", "c타입", "타입c", "씨타입", "c핀", "c 핀",
    "스타라이트", "starlight", "미드나이트", "midnight", "퍼플", "purple", "오렌지", "orange",
    "맥스 2", "맥스2", "max 2", "max2", "2세대", "2 세대",
    "2024", "2025", "2026",
  ],
],
mustNotContain: ["라이트닝", "lightning", "8핀", "8 핀", "팔핀", ...HEADPHONE_NOISE],
```

## 검증

Routing 정확성 — 8 cases 모두 expected:

| Title | Expected | Got |
| --- | --- | --- |
| 에어팟 맥스 스타라이트 | airpods-max-usbc | ✓ |
| 에어팟맥스 미드나이트 새상품 | airpods-max-usbc | ✓ |
| 에어팟 맥스 퍼플 USB-C | airpods-max-usbc | ✓ |
| 에어팟 맥스2 미드나이트 2026 | airpods-max-usbc | ✓ |
| 애플 에어팟맥스 2세대 c핀 | airpods-max-usbc | ✓ |
| 애플 에어팟 맥스 1 2024년형 블랙 | airpods-max-usbc | ✓ |
| 에어팟 맥스 스페이스 그레이 8핀 | airpods-max | ✓ |
| SS급) 에어팟맥스 8핀 | airpods-max | ✓ |
| 에어팟 맥스 (1세대) 실버 | airpods-max | ✓ |

Regression test `tests/wave885-broad-modelname-cleanup.test.ts` 에 3개 새 test 추가:
- Lightning 1세대 (8핀/실버/1세대) → `airpods-max`
- 2024+ USB-C 신컬러 → `airpods-max-usbc`
- 2세대 / 맥스2 / 2026 → `airpods-max-usbc`

## DB 후속

```sql
UPDATE mvp_raw_listings SET score_dirty = true
WHERE pid IN (
  SELECT pid FROM mvp_listing_parsed
  WHERE comparable_key IN (
    'airpods|airpods_max|usbc',
    'airpods|airpods_max|lightning',
    'airpods|airpods_max_usbc|usbc'
  )
);
-- 1,023 rows updated
```

Parser drift gate 가 v61 → v62 reparse 시 신 catalog routing 으로 정정 → score worker 가 새 comparable_key 로 expected_profit 재계산.

## 영향 예상

- **시세 분리**: 1세대 Lightning (200-240K) ↔ 1세대 USB-C (310-370K) ↔ 2세대 (540-720K) 매물이 각 lane 별로 분리 → median 정확성 ↑.
- **사용자 신뢰도**: "에어팟 맥스" 비교 매물 클러스터가 동일 세대만 보여줘서 가격 비교 신뢰성 ↑.
- **expected_profit CV 88% → 예상 30% 이하** (1세대 ↔ 2세대 mixing 제거).

## 후속

- 24h 후 ready pool 재집계 — `airpods|airpods_max|usbc` 클러스터 소멸 확인.
- `airpods-max-2` 별도 SKU 신설 검토 (2026 출시 2세대를 USB-C 1세대 (2024) 와 분리). 현재는 둘 다 `airpods-max-usbc` 로 묶임.

## What Not To Do

- 색상 시그널 (스타라이트/미드나이트/퍼플) 을 "USB-C 동등" 으로 hard-code X. Apple 이 향후 USB-C 1세대에서 신컬러 추가하면 매칭 broken. catalog 변경 시 함께 갱신.
- mustNotContain 에 "1세대" 추가 X — Lightning matters 중 "1세대" 명시한 것은 정확히 airpods-max 으로 가야 함.
