# 2026-05-16 코멘트 #110 — AirPods Pro 2 connector 명시 강제

## 발견

- 사용자 코멘트 (id 110, pid 405718588): "에어팟 프로 2세대 8핀" 매물의 비교군에 명시 안 된 매물 ("에어팟 프로2 풀박스" 등) 이 lightning sku 로 분류돼 같이 비교됨. 사용자: "정가가 8핀이랑 c타입이랑 다르면 구분 되야".
- 진단:
  - catalog `airpods-pro-2-usbc`: mustContain 에 connector 명시 (`["usb-c", "c타입", ...]`) ✅
  - catalog `airpods-pro-2-lightning`: mustContain 에 **connector 명시 없음** ❌ → 명시 안 된 매물도 모두 lightning 으로 default 분류 = LAUNCH_PLAN 12b "추정 fallback 금지" 위배
  - DB 측정: "에어팟 프로2 풀박스" (명시 X) → sku=lightning 매물 다수 (이전 분포에서 lightning sku 가 비정상적으로 많음)

## 변경

- `src/lib/catalog.ts:3753~3766` `airpods-pro-2-lightning` mustContain 에 connector 명시 그룹 추가:
  - `["라이트닝", "lightning", "8핀", "8 핀", "팔핀", "팔 핀", "a2096"]`
- usbc sku 와 대칭 — 명시 매물만 lightning sku 박힘. 명시 X 매물은 sku=null (broad airpods-pro fallback 또는 unknown).

## 검증

- `npm run test:core` 139/139 pass.
- 전체 reclassify (21,178 매물 batch loop) — 약 7,400 reclassified.
- AirPods Pro 2 분포 fix 후:
  | sku_id | cnt | 의미 |
  |---|---|---|
  | airpods-pro-2-usbc | 217 | 명시 매물 (정확) |
  | airpods-pro-2-lightning | **132** | 명시 매물 (이전 default 가정 매물 빠짐) |
  | null | **591** | 명시 X 매물 (정확하게 unknown 유지) |
- 591 매물 = 시세 sample 안 들어감 → lightning 시세 왜곡 제거.

## 위험

- recall 손해 — 591 매물 sku=null = 풀 진입 X, 시세 sample X. 단 LAUNCH_PLAN 12b "정확성 절대 우선" 정합. recall 은 AI L2 영역.
- airpods-pro broad SKU 가 별도로 있으면 이 591 매물이 broad 로 매칭 가능 (확인 필요).

## 다음

- broad airpods-pro SKU 매칭 동작 확인 (별 작업).
- 다른 connector 분리 SKU 도 같은 패턴 검토 (airpods-max lightning vs USB-C 등). 이미 default 매핑 박힌 걸 확인 필요.
