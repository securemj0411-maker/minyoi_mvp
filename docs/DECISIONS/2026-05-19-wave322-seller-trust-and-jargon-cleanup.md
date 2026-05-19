# 2026-05-19 Wave 322 — 셀러 신뢰도 카드 + 단어 일반인 친화

사용자 피드백(2026-05-19): 2030 일반인 타겟이라 위계/단어 정리. wave321 후속.

## 결정

### 1. 단어 일반인 친화 (전문 용어 → 직관 표현)

| 기존 | 변경 | 위치 |
|------|------|------|
| 신뢰 보통/높음/낮음 | 비교 데이터 충분/보통/부족 | `MarketBasisMini` 칩 |
| 표본 N건 | 비슷한 매물 N건 | 동일 |
| 시세 표본 | 비슷한 매물 | `RecommendationReason` 풋터 + `ConfidenceBreakdown` |
| 시세 신뢰 | 비교 데이터 | 동일 |
| 모델 매칭 / 분류 불완전 | 모델 인식 / 분류 흐림 | `ConfidenceBreakdown` |
| 판매 속도 | 팔리는 속도 | 동일 |
| 신뢰도 산출 근거 | 왜 이 점수가 나왔나 | `ConfidenceBreakdown` 헤더 |
| 시세 표본 부족 | 비슷한 매물 부족 | RecommendationReason 풋터 |
| 판매완료 표본 누적 중 | 거래 데이터 누적 중 | 동일 |

각 ConfidenceBreakdown 라인의 `hint` 텍스트도 일반인 친화 (예: "AI 파서가..." → "AI가 매물 제목/설명에서 알아본 결과").

### 2. 셀러 신뢰도 별도 카드 (`SellerTrustPanel`)

기존 분산:
- "거래 안전" 타일 (UpperFold) — 평점만
- `RecommendationReason` 안 — 셀러 후기 4.5+ 신호

→ **별도 카드로 통합**. `CostAssurancePanel` 다음 + `CounterfeitChecklistPanel` 전 위치.

#### 4단계 등급 (`savedDetail` 데이터 기반)

| 등급 | 조건 | 표시 | 색 |
|------|------|------|------|
| good | 평점 ≥4.8 + 후기 ≥30 | "우수 셀러 ⭐ N.N" | emerald (강) |
| ok | 평점 ≥4.5 + 후기 ≥10 | "평점 N.N 셀러" | emerald (약) |
| caution | 후기 있음 그 외 | "평점 N.N · 후기 N건" | amber |
| danger | 후기 0 | "신규/익명 셀러" | rose |

부가 표시:
- 무료배송 칩 (있을 시 emerald)
- 안전결제 권장 칩 (항상)
- caution/danger 시 풋터 경고: "후기 적은 셀러는 번개페이 안전결제 + 직거래 검수로 위험 최소화"

#### 보류 데이터 (다음 wave — API prop 확장 필요)
- `is_proshop` (프로숍 여부)
- `last_seen_at` (마지막 활동)
- 거래 횟수 누적

## 보류 — 사용자 명시 + 인프라 큰 변경

### 사용자 명시 보류
- **자본/예산 관리** (DB + 온보딩 변경)
- **첫 거래 보호 모드** (welcome 로직 변경 + 풀 필터)
- **응대 템플릿** (파는 쪽 3개)

### 인프라 큰 변경 — 별도 wave 결정
- **자동 백그라운드 재검증**: /me 진입 시 매물별 Bunjang ping → freshSeconds 갱신. 신규 endpoint + 클라 폴링 + Rate limit 관리 필요. 이번 wave에 못 박음, 별도 wave 결정 후 진행.
- **24h 매물 풀 자동 숨김**: 풀 알고리즘 변경, 사용자 체감 큼.
- **셀러 추가 데이터** (`is_proshop`, `last_seen_at`): `/api/packs/me/route.ts` 응답 확장 필요. 다음 wave.

## 변경 파일

- 수정: `src/components/pack-reveal-modal.tsx` 단일 파일
  - `MarketBasisMini` 칩 라벨 변경
  - `ConfidenceBreakdown` 라인 라벨/hint/풋터 변경
  - `RecommendationReason` 풋터 칩 라벨 변경
  - `SellerTrustPanel` 신규 컴포넌트 (savedDetail 활용)
  - `RevealCardItem`에 SellerTrustPanel 삽입

## 검증

- `tsc --noEmit` — 깨끗.
- `eslint` — 깨끗.

## 다음 wave 후보 (사용자 결정 대기)

1. 자동 백그라운드 재검증 (인프라)
2. 24h 매물 풀 자동 숨김 (풀 알고리즘)
3. 셀러 추가 데이터 (is_proshop, last_seen_at) — API 확장
4. (사용자 명시 보류) 자본 관리 / 첫 거래 보호 / 응대 템플릿
