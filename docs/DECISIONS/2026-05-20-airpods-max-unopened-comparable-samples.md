# 2026-05-20 — AirPods Max 미개봉 비교 매물 누락 수정

## 배경
- `/me`/Explore 상세의 “시세 비교 매물” 섹션에서 AirPods Max 미개봉 ready 매물이 많은데도 `미개봉 비교 매물 누적 중`으로 표시됐다.
- 실제 DB에는 `airpods|airpods_max|usbc` + `condition_class='unopened'` 비교 후보가 충분히 존재했다.

## 결정
- 비교군 UI 제외 목록에서 `new_or_open_box`, `low_battery_health`를 제거했다.
- 두 신호는 이미 `condition_class='unopened'`, `condition_class='low_batt'`로 분리되는 상태 정의 신호다.
- 따라서 같은 상태끼리 비교하는 UI에서 다시 제외하면, 미개봉/배터리저하 비교군이 전부 사라지는 모순이 생긴다.

## 보류
- `full_set`, `applecare_premium` 등 프리미엄/구성 차이 신호는 그대로 비교군 UI 제외 목록에 둔다.
- AirPods Max의 `airpods_max` vs `airpods_max_usbc` comparable key 중복/분기 정리는 별도 parser/catalog 정합성 작업으로 보류한다.
