# 2026-06-06 Wave 1186 — 당근 피드 6개 멈춤 원인 정리

## 결정
- 당근 피드의 첫 화면은 6개 빠른 응답을 유지하되, 6개를 꽉 채운 quick response는 내부 deep fallback을 탔더라도 `partial` 상태로 내려보낸다.
- 프론트는 `partial` 상태를 받아 30개짜리 백그라운드 이어받기를 계속 수행한다.
- 프로덕션 DB에 누락되어 있던 `mvp_region_feed_snapshots` 테이블과 hot-path 인덱스를 직접 적용했다.

## 이유
- 프로덕션 로그에서 `public.mvp_region_feed_snapshots` 404가 반복되어 지역 피드 캐시가 전혀 동작하지 않는 상태였다.
- 첫 요청이 `limit=6`으로 들어왔고, raw fetch timeout 때문에 deep fallback을 탄 뒤 서버가 `ready / hasMore=false`를 내려 프론트가 나머지 후보를 요청하지 않았다.
- DB에는 같은 동네/예산/당근 조건에서 6개보다 많은 후보가 있었으므로, 선별 데이터 부족이 아니라 feed state contract 버그였다.

## 적용
- `src/app/api/packs/pool/route.ts`
  - quick page가 response page size만큼 채워지면 deep fallback 여부와 관계없이 `phase=quick`, `status=partial`, `shouldRequestContinuation=true`가 되도록 수정.
- 프로덕션 Supabase
  - `mvp_region_feed_snapshots` 생성.
  - snapshot hot/expires index 생성.
  - 당근 raw feed 조회용 partial covering index 2개 생성 및 valid 확인.

## 확인
- `npm run lint -- src/app/api/packs/pool/route.ts` 통과.
- DB 확인 결과 snapshot table과 4개 index 모두 존재.
- raw feed index 2개 모두 `indisvalid=true`.

## 보류
- Supabase migration history가 로컬 migration과 맞지 않아 `supabase db push`는 실패했다. 이번에는 전체 push 대신 idempotent SQL만 직접 적용했다.
- 이후 migration history repair/pull은 별도 정리 작업으로 남긴다.
