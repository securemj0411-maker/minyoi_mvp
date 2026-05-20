# 2026-05-20 — 매물 상세페이지 디자인 ↔ 기존 데이터 매핑

선행: [2026-05-20-product-detail-redesign-preview.md](./2026-05-20-product-detail-redesign-preview.md)

## 목적
디자인 16개 섹션 ↔ 기존 `RevealCard` / `RevealListingDetail` / 추가 lib 함수 매핑.
실제 modal 교체 전 데이터 공백 식별.

## 데이터 소스 요약
- **RevealCard** (`src/lib/pack-open.ts:25`) — 카드 한 장 데이터: pid, name, price, expectedProfitMin/Max, confidence, marketBasis, velocityBasis, lastVerifiedAt, firstSeenAt, skuListingFlow, savedDetail (description/favoriteCount/freeShipping/seller), optionBaseAssumed, confusionNote, band.
- **RevealListingDetail** (`src/lib/pack-open.ts:115`) — lazy fetch (상품 보기 클릭 시): description 전체, saleStatus, conditionLabel, imageUrls[], metrics (view/fav/comment), seller (uid/name/reviewRating/reviewCount/follower/sales/proshop/officialSeller/joinDate), shippingOptions, shippingSummary.
- **MarketBasis** — p25/median/p75 + sampleCount + priceSource ("reference"|"market"|"v3_pending_rematch") + conditionClass + otherConditions[].
- **VelocityBasis** — sold24h/sold7d + medianHoursToSold + p25/p75 + sample counts.
- **lib 함수**: `calculateDealScore(card)` (득템 점수 0~100), `buyPriceGuidance` (협상 기준), `counterfeitChecklistFor` (정품 점검), `sellHelperFor` + `suggestedAskingPrice` (셀러 도우미), `buildRiskScore` (리스크 신호).

## 섹션별 매핑

### 1. Hero (이미지)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 매물 사진 (4:4.2 ratio) | `detail.imageUrls[0]` | ✅ |
| 페이지네이션 도트 (4개) | `detail.imageUrls.length` | ✅ |
| 상태 칩 (`● 상태 보통`) | `detail.conditionLabel` + `<ConditionChip/>` | ✅ |
| `크게 보기` 버튼 | full-screen 이미지 viewer 필요 | 🆕 신규 |

### 2. TopBar (뒤로/홈/저장)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 뒤로 | router.back() | ✅ |
| 홈 | router.push('/') | ✅ |
| 북마크 | 현재 미존재 (`saved` boolean state) | 🆕 신규 API + state |

### 3. TitleBlock
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 캡션 (AI 판단 ... ) | 정적 텍스트 | ✅ |
| 제목 | `card.name` | ✅ |
| 득템 점수 (0~100) | `calculateDealScore(card)` | ✅ |
| 그라데이션 바 (70×3) | score % 으로 width 계산 | ✅ (UI만) |

### 4. ProfitHero (💎 예상 순익)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| `+303,850원` (메인) | `card.expectedProfitMin` | ✅ |
| `~ +307,350원` | `card.expectedProfitMax` | ✅ |
| `1일 전` | `card.firstSeenAt` → `formatDistance` | ✅ |
| `비교 12개` | `card.marketBasis.sampleCount` | ✅ |
| `+87%` chip | `netProfitPercent(card)` (이미 함수 있음) | ✅ |
| `매입 OK` chip | 차익 > 0 boolean | ✅ |
| 매입/시세 메타 | `card.price` + `marketBasis.medianPrice` | ✅ |
| `계산식 · 비교 매물 12개 보기` btn | 비용 아코디언 + 비교 매물 섹션으로 스크롤 | ✅ (anchor link) |

### 5. SellWhere (번장 vs 당근)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 번장 차익 | `expectedProfit - (sellPrice × SELLING_FEE_RATE)` | ✅ (`/lib/profit.ts`) |
| 당근 차익 | `expectedProfit` (수수료 0) — 단 지역 노출 X | ✅ 계산만 |
| `+24,150원 더` 뱃지 | 두 차익 diff | ✅ |
| `안전결제` chip (번장) | 정적 | ✅ |
| `지역 제한` chip (당근) | 정적 | ✅ |

**⚠️ 정책 검토**: 당근 가격 추천이 시세 비교 차원이라 OK라고 한 메모 ([project_bunjang_safe_payment_mandate](.../user/memory)) — but 당근은 미뇨이 시세 데이터 없음. 디자인은 "수수료만 다른 동일 매물 가정". 사용자에게 오해 가능성 — owner decision 필요.

### 6. WhyRec (왜 추천?)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| `왜 이 상품을 추천했나요?` | 정적 헤더 | ✅ |
| `가격·셀러·시세 3가지 기준 통과` | `card.confidence` + `marketBasis.confidence` + seller rating 조합 | ✅ (요약 함수 필요) |
| `근거 보기 →` | 펼침 또는 별도 modal — 기존 `WhyTrustCollapse` 컴포넌트 있음 | ✅ |

### 7. PriceGraph (시세 그래프)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 그래프 line | `MarketHistoryChart` (기존 컴포넌트) | ✅ |
| `오늘` 시작 마커 | 차트 내부 | ✅ |
| `시세 누적 1일째` 안내 | `marketBasis.computedAt` 기준 일수 계산 | ✅ |
| `같은 상태 · 번개 매물 추이` | `marketBasis.conditionLabel` + priceSource 라벨 | ✅ |
| `기준 변경` btn | otherConditions[] 선택 modal | ✅ |

### 8. MarketStats (3 trio)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 안내 박스 (셀러가 낮게 등록) | `(card.price < marketBasis.p25Price)` 조건 | ✅ |
| 수요·공급 | `card.skuListingFlow` (count24h/avgPerDay7d) | ✅ |
| 팔리는 속도 | `velocityBasis.medianHoursToSold` | ✅ |
| 거래 안전 | `detail.seller.reviewRating` + `reviewCount` | ✅ |

### 9. NegotiationGuide (협상 가이드 4행)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 현재 매입가 → 차익 | `card.price` + profit | ✅ |
| 협상 시도 (−20k) → 차익 | `buyPriceGuidance(card)` (lib 함수 존재) | ✅ |
| `약 64.6만원~ 사면 차익 1만원 미만` | breakeven 계산 (시세 − 비용 − 1만) | ✅ 계산 |
| `약 65.6만원~ 사면 손해` | breakeven (시세 − 비용) | ✅ 계산 |

### 10. CostBreakdown (비용 아코디언)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 상품가 | `card.price` | ✅ |
| 내가 낼 배송비 | `detail.shippingOptions` | ✅ |
| 결제 수수료 | `SELLING_FEE_RATE` × price (셀러 부담) | ✅ |
| 안전결제 3.5% | `SELLING_FEE_RATE` | ✅ |
| 재배송비 | `RESELL_SHIPPING_FEE` (상수) | ✅ |
| 안전버퍼 | `SAFETY_BUFFER` (상수) | ✅ |
| 요약 박스 | 위 합산 | ✅ |

### 11. CompareList (시세 비교 4개)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 비교 매물 4개 | `marketBasis.excludedExamples`? — 데이터 부족 | ⚠️ **API 보강 필요** |
| `비슷한 상태끼리만` | `marketBasis.conditionClass` 라벨 | ✅ |
| `비교 매물 8개 더 보기` | 별도 API endpoint 필요 | 🆕 신규 |

**Blocker**: 현 `marketBasis`엔 비교 매물 list가 없음. `/api/packs/reveals/comparables/[pid]` 같은 endpoint 신규 필요.

### 12. AuthenticityCheck (정품 점검)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| `명품 정품 점검 6개` | `counterfeitChecklistFor(card)` (lib 함수 존재) | ✅ |
| 브랜드 chip | `detectBrandDepth(card)` (lib 존재) | ✅ |
| 가품 위험 큼 chip | `COUNTERFEIT_RISK_LABEL` (상수 존재) | ✅ |
| 필수 N개 chip | priority="required" filter count | ✅ |

### 13. FAQ (자주 묻는 4가지)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| Q1 셀러 믿을 만한가요? | `detail.seller.*` 동적 응답 | ✅ |
| Q2 가품 위험? | `counterfeitChecklistFor` 요약 | ✅ |
| Q3 안전결제? | 정적 | ✅ |
| Q4 사기 대응? | 정적 | ✅ |

기존 `pack-reveal-modal.tsx`에 비슷한 FAQ 로직 있음 (`WhyTrustCollapse` 등) — 재사용 가능.

### 14. OtherRecs (다른 추천 매물)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| 가로 스크롤 카드 N개 | `relatedItems` prop (PackRevealModal에 이미 있음, `RelatedRevealItem[]`) | ✅ |

### 15. Footer 디스클레이머
정적 텍스트. ✅

### 16. StickyCTA (번장 원본 보기)
| 디자인 필드 | 데이터 출처 | 상태 |
|---|---|---|
| `번개장터 원본 매물 보기` | `card.url` 새 탭 | ✅ |
| 클릭 이벤트 | `onLinkClicked(pid)` (이미 존재) | ✅ |

## Blocker 정리

| Blocker | 영향 섹션 | 대응 |
|---|---|---|
| 1. 비교 매물 list API 없음 | §11 CompareList | `/api/packs/reveals/comparables/:pid` 신규 + `marketBasis.excludedExamples` 확장 또는 별도 query |
| 2. 북마크 기능 없음 | §2 TopBar | `/api/listings/:id/save` + user_bookmarks 테이블 신규 |
| 3. "크게 보기" 풀스크린 viewer 없음 | §1 Hero | 모달 inside 모달 — react-image-lightbox 등 |
| 4. 당근 가격 추정 정책 미정 | §5 SellWhere | owner decision: "당근에서도 같은 가격" 가정 노출 OK인지 |
| 5. `이미지 페이지네이션` carousel UX | §1 Hero | swipe gesture lib 필요 (Embla 등 — 기존 도입 여부 확인) |
| 6. `왜 추천?` 근거 요약 함수 없음 | §6 WhyRec | confidence + market + seller 종합 1줄 문구 생성 함수 신규 |

## 다음 wave 권장 순서

1. **wave N — Blocker 해소 (필수 데이터/API)**
   - 비교 매물 API
   - 북마크 테이블 + API
   - 당근 가격 정책 owner decision
2. **wave N+1 — 컴포넌트 분리 + Tailwind 토큰화**
   - `mvp/src/components/listing-detail/` 14개 컴포넌트
   - `tailwind.config.ts` 토큰 추가 (em/amber/rose/cream)
3. **wave N+2 — 실 데이터 바인딩 + pack-reveal-modal 교체**
   - PackRevealModal → ListingDetailPage로 router (모바일만)
   - admin-pool-browser / user-reveal-dashboard 톤 맞춤
4. **wave N+3 — 다크모드**
5. **wave N+4 — E2E / A11y / pixel diff QA**

## 위험
- 한 wave에 다 박으려 하면 도중에 blocker(#1, #4)로 막힘 → 디자인 일부만 가짜 데이터로 보여주는 frankenstein UI 위험.
- pack-reveal-modal 4190줄에 기존 로직 (loss_report, feedback polling, 검수/판매 액션 등) 박혀있음 — 새 디자인엔 그 슬롯 없음. **누락 슬롯 명세** wave에서 별도 정리 필요.

## 미해결 owner decision
- D1. 당근 가격 추정 노출 OK? (§5)
- D2. 북마크 기능 추가 OK? (§2) — UI 룰 메모에 "사용자 reveal 화면 + 운영자풀 + 나의 상품 3화면 다 같이" 박혀있음
- D3. 디자인은 모바일 전용. 데스크탑 톤은 별도 디자인 받을지, 같은 컴포넌트 width 늘려서 쓸지?
- D4. 기존 모달의 "손해 신고", "검수/판매 액션", "loss_report" 슬롯은 새 디자인 어디에 박을지?
