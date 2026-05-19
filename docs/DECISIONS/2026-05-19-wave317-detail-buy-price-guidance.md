# 2026-05-19 Wave 317 — 상세 매입가 가이드 + 신선도/fallback/툴팁 강화

외부인 피드백 2차 (대화 2026-05-19) 검토 결과 정체성("일반인이 편하게 돈 벌 수 있는 AI 사이트") 부합 + 비파괴적 5개 항목 1차 wave로 박음. 모달 안 변경만 — 카드 리스트/운영자 풀 카드는 별도 UI라 다음 wave.

## 결정

### 1. 권장 매입가 목표/패스 프레임 (`CostAssurancePanel`)
- 외부인 우려: "최대 매입가 140k" 표시 시 일반인이 협상 천장으로 오해 → 손익 0에 매입 위험.
- `CostAssurancePanel` 안에 **매입가 판단 가이드** 박스 추가:
  - **추천 매입가**: `시세 - 비용 - (시세 × 18%)` — "+18% 마진 확보"
  - **패스 기준**: `시세 - 비용 - (시세 × 10%)` 이상이면 "손 떼기"
  - **손익분기**: 작은 보조 텍스트로만 (참고용)
  - **현재 가격 평가**: ≥18% → 좋음(emerald) / 10~18% → 낮음(amber) / <10% → 패스 권장(rose)
- 헬퍼 함수 `buyPriceGuidance(card)` 추가 (210줄 부근).
- 프레임 정책: 협상 천장이 아니라 "여기서 손 떼기" 기준. 일반인 정체성(메모리 `project_core_principle_consumer_friendly.md`) 부합.

### 2. 시세 신선도 6h/24h 임계 강화 (`verificationDisplay`)
- 외부인 지적: 42시간 전 검증 = 죽은 데이터, "다시 확인 권장"이 약함.
- 기존: 30분 / 3시간 / 그 이상 3단계.
- 변경: 30분 / 3시간 / **6시간 (재검증 권장)** / **24시간 (시세 변동 가능)** / **24시간+ (데이터 오래됨 · 번개장터에서 직접 확인, danger tone)** 5단계.
- `stale` 플래그 추가 — 6h 초과 시 true.
- `upperFoldTileClass` 의 `tone === "warn"`을 amber 분기로 이동 (이전엔 rose로 떨어짐 — 외부인 의도 "노란 배너"와 어긋났음).

### 3. 회수 속도 fallback 텍스트 명시화 (`UpperFoldFearReducers`)
- 외부인 지적: "표본 부족 · 임시 기준" 한 줄이 너무 자주 나옴 → 가치 떨어짐.
- 변경: `"이 모델 표본 부족 · 카테고리 평균 {N시간} 기준 (참고용)"` 로 명시.
- 진짜 SKU→class→category fallback 체인은 보류 (쿼리 변경 필요).

### 4. 신뢰/표본 칩 tooltip (`MarketBasisMini`)
- 외부인 빠른 fix: "신뢰 보통"이 어떤 기준인지 명시 필요.
- `표본 N건` 칩: 판매중/거래완료 분해 hover 표시.
- `신뢰 N` 칩: 높음/보통/낮음 기준 설명 hover 표시.

### 5. 신뢰도 산출 근거 라인별 tooltip (`ConfidenceBreakdown`)
- 외부인 빠른 fix: 사용감 분류 정확도 등 산출 근거 노출.
- 4개 라인 (모델 매칭 / 시세 표본 / 시세 신뢰 / 판매 속도) 각각에 `hint` 필드 + `cursor-help` + ⓘ 마커 + hover 설명 추가.

### 6. TypeScript narrowing fix
- `dailyProfitDisplay()` 안 `velocity.medianHoursToSold` 접근 시 TS18047 (기존 에러). early-return 패턴으로 narrow되게 수정.

## 보류 — 다음 wave 후보 (비파괴적이지만 데이터/구조 추가 필요)

- **손실 시나리오 "최악 -X원" 배지**: `profit.ts` 의 `expectedProfitMin = Math.max(0, ...)` 음수 clamp 해제 또는 별도 worst-case 계산 함수 필요.
- **셀러 정보 카드 강화**: `last_seen_at`, `is_proshop` 이 RevealCard prop에 없음. `/api/packs/me/route.ts` API 응답 확장 필요.
- **호가/거래가 비율 칩**: `marketBasis.medianPrice`는 전체 중앙값. 호가/거래가 분리된 평균 가격은 `mvp_market_price_daily` 시계열에만 있고 카드 prop 미노출. 분리 가격 필드 추가 필요.
- **카드 리스트(user-reveal-dashboard) + 운영자 풀(admin-pool-browser)에 동일 변경 적용**: 신선도 배지/회수 속도 fallback 텍스트는 카드 리스트에도 적용 가치 있음. 다음 wave.

## 보류 — 정책상/인프라 큰 변경 (별도 wave)

- **자동 백그라운드 재검증** (매물 진입 시 live ping): 인프라 신규.
- **24시간 초과 매물 사용자 풀 자동 숨김**: 매물 풀 알고리즘 변경 = 사용자 체감 큼. 별도 검토.
- **카테고리별 가품 체크리스트** (에어팟/아이폰/갤럭시 한정): 외부인 #2 부분 수용. 카테고리 분기 시스템은 정책 충돌이라 보류, 단 우리 핵심 SKU에만 정적 체크리스트 박는 식으로 다음 wave.
- **쿠팡 새상품 가격 fetcher**: 다나와 패턴 참고. 정가 대비 % 표시(외부인 빠른 fix #4) 동시 해결.
- **거래 결과 입력 + ROI 대시보드 (학습 루프 닫기)**: `mvp_reveal_feedback` enum에 `bought_price/sold_price/sold_at` 컬럼 추가 + `/me`에 ROI 대시보드. 외부인 wave 2 1순위.
- **자본/예산 관리**: user profile에 `available_capital/locked_capital` 추가 + 온보딩 1문항 + 매물 카드 "예산 내" 필터.
- **첫 거래 보호 모드**: `mvp_pack_reveals` 거래 카운트 트래킹 + 신규(0~2건) 사용자 좁은 풀.
- **판매 단계 도우미 (자동 판매글 + 사진 가이드)**: LLM 호출 라우트 신규 필요. 외부인이 강조한 정체성 핵심.
- **사회적 증명 (긍정 통계)**: 거래 결과 입력 데이터 누적 후 가능.

## 거절 (정책 충돌 / 데이터 부재 / MVP 범위 밖)

- **카테고리별 전체 분기 시스템**: 전업 트레이딩 도구 영역, 정책 충돌.
- **판매자 분쟁율/사진 역검색/계정 나이**: 신용 스코어링 = 전업 도구. 번개 API 미지원.
- **가품 확률 베이지안 모델**: 데이터 6~12개월 누적 필요. 일반인 가독성도 떨어짐. 별도 카테고리 체크리스트(보류)가 대체.
- **AI 채팅 어시스턴트 ("이거 사도 돼?")**: MVP 범위 밖. 모더레이션 책임 큼.
- **당근마켓 통합**: P2 유지. Wave 90 source 다양화 메모리 있지만 우선순위 낮음.
- **KREAM 시세**: 우리 카테고리(전자기기) 외라 보류. 스니커즈/명품 진출 시 재검토.

## 변경 파일

- `src/components/pack-reveal-modal.tsx` (단일 파일 변경).
  - `buyPriceGuidance()` 추가
  - `verificationDisplay()` 5단계 분기로 확장
  - `upperFoldTileClass()` warn → amber 매핑
  - `UpperFoldFearReducers` 회수 속도 sub 텍스트 명시화
  - `MarketBasisMini` 표본/신뢰 칩 title 추가
  - `ConfidenceBreakdown` lines hint + cursor-help + ⓘ 마커
  - `CostAssurancePanel` 안 매입가 판단 가이드 박스 추가
  - `dailyProfitDisplay()` TS narrow fix

## 검증

- `tsc --noEmit` — `pack-reveal-modal.tsx` 신규 에러 0. 기존 line 194 에러 동시 해결.
- 카드 리스트/운영자 풀 화면 미수정 — 다음 wave.

## 정책 참조

- 메모리 `project_core_principle_consumer_friendly.md`: 일반인 친화, 전업 리셀러 pivot 금지.
- 메모리 `feedback_proceed_on_clear_wins.md`: 명확한 fix는 묻지 말고 진행.
- 메모리 `feedback_ui_changes_apply_to_all_card_screens.md`: 모달 내 변경은 카드 UI 룰 직접 적용 안 함 — 단 신선도/fallback 텍스트는 카드에도 적용 가치 있어 다음 wave 후보로 명시.
