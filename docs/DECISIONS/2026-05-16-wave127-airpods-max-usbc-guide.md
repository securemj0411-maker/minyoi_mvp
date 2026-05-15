# Wave 127 — AirPods Max USB-C 별도 model guide ("Max 2 = USB-C" 명시)

> 사용자 지적 (pid 384785809): "맥스2랑 맥스랑 같은거임? 이런건 써줘야 사용자가 잘 팔지". 매물 판단 정보 표시.

## 1. 진단
- 시간: 2026-05-16
- 발견: airpods-max-usbc 별도 model guide 없음. 사용자가 "Max 2 = USB-C 모델" 같은 정보 매물 카드에서 못 봄. pack reveal modal에 표시 정보 부족.

## 2. 변경
- 시간: 2026-05-16
- 변경: **[mvp/src/lib/model-guides.ts](mvp/src/lib/model-guides.ts)**
  - airpods-max guide confusion_points 추가: "Max 2 = USB-C 별칭", "Max 또는 맥스 1세대 = Lightning"
  - 신규 `guide:earphone:airpods-max-usbc` guide 박음:
    - title: "AirPods Max (USB-C) = 매물 \"Max 2\" 동일 모델"
    - quickFacts: ["USB-C 모델", "= 매물 \"Max 2\"", "Lightning 1세대와 분리"]
    - confusion_points: "맥스 2" 매물 정확히 USB-C, Apple 공식 "2세대" 표시 X but 매물 셀러 부름
    - resell_checkpoints: 새 색상 (스카이/오렌지/퍼플/스타라이트/미드나이트) = USB-C 거의 확정
  - airpods-max + airpods-max-usbc 모두 match.skuIds + comparableKeys 추가 (정확한 매칭)
- 검증: 139/139 test pass.

## 3. UX 효과
- pack reveal modal에서 사용자가 AirPods Max USB-C 매물 보면 guide panel에 "Max 2 = USB-C" 명확히 표시
- 사용자 판매 시 셀러에게 정확하게 설명 가능

## 4. 거론 금지
- 다른 모델도 동일한 명칭 혼동 가능 — 사용자 코멘트 보고 추가 (별도 wave).
- 운영자 풀 (admin-pool-browser)에는 model guide 표시 안 됨 — pack reveal modal만. UI 확장 별도.
