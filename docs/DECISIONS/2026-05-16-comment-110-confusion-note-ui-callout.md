# 2026-05-16 코멘트 #110 후속 — 헷갈림 안내 (confusionNote) UI callout

## 발견

- 사용자 코멘트 후속: "공략집이나 상품 보기 누르면 c타입이나 라이트닝이나 프로2세대는 가격이 똑같아서 걱정안해도돼요! 뭐 이런거 써져있으면 좋을 텐데"
- 진단:
  - catalog Sku.confusionNote 이미 박혀있음 (wave 128 다른 세션). AirPods Pro 2 통합 SKU 의 confusionNote: "Lightning(2022) + USB-C(2023) 통합 SKU. 기능 차이는 IP54 방진 + Vision Pro 무손실 (사실상 무의미). 시세 동일 처리."
  - 다른 SKU 도 confusionNote 있음 (Galaxy S25 Edge, Switch 1세대, Galaxy S23 FE 등 14개)
  - **but UI 어디에서도 confusionNote 표시 안 함**. 코드 grep 결과 0건.

## 변경

- `src/lib/pack-open.ts`:
  - `RevealCard.confusionNote?: string | null` 추가
  - reveal 생성 시 catalog lookup → `meta.sku_id` 의 SKU.confusionNote 박음
- `src/components/pack-reveal-modal.tsx`:
  - VerdictBadgesMini 아래, MarketBasisMini 위 — 작은 amber callout box
  - `💡 {card.confusionNote}` 형식. 사용자 클릭 안 해도 보이는 prominent 위치

## 검증

- `npm run test:core` 172/172 pass.
- AirPods Pro 2 매물 reveal 시 → "💡 Lightning(2022) + USB-C(2023) 통합 SKU. 기능 차이는 IP54 방진 + Vision Pro 무손실 (사실상 무의미). 시세 동일 처리." 표시.
- 14개 SKU (confusionNote 박힌 것) 모두 자동 표시. catalog 박는 만큼 UI 자동 확장.

## 위험

- amber callout 이 매물 카드 위/아래 layout 영향. 다른 element 와 시각적 충돌 가능 (브라우저 확인 필요).
- confusionNote 길이 조절 X — 길면 카드 차지 큼. catalog 박을 때 짧게 (1~2 sentence) 권장.

## 다음

- admin-pool-browser.tsx (admin 화면) 에도 같은 패턴 적용 가능 (별 wave).
- 다른 헷갈리는 SKU 추가 confusionNote 박기 (예: AirPods Max Lightning vs USB-C 정가 차이?).
