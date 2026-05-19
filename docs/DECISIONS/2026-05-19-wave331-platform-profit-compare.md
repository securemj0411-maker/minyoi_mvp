# 2026-05-19 Wave 331 — 번개장터 vs 당근마켓 차익 비교 카드

사용자 + 메모리 정책 (`project_bunjang_safe_payment_mandate.md`) 박혀있던 거:
- 번개장터 안전결제 의무화 → 셀러 3.5% 수수료
- 당근마켓 직거래는 수수료 0
- 사용자가 어디 팔지 선택지 보고 결정

## 결정

### PlatformProfitCompare 신규 컴포넌트
CostAssurancePanel 다음, 셀러 신뢰도 전 자리. 2 segment 가로 비교:

```
┌─────────────────┬─────────────────┐
│ 🟢 번개장터 판매  │ 🟠 당근 직거래    │
│ +21,341원       │ +24,400원        │
│ 수수료 3.5% 차감 │ +3,059원 더 (수수료 0) │
└─────────────────┴─────────────────┘
```

? 버튼 클릭 시 펼침:
- **번개장터**: 안전결제 의무화 (셀러 3.5%). 사기 보호 강함.
- **당근마켓**: 직거래 — 수수료 0. 안전결제 미사용 시 사기 위험. 동네 직거래가 가장 안전 + 무료.
- ※ 당근페이 사용 시 별도 수수료 일부 있을 수 있음.

### 계산 로직
- `bunjangProfit = expectedProfitAverage(card)` (이미 3.5% 차감)
- `bunjangFee = medianPrice × 3.5%`
- `daangnProfit = bunjangProfit + bunjangFee` (수수료 0이라 그만큼 더 남음)
- `bonusFromDaangn = bunjangFee` (당근 가면 받는 추가 차익)

### 당근 로고 — placeholder
저작권 안전 위해 정식 로고 대신 **주황색(`#FF7E36`) 배경 + "당근" 텍스트 칩**.
사용자가 정식 SVG/PNG 주면 교체.

### 정책 부합
- 메모리 `project_bunjang_safe_payment_mandate.md`: "수익 계산 시 수수료 차감 명시 필요" — 충족
- 메모리 `project_core_principle_consumer_friendly.md`: "일반인 친화" — 어디 팔면 더 남는지 명확
- Wave 90 당근 통합 보류와는 별개 (매물 풀 수집이 아니라 판매 옵션 안내)

## 변경 파일

- 수정: `src/components/pack-reveal-modal.tsx`
  - `DaangnChip` 컴포넌트 (placeholder)
  - `PlatformProfitCompare` 컴포넌트
  - `RevealCardItem`에 삽입

## 검증

- `tsc --noEmit` — 깨끗
- `eslint` — 깨끗 (useState hook 순서 fix)

## 보류

- 당근 정식 로고 교체 (사용자 제공 대기)
- 당근페이 수수료 정확한 % (현재 0으로 단순화)
- 직거래 안전 가이드 (다음 wave 후보)
