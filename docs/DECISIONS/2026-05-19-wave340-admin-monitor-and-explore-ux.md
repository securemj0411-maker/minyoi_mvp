# 2026-05-19 Wave 340 — 운영자 모니터 + /explore UX 개선

## 운영자 모니터 (Task #11)

### 신규 페이지 `/admin/explore-monitor`
- 매물 풀 상태 (ready 총합 / 6h+ / 6h 미만 / 오늘 invalidated / 오늘 spent)
- 사용자 활동 (오늘 refresh한 사용자 수)
- 카테고리 분포 (bar chart 형식)
- profit_band 분포 (4 단계)

### 신규 API `/api/admin/explore-monitor`
- `requireSupabaseUser` + `isAdminUser` 검증
- 7개 쿼리 병렬 (count + 분포)
- 신규 데이터 수집 없이 기존 DB 쿼리만

운영자가 "/explore 사용량 어떤가" "어떤 카테고리 풀이 약한가" 한눈에 봄.

## /explore UX 개선 (Task #12)

### 카테고리 필터 (8 옵션)
- 이어폰 / 폰 / 태블릿 / 스마트워치 / 노트북 / 신발 / 가방 / 옷
- 다중 선택 (toggle)
- 초기화 버튼
- 변경 시 자동 재로드

### 정렬 옵션 (2)
- 차익 높은순 (default — profit_band desc, expected_profit_max desc)
- 최신순 (last_verified_at desc)
- 변경 시 자동 재로드

### API 확장
- `/api/packs/pool?categories=earphone,smartphone&sort=latest`
- `loadPool` 함수에 옵션 추가
- 카테고리 필터: `category=in.(...)` PostgREST 쿼리
- 정렬: `order=last_verified_at.desc` or default

### Empty state
- 필터 적용 시 빈 결과도 정상 반영 (`items.length === 0` 메시지)

## 변경 파일

신규:
- `src/app/api/admin/explore-monitor/route.ts`
- `src/app/admin/explore-monitor/page.tsx`

수정:
- `src/app/api/packs/pool/route.ts` (categories + sort 파라미터)
- `src/components/explore-client.tsx` (필터/정렬 UI + 자동 재로드)

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 보류 (다음 wave)

- skeleton loading 디자인 개선 (현재 단순 회색 박스 — 카드 모양으로 더 정교하게)
- URL state sync — 카테고리/정렬 선택을 URL params로 (공유 가능)
- 매물 풀 카테고리별 별 알림 (특정 카테고리 새 매물 즉시 알림 — Phase 2 연계)
