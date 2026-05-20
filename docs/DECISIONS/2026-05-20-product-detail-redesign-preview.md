# 2026-05-20 — 매물 상세페이지 리디자인 (preview-only)

## What
디자인 핸드오프 (`handoff_product_detail`) 1:1 포팅을 `/me/preview-detail` 라우트에 추가.
- 16개 섹션 (Hero / TitleBlock / ProfitHero / SellWhere / WhyRec / PriceGraph / MarketStats / NegotiationGuide / CostBreakdown / CompareList / AuthenticityCheck / FAQ / OtherRecs / StickyCTA)
- iOS 390×844 디바이스 프레임에 렌더링
- 더미 데이터 (슈프림 × 노스페이스 자켓)
- 인라인 스타일 유지 — 디자인 의도 픽셀 단위 검증용

## Why (Option A 선택 이유)
실제 `pack-reveal-modal.tsx`는 **4,190줄** + detail fetch / comparables / marketBasis / velocity / flow / loss-report 등 매우 큰 통합. 한 세션에 풀 리라이트는 도중에 매핑 막힐 위험 큼.
디자인 의도부터 픽셀로 합의 본 다음 데이터 매핑하는 게 안전.

## Not done (후속 wave 필요)
1. **데이터 매핑 표** — 디자인 필드 (득템 점수, 시세 그래프 점, 정품 점검 6개, 왜 추천?, 협상 가이드 4단계) ↔ 기존 API 응답 매핑
2. **3화면 동시 적용** — `admin-pool-browser`, `pack-reveal-modal`, `user-reveal-dashboard` 셋 다 같이 가야 함 (CLAUDE.md 룰)
3. **데스크탑/모바일 반응형** — 디자인은 390px 모바일 전용. 데스크탑 톤 결정 필요
4. **다크모드** — 현 디자인 라이트 전용. 사이트 zinc-950 베이스랑 맞춰야 함
5. **인라인 스타일 → Tailwind 토큰화** — 프로덕션 들어가기 전 컨벤션 맞춰야 함
6. **컴포넌트 14개 분리** — 현재 1파일에 다 박혀있음. README 권장 `src/components/listing-detail/` 구조로

## Files
- 추가: `mvp/src/app/me/preview-detail/page.tsx` (~860줄, dev preview only)

## Update 2 — 2026-05-20: 데이터 소스 `/api/packs/me` → `/api/packs/pool` 로 교체
- 이유: Wave 343에서 "팩 열기" 폐기. 현재 /me 는 ExploreClient → `/api/packs/pool` (30개 자동) + 카드 클릭으로 PackRevealModal.
- 사용자가 "팩을 어디서 여냐"고 한 정당한 질문. preview-detail 도 같은 풀 데이터 써야 함.
- `PoolItem → MeReveal` 어댑터 추가. marketBasis 는 `/api/packs/pool/analysis?pid=X` lazy-fill.
- detail (imageUrls) fetch 는 reveal 안 한 매물엔 권한 없을 수 있음 — fail OK, thumbnailUrl fallback.

## Update — 2026-05-20 후속: 실데이터 바인딩 박음
- `?pid=NNNN` query 지원. 없으면 `/api/packs/me?page=1&pageSize=1` 첫 reveal 자동 로드.
- `/api/packs/reveals/detail` POST로 imageUrls/conditionLabel/seller/shipping 가져옴.
- 바인딩된 섹션: Hero (실사진 + 도트 + condition), TitleBlock (name + 간이 dealScore), ProfitHero (실 profit min/max + sample + firstSeenAt), SellWhere (번장 vs 당근 차익 실계산), MarketStats (skuListingFlow + velocityBasis + 셀러 평점), StickyCTA (real card.url).
- 아직 dummy: WhyRec, PriceGraph, NegotiationGuide, CostBreakdown, CompareList, AuthenticityCheck, FAQ, OtherRecs (다음 wave).
- 상단 배너: ok / loading / dummy 상태 표시.
- typecheck clean.

## How to view
```
cd mvp && npm run dev
# 브라우저에서 http://localhost:3000/me/preview-detail
```
