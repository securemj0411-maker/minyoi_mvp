## Wave 76 — 매물대 수익 표시 disclaimer 추가 (3 위치)

- 시간: 2026-05-14 KST
- 발견: 매물대(profit_band) 로직 검토에서 2개 risk 발견:
  - Risk A: `Math.max(0, profitMin)` clamp가 worst-case 손실 가능성을 avg에서 숨김
  - Risk B: UI 슬라이더 "최소 차익 N만원+" vs 서버 avg 기준 mismatch — 사용자 약속 ≠ 실제 worst case
- 결정: parser/band 로직 변경 대신 **UI disclaimer로 면책 + UX 명확화** (user 결정).
- 변경:
  - `src/components/pack-reveal-modal.tsx` 결과 footer에 disclaimer 추가:
    "ⓘ AI 기반 시세 추천 — 수익 보장 X. 표시된 차익은 해당 가격에 정상 판매됐을 때 추정 수익이며,
     실제 거래는 매입가 협상·판매 시점·시세 변동·구성품 차이로 달라질 수 있습니다. 최종 판단은 본인."
  - `src/components/pack-shop.tsx` 랜딩 카루셀 카드 하단에 짧은 disclaimer:
    "ⓘ AI 시세 기반 추정 — 수익 보장 X. 실제 거래는 매입 협상·판매 시점·시세 변동에 따라 달라집니다."
  - `src/components/recommendation-workspace.tsx` 수익 슬라이더 하단에 disclaimer:
    "ⓘ 표시 수익은 시세 기반 추정 (해당 가격에 정상 판매 시). AI 추천이며 수익 보장 X — 매입가 협상·판매 시점·구성품에 따라 달라집니다."
- 검증:
  - npx tsc --noEmit clean
  - npm run test:core 139/139 pass
  - 기존 terms/page.tsx에도 동일한 면책 조항 (line 28 "회사가 제공하는 추천 정보는 참고용이며...")
- 위험:
  - LOW: UI text only. 사업/법적 안전성 ↑.
- 다음:
  - parser/band 로직은 변경 없음 (Risk A/B는 UI disclaimer로 cover됨)
  - 차후 사용자 신뢰도 모니터링 (chargeback / 환불 신고) 후 재검토 가능
