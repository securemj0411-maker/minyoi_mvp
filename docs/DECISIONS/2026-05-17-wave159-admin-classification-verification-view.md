# Wave 159 — 분류 검증 view (운영자 전용) + listing_type override

- 시간: 2026-05-17 KST
- 사용자 코멘트: "이걸 운영할건데 지금 해결해야되는거아님 근본적으러" / "파괴적인거 아니면 다 해"

## 발견

운영자풀은 `mvp_candidate_pool`에서 fetch — 그 풀은 `tick-pipeline scoreStage`가 `listing_type=eq.normal` 매물만 score 처리. accessory/parts/damaged 등으로 분류된 매물 16,841건 (DB 분포: accessory 10,686 / parts 5,256 / damaged 4,123 / callout 3,224 / commercial 1,594 / multi 1,025 / buying 1,613 / unknown 83,126) 은 풀로 영원히 안 들어옴.

문제: AI/regex 분류의 false positive (본품인데 accessory로 잘못 분류) 발견 + 정정 불가. 운영하면서 분류 룰 개선해야 prod readiness 가능.

## 변경

### 1. DB migration: `mvp_raw_listings.listing_type_override`
```sql
ADD COLUMN listing_type_override text,
ADD COLUMN listing_type_override_by text,
ADD COLUMN listing_type_override_at timestamptz,
ADD COLUMN listing_type_override_reason text;
CREATE INDEX ... WHERE listing_type_override IS NOT NULL;
```
listing_type 자체 (AI 결과) 보존. override만 별도 → rollback 가능.

### 2. tick-pipeline scoreStage query 수정 (3곳)
[tick-pipeline.ts:1854, 1885, 1899](mvp/src/lib/tick-pipeline.ts:1854)
- `listing_type=eq.normal` → `or=(listing_type.eq.normal,listing_type_override.eq.normal)`
- scoreStage + loadMarketStatRows + loadMarketStatRowsByPids 다 적용
- override 박힌 매물 풀 진입 + 시세 표본에도 포함

### 3. API GET /api/admin/classification-listings
- query: `listing_type` (필수, 9개 enum 중 1), `page`, `pageSize`, `sku`, `only_overridden`
- raw + parsed + ai_classifications + reveal_feedback JOIN
- 각 매물에 AI reason, parse comparable_key, condition_class, 운영자 코멘트 포함
- admin only (isAdminUser 게이트)

### 4. API POST /api/admin/listing-type-override
- body: `{ pid, override (null | enum), reason }`
- mvp_raw_listings UPDATE: override 4컬럼 + score_dirty=true
- 다음 tick에 풀 진입 (또는 빠짐) 자동 반영
- admin only

### 5. UI: AdminClassificationBrowser 컴포넌트
- listing_type 드롭다운 (9개 enum)
- "override 박힌 것만" 토글 (수정한 매물만 검토)
- 카드: name/price/thumbnail/listing_type 배지/AI reason/comparable_key/description
- "본품 override" 버튼 → POST API (사유 prompt) → 새로고침
- "override 해제" 버튼 → POST API (override=null) → 새로고침
- 페이지네이션 (20건/페이지)

### 6. me-dashboard 통합
[me-dashboard-client.tsx](mvp/src/components/me-dashboard-client.tsx)
- DashboardView 타입에 `"admin-classification"` 추가
- VALID_VIEWS 배열에 추가
- 메뉴 (effectiveAdmin only): "분류 검증" / "🔧 운영자: 분류 검증"
- view 라우팅에 AdminClassificationBrowser mount

## 검증
- `npx tsc --noEmit` production clean.

## 위험
- **override 남발 시 풀 오염**: 운영자가 진짜 accessory를 본품으로 override하면 시세 표본 + 사용자 풀 오염. 운영자 책임. 사유 200자 cap + by/at 추적.
- **score_dirty flag**: PATCH 시 score_dirty=true. 다음 tick에 자동 재처리. 만약 score_dirty 컬럼 의존성이 약하면 (특정 cron만 처리) 즉시 반영 안 될 수도. 측정 필요.
- **운영자 인증**: isAdminUser 게이트만 — admin email 일치 시 모든 매물 fetch + override 가능. 권한 분리는 별도 wave.

## 다음
- 운영자가 첫 검증 사이클 돌려보기 (accessory 10K건 중 false positive 발견)
- override 패턴 통계 → AI prompt / regex 룰 개선
- 권한 분리 (super-admin / verifier 등)
- override audit log 별도 테이블 (현재는 by/at만 컬럼 박힘)
