# 2026-05-20 — Claude Design handoff → pack-reveal-modal 1:1 포팅

## 배경
- 사용자가 Claude Design handoff(`/tmp/minyoi-design/untitled/project/상세페이지.html`
  + `/Users/iminje/Downloads/상세페이지 — 득템잡이.pdf`) 받음.
- `mvp/src/app/me/preview-detail/page.tsx` 에 1:1 포팅 더미 페이지 이미 박힘.
- 의도 = preview-detail JSX 의 inline style 그대로 `pack-reveal-modal.tsx` 의 실제
  reveal 카드 안 panel 들에 복사 + 실제 데이터 매핑. 위계(Wave 394.6 정보 순서)는 유지.

## 적용한 panel 목록 (Wave 394.7.q ~ .v)
- `.q` **ProfitHero** — 차익 헤드라인. `linear-gradient(135deg, #f3faf5 → #e6f4ec)` +
  `border #c8e6d4` + ₩ watermark(opacity 0.05). `commit ac6b2c1`.
- `.r` **SellWhere/PlatformProfitCompare** — 채널별 차익. 2-col grid + 당근 추천 badge
  (+ 가격차 더 buyer label). `commit 8f5e530`.
- `.s` **AuthenticityCheck/CounterfeitChecklistPanel** — `bg #fffbef` + accent left
  `#f59e0b`. `commit 1c78518`.
- `.t` **FAQ 헤더 박스** + `.u` **StickyCTA** — emerald pill `#059669` + 검정원 N/⚡.
  `commit 5cd70cb`.
- `.v` **ComparableListingsPanel + UpperFoldFearReducers** — 흰 카드 line divider
  rows(handoff CompareList) + MarketStats `💡 hint box`. `commit 357170c`.

## 적용 안 한 panel (현 상태 OK 판단)
- **NegotiationGuide** — 이미 tone-row + icon 24x24 + tabular-nums 매칭됨
  (.n 에서 박혀있음). 추가 변경 불필요.
- **PriceGraph footer "기준 변경" 버튼** — 현재 그래프는 condition_class fix 표시.
  "기준 변경" 토글은 별도 데이터 fetch 필요해 product decision 대기.
- **RecommendationReasonPanel/WhyRec** — 이미 ✓ icon + "왜 추천했나" + "근거 보기" pill
  구조 매칭됨.
- **Hero / TopBar** — modal-level chrome (← 🏠 pill 36x36 + backdrop-blur). reveal
  modal은 그리드 다중 카드 컨테이너라 handoff 의 single-card chrome 그대로 못 옮김.
  product decision 필요.

## 변경 원칙
- `<Card>` `<SectionH>` `<Chip>` `<Eyebrow>` 같은 preview-detail 의 primitive 는
  복사 안 함. Tailwind 클래스 + inline hex(#ece3d2 line, #f3faf5 bg 등) 직접 매칭.
- 위계 순서는 우리 미뇨이대로(차익 → 비교 매물 → 시장 stats → 비용 → 협상 → 정품 → FAQ).
- 메모리 룰 보존: 3 화면 일관성, decision log, 일반인 친화 카피.

## 참고 commit
- ac6b2c1 ProfitHero
- 8f5e530 SellWhere
- 1c78518 AuthenticityCheck
- 5cd70cb FAQ + StickyCTA
- 357170c ComparableListings + MarketStats hint
