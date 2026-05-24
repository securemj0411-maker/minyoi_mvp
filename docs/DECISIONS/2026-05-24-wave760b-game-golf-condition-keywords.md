# Wave 760b — 게임 / 골프 condition keyword 보강 (option-parser v55 → v56)

**날짜**: 2026-05-24
**Wave**: 760b (Wave 760 후속)
**Owner**: Claude

## 결정 사항

Wave 760 sweep 결과 (10,628 골프 매물 + 1,800+ 게임 매물 분석) 기반으로 conditionFromText 에 게임/골프 특화 condition signal 추가.

기존: 게임/골프 매물은 일반 condition keyword (사용감/기스/하자 등) 만 잡혀 시세 grading 정밀도 낮음.

### 게임 (game_console) — 5개 signal

| Signal | 효과 | Trigger |
|---|---|---|
| `game_cart_only_no_box` | -0.10 | "카트만/타이틀만/디스크만/박스 없음" (박스/케이스 negation 시 skip) |
| `game_label_or_disc_damage` | -0.20 | "라벨 찢/까짐, 디스크 깨/금/리딩 불량" (없음 negation 지원) |
| `game_limited_edition` | +0.05 | "초회 한정판/스틸북/콜렉터스 에디션/특전 박스" |
| `game_dlc_used` / `game_dlc_unused` | -0.05 / +0.03 | "DLC 코드 사용함" / "DLC 미사용/그대로" |
| `game_factory_sealed` | +0.08 | "박스/패키지/카트리지 미개봉, 시일/봉인 살아 있" |

### 골프 (sport_golf) — 8개 signal

| Signal | 효과 | Trigger |
|---|---|---|
| `golf_grip_new` / `golf_grip_worn` | +0.05 / -0.08 | "그립 새것/교체" vs "그립 마모/닳/미끄러" |
| `golf_face_clean` / `golf_face_worn` | +0.03 / -0.15 | "페이스 깨끗, 스코어라인 살아" vs "페이스 마모/움푹 패" |
| `golf_head_paint_damage` | -0.12 | "헤드/크라운/페이스 도장 벗/페인트 벗/많이 까짐" |
| `golf_shaft_damage` | -0.25 + `repair_or_defect_signal` | "샤프트 굽/휘/크랙/갈라" (없음 negation 지원) |
| `golf_rounding_few` / `golf_rounding_many` | +0.05 / -0.08 | 라운딩 N회 (≤5 / ≥50) |
| `golf_unused_new` | +0.08 | "시타 안 함/박스 미개봉/라운딩 0회" |
| `golf_full_set_bundle` | +0.03 | "풀세트/캐디백 포함/골프백 포함" |

## 측정 / 검증

`/tmp/wave760-condition-test.ts` — 13 case 100% pass:
- 게임 5: 카트만, 디스크 깨짐, 한정판, DLC, 박스 미개봉
- 골프 8: 그립 (new/worn), 페이스 마모, 헤드 도장, 샤프트 굽음, 라운딩 3회, 박스 미개봉, 풀세트
- Negation: "박스 포함" → game_cart_only_no_box 차단 확인

## Parser version bump

`option-parser-v55` → `option-parser-v56`. drift gate trigger → 게임/골프 매물 자동 reparse 큐 박힘.

## 영향

- 게임 카트리지 시세 grading 정밀도 향상 (mint/clean/worn 분리 의미 있음)
- 골프 narrow split SKU (Wave 760 18개) 와 결합 → spread 95~30% 감소 예상 (sub-model × condition tier 격리 효과)
- repair_or_defect_signal piggy-back: 샤프트 손상 → FLAWED 분류 (Wave 209 정책 호환)

## 미해결

- 게임/골프 condition test case 추가 필요 (자동 regression). 현재는 임시 script
- "스틸북" / "한정판" 단어가 일반 매물 false positive 위험 — sample audit 후 negation 추가 가능
- 골프 라운딩 횟수 추출 패턴 변형 (필드 N회 / 라운드 N회 / 라운딩 N회) — 변형 추가 가능

## 관련 commit

- `2cb5f25`: Wave 760 게임 카트리지 100+ SKU + 골프 narrow 18 SKU + 커버 substring fix
- 본 commit: Wave 760b option-parser v56 — 게임/골프 condition keyword 보강 (13 case test pass)
