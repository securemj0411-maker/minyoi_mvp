## Wave 80 — pack-reveal-modal 카드 UX 개선 + 법적 위험 데이터 제거

- 시간: 2026-05-14 KST
- 발견: user 피드백 5건:
  1. 사진 위 "상세 비교/공략 보기" 오버레이가 사진 가림
  2. 매입가/시세가 떨어져서 비교 어려움
  3. 찜/리뷰 데이터 = 번개장터 직접 노출 → 법적 위험 (DB권/저작권/부경법 카목)
  4. 개별 피드백 버튼 (관심/매수함/이미 팔림/별로 + quickTags 5개) 너무 많음
  5. "추천 상품이 이상해요" 단일 신고 버튼 + 코멘트 form 필요
- 변경:
  - `src/components/pack-reveal-modal.tsx`:
    - **floating overlay 버튼 제거** (상세 비교/공략 보기 사진 위) — 하단 3-button grid는 유지 (이미 사진 외 영역)
    - **가격 그룹화**: 차익(emphasis) → 매입·시세 한 줄 (· 구분) → 신선도
    - **SavedDetailMini 미사용 처리** (prefix `_`) — 찜/리뷰/판매자 설명문 직접 노출 제거
      - 원본 정보는 "번개장터 열기" 버튼으로만 확인 (트래픽 환원 + 직접 보유 X)
    - **개별 피드백 버튼 제거** (feedbackOptions 4개 + quickTags 5개)
    - **"⚠️ 추천 상품이 이상해요" 단일 신고** details + textarea + 저장 버튼
      - 모든 피드백을 `bad_pick` type + 자유 코멘트로 통합
      - placeholder: "예) 단품 의심 · 가격 비교 틀린 듯 · 사진 애매 · 판매자 위험 · 이미 팔린 것 같음"
    - 미사용 함수 정리: handleFeedback, handleQuickTag, feedbackOptions, quickTags
- 검증:
  - npx tsc --noEmit clean
  - npm run test:core 139/139 pass
  - npm run build OK
  - eslint: 1 pre-existing error (line 714 setState in effect, 내 코드 외)
- 위험:
  - LOW: UI 변경. backend `bad_pick` 피드백 type 그대로 사용.
  - 법적 risk ↓ (찜/리뷰/설명 제거)
  - 데이터 분석 시 quickTag 분류 사라짐 → 코멘트 NLP 또는 수동 분류로 대체 (별도 wave)
- 다음:
  - 사용자 신고 코멘트 패턴 분석 → AI L2 자동 분류 검토
