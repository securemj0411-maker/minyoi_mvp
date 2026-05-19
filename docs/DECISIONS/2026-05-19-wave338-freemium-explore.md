# 2026-05-19 Wave 338 — Freemium /explore (Phase 1a + 일부 1b)

새 비즈니스 모델 — Freemium 시간 차등. 사용자 결정:
- 무료 사용자: 6시간 이상 지난 매물 30개 / 30분 cooldown
- 유료 사용자 (Phase 2): 즉시 매물 + 카톡 알림

사업계획서 잠금 모델 (사업계획서_수익모델_보강.md) 폐기 → Freemium 전환. 외부인 #1 "죽은 데이터" + "사고싶다 + 늦었다" FOMO 결합.

## 결정

### 1. DB Migration — `last_free_browse_at` 컬럼
- `supabase/migrations/20260519120000_user_credits_last_free_browse.sql`
- `alter table mvp_user_credits add column last_free_browse_at timestamptz`
- 비파괴적 (ADD COLUMN, NULL 디폴트)
- `schema.sql` canonical도 동시 갱신

### 2. 신규 API `/api/packs/pool`
- 인증 필수 (로그인 사용자만)
- 쿼리: `status=ready AND last_verified_at <= NOW() - 6h`
- 정렬: `profit_band desc, expected_profit_max desc` (안정)
- LIMIT 30 (1페이지)
- `?refresh=1` 시 cooldown 30min 체크 → 통과 시 `last_free_browse_at` 갱신
- 응답: items + cooldown 정보 (canRefresh / remainingSec / nextAvailableAt)

### 3. 신규 API `/api/stats/pool`
- 사회적 증명 통계:
  - `caughtToday` = 오늘 invalidated 매물 count (sold-out)
  - `freshLocked` = 6h 미만 매물 count (유료 전용 영역)
- 캐시 60초

### 4. 신규 페이지 `/explore`
- 30개 매물 grid (모바일 1열 / sm 2열 / lg 3열)
- 통계 배너 (상단, amber)
- "새 30개 받기" 버튼 (cooldown 표시 — `MM:SS 후 가능`)
- Paywall 예고 칩 (`즉시 매물은 구독자 전용 — 곧 출시`)
- 매물 카드 = ExploreClient 컴포넌트 (디자인 토큰 wave323 일관)
- 카드 클릭 → 번개장터 외부 링크 (지금) / 모달 (다음 wave)

### 5. 메모리 룰 적용 — 4번째 화면 디자인 일관
- 기존 3화면: pack-reveal-modal / user-reveal-dashboard / admin-pool-browser
- 신규 4번째: explore-client
- 디자인 토큰 wave323 그대로 적용 (text-base/sm/xs, font-bold/medium, rounded-xl, emerald/amber/rose)
- 카드 패턴 user-reveal-dashboard와 비슷 (사진 + 상품명 + 차익 + 매입/시세 + 메타)

## 보류 — 다음 wave

### Sold out 매물 마스킹 카드 (Task #5)
- invalidated 매물도 응답에 포함시켜 "🔴 다른 사용자가 잡음" 오버레이
- FOMO 강화: "이거 6시간 전에 봤으면 잡았을 텐데" 후회 시각화
- **보안 검토 필요** (외부감사 "정보 누수 race condition" 우려):
  - 옵션 1: 시세/차익만 + 사진/상품명 마스킹 — 안전
  - 옵션 2: 그대로 + "🔴 종료" 오버레이 — 효과 ↑ but 정보 누수
- 별도 wave에서 정책 결정 후 박기

### 매물 카드 → 상세 모달 통합 (Task #4 보강)
- 현재: 외부 번개장터 링크
- 추후: PackRevealModal 통합 (Pool item → RevealCard 형식 매핑)

### Phase 2 — 결제 도입
- PG (포트원/토스) + 카카오 알림톡
- 사업자등록 병행
- 유료 등급별 6h 제약 제거 + 즉시 알림

## 변경 파일

신규:
- `supabase/migrations/20260519120000_user_credits_last_free_browse.sql`
- `src/app/api/packs/pool/route.ts` (~200줄)
- `src/app/api/stats/pool/route.ts` (~50줄)
- `src/app/explore/page.tsx` (12줄, server wrapper)
- `src/components/explore-client.tsx` (~250줄)

수정:
- `supabase/schema.sql` (mvp_user_credits 컬럼 추가)

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗
- 5 신규 파일 + 1 수정

## Production Apply 메모

Migration 파일 (`20260519120000_user_credits_last_free_browse.sql`) supabase에 apply 필요:
- 옵션 1: 사용자가 직접 supabase CLI / dashboard 통해 apply
- 옵션 2: supabase MCP `apply_migration` 호출
- ALTER TABLE ADD COLUMN이라 dataloss 위험 X, downtime X
