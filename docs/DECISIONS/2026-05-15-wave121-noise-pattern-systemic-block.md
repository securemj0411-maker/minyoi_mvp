# Wave 121 — 가격 outlier 패턴 분석 → 4종 noise 다층 차단 (920건 invalidate ⭐)

> 사용자 핵심 통찰: "정확도 97%면 부정확한 3% 왜 그랬는지 패턴 분석하고 차단해야". 1건 fix가 아니라 systemic.

## 1. 진단 — narrow self lane 가격 outlier audit
- 시간: 2026-05-15
- 발견 (가격이 msrp 1.5배 이상 또는 20% 이하 매물 30건+):
  - 가격 dummy: 999999999 / 123456789 / 111110111 / 555555555 (8건+)
  - 케이지 킷 (NEEWER/스몰리그 촬영용 액세서리)
  - 콜라보 굿즈: 네임보드, 우치와, 키링, 테디베어 (K-pop 아이돌)
  - 광고/업자: "단독 행사중", "개인결제창", "고객님"
  - 교신 매물: "교신", "교신원함"

## 2. 다층 차단 fix
- 시간: 2026-05-15
- 변경:
  - **PHONE_NOISE 21개 token 추가**:
    - 케이지 킷 변형
    - 콜라보/네임보드/우치와/키링/테디베어 (인형/고객님 추가)
    - 단독 행사 / 행사중 / 개인결제창 / 결제창
    - 교신 / 교신원함 / 교신원해요 등
  - **pipeline.ts:641 가격 거부 표시 차단** (10M+ + dummy 패턴 regex):
    ```typescript
    if (price >= 10_000_000) {
      const allSame = /^(\d)\1+$/.test(priceStr);
      const sequential = /^(\d+)\1+$/.test(priceStr);
      const startsWith9 = /^9{3,}/.test(priceStr);
      if (allSame || sequential || startsWith9) return callout;
    }
    ```
- 검증: 139/139 test pass.

## 3. Production — 920건 invalidate ⭐
- 시간: 2026-05-15
- 실행: SQL UPDATE — sku_id LIKE 'iphone%' OR 'galaxy-s%' OR 'galaxy-z-flip%' + 노이즈 매칭
- 결과: **920건 narrow/broad SKU에서 sku_id NULL invalidate** (정확도 향상)

## 4. 거론 금지
- 가격 vs msrp ratio reject — pipeline level 검증은 복잡 (별도 wave). 현재 dummy 가격만.
- 교신 vs 교환 — Wave 120에 "교환원함" 추가, Wave 121에 "교신" 추가.
