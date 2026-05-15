# Wave 128 — Sku.confusionNote field 추가 + 주요 혼동 SKU 14개 박음

> 사용자 명령: "모든 ready sku, lane 혼동 가능성 다 찾아". 매물 판단 친화 정보 표시.

## 1. type 확장
- 시간: 2026-05-16
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** Sku type:
  ```typescript
  // 사용자 친화 혼동 주의 메모.
  // pack reveal modal / admin pool / 추천 카드에 표시 (셀러에게 정확히 설명 도움).
  confusionNote?: string;
  ```

## 2. 추가된 confusionNote (14개)
- 시간: 2026-05-16
- 변경: 주요 혼동 SKU에 1~2줄 짧은 메모:
  - airpods-max / airpods-max-usbc: "Max 2 = USB-C 별칭"
  - airpods-pro-2-lightning / -usbc / -3: 커넥터/세대 명시
  - airpods-4-anc: 일반 4와 별도 (~50K 차이)
  - applewatch-ultra / -ultra2 / -ultra3: 외형 동일, 시세 ~200K씩 차이
  - applewatch-se2 / -se3: 외형 동일, 5G 차이만
  - galaxy-s25-edge: 별도 모델 (얇은 폼팩터, 512GB 단일)
  - galaxy-s23-fe: 저가 라인 (msrp 850K)
  - galaxy-buds-3 / -3-pro: 오픈형 vs 인이어+ANC
  - sony-wh-1000xm6: 신상, XM5와 ~100K 차이
  - bose-qc-ultra-earbuds: 이어버드 vs Headphones 별도 (~140K)
  - switch-v1 / -lite / -oled / -2: 4 변형
  - ps5-pro: 신상 (GPU 67% 강력)

## 3. UI 표시 path (다음 wave에서 활용 필요)
- pack reveal modal: model-guides + confusionNote 같이 표시
- admin pool browser (admin-pool-browser.tsx): 매물 카드에 confusionNote badge
- 추천 카드 (recommendation-workspace): 셀러 설명 도움말

## 4. 거론 금지
- 자율 진행: 추가 혼동 SKU 발견 시 confusionNote 박기 (별도 wave 없이).
- UI 표시 — 별도 wave에서 component 변경.
- 검증: 139/139 test pass ✓
