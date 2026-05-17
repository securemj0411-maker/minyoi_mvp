# Wave 182b — 손해 신고 버튼 카드 list → 매물 상세 모달 1곳 이동

## 사용자 피드백

> "야 손해봤어요 너무 모든 카드에 있으니까 좀 그렇잖아; 좀 한곳에 한개만 만들던가; 좀"

## 문제

Wave 182 박을 때 `user-reveal-dashboard.tsx` `ActionButtons` 에 [🚨 손해 봤어요] 버튼을 박음 → "나의 상품" 페이지의 매물 카드 N개 마다 박혀서 시각적으로 거슬림. 사용자가 신고 의도 없을 때도 항상 표시됨.

## 변경

### 1. 카드 list 에서 제거

`src/components/user-reveal-dashboard.tsx` `ActionButtons`:
- [🚨 손해 봤어요] 버튼 삭제 (코멘트 박힘)
- 카드 list 는 [상품 보기] [공략 보기] 2개 버튼만 남김

### 2. 매물 상세 모달 (PackRevealModal) 안 1곳에 이동

`src/components/pack-reveal-modal.tsx`:
- `Props` 에 `onReportLoss?: (card: RevealCard) => void` + `alreadyReportedLoss?: boolean` 추가 (optional)
- `RevealCardItem` 에 prop 받아서 매물 카드 안 [번개장터 열기] 버튼 아래 박음
- `onReportLoss` prop 없으면 버튼 비활성 — **새 팩 열기 흐름 (= pack-reveal-modal 의 기본 사용처) 에선 버튼 안 박힘**
- "나의 상품" 의 "상품 보기" 흐름에서만 prop 전달 → 버튼 표시

### 3. 모달 전환 로직

`user-reveal-dashboard.tsx` `PackRevealModal` usage:
```ts
onReportLoss={() => {
  if (!selectedItem) return;
  const itemRef = selectedItem;
  setSelectedItem(null);            // 매물 상세 모달 닫기
  setSelectedPreviewMode("listing");
  setSelectedPreviewSeed(null);
  setLossReportItem(itemRef);       // 신고 모달 열기
  setLossReportNote("");
  setLossReportResult(null);
}}
alreadyReportedLoss={selectedItem?.feedbackType === "loss_report"}
```

z-index 충돌 차단을 위해 **상세 모달 닫고 → 신고 모달 열기** 순서.

## 사용자 흐름 (변경 후)

1. "나의 상품" 페이지 → 매물 카드 [상품 보기] 클릭
2. 매물 상세 모달 열림 (시세/회전/시장 분석 등)
3. 매물 받고 손해 봤다면 → 카드 안 하단 [🚨 이 매물 받고 손해 봤어요] 버튼 클릭
4. 상세 모달 닫히고 → 손해 신고 모달 열림
5. 사유 입력 → 제출 → 토큰 +3 즉시 보상

## Trade-off

### Pros
- 시각적 cleanup — 카드 list 깔끔 (사용자 피드백 직접 반영)
- 매물 컨텍스트 안에서 신고 흐름 — "이 매물에 대해" 명확
- 신규 팩 흐름 (새 매물 받기) 에선 안 박힘 — "받자마자 손해 신고" 이상한 상황 차단

### Cons
- 발견 비용 ↑: 사용자가 "상품 보기" 누른 뒤에야 발견 가능
- 추가 클릭 1번 (카드 → 모달 → 신고 버튼)

## Follow-up

Wave 182 follow-up 그대로 유지:
- 기각 시 토큰 회수
- 사용자에게 운영자 응답 push
- AI 보조 검토

## Test

`npm run test:core`: **328/328 pass**.

## Linked

- `2026-05-17-wave182-saved-money-counter-loss-report.md`
