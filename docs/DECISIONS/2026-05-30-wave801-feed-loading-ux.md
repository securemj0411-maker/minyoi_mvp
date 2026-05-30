# Wave 801 — 메인 피드 로딩 UX (진행바 + 온보딩 prefetch)

- 시간: 2026-05-30 KST
- 트리거: owner — "피드 무거워서 (당근 거리순) 오래걸리는데 게이지 바나 납득할만한 이유 + 첫 가입자 모달 온보딩할 때 미리 prefetch"

## 문제

1. **메인 피드 첫 진입 느림** — 당근 거리 정렬 (Wave 797) 박힌 뒤 ready 풀 거리 계산 비용 발생. 사용자가 보는 건 skeleton + 2 줄 copy ("근처 당근 매물부터 확인 중") — 진행 정도 안 보임 → "멈췄나" 불안감.
2. **온보딩 → 메인 prefetch 안 됨** — 가입 후 홈 동네 onboarding (`/onboarding/home-region`) 완료 → `/me` redirect. 1.1s "확정된 동네 노출" idle time 동안 아무것도 안 함. /me 진입 후 cold start 풀 fetch.

## 변경

### 1. ExploreClient 진행 단계 UI (`src/components/explore-client.tsx`)

기존 loading box (SearchIcon + 2 줄 copy) 위에 추가:
- **Progress bar** (`h-1.5`, blue-100 / blue-500 fill) — 단계×25% 너비
- **4 stage list** — 활성=pulse 파랑, 완료=초록 ✓ + line-through, 미시작=회색
- 단계 라벨 `loadingStages[]` — daangn focused 여부에 따라 분기:
  - **daangn focused** (`source==='daangn'` 또는 `sort==='distance'`):
    1. 내 동네 좌표 확인
    2. 근처 당근 ready 매물 후보 수집
    3. 수익·시세·상태 검증 + AI 차익 산정
    4. 거리 가까운 순으로 정렬
  - **default**:
    1. 오늘 등록된 매물 후보 수집
    2. 수익·시세·상태 검증
    3. AI 차익 산정
    4. 추천 순으로 정렬
- timer 기반 stage 진행 (daangn 모드는 느린 timing — 1200/2800/4500ms vs 700/1800/3200ms)
- daangn focused 시 하단에 안내: "💡 당근 매물은 가까운 동네 순으로 정렬해서 평소보다 시간이 좀 더 걸려요."

stage timer 는 server 진짜 progress 아닌 fake — 빠른 응답 시 stage 1 잠깐, 느린 응답 시 stage 4 잔류. UX 목적은 "멈춘 게 아님" 인지.

### 2. Onboarding prefetch (`src/components/home-region-onboarding.tsx`)

`submitWithToken` 안에 region 저장 성공 후, 1.1s "확정된 동네 노출" 대기 직전:

```ts
const prefetchHeaders = { Authorization: `Bearer ${token}` };
void fetch("/api/packs/pool", { cache: "no-store", headers: prefetchHeaders }).catch(() => undefined);
void fetch("/api/stats/pool", { cache: "no-store", headers: prefetchHeaders }).catch(() => undefined);
```

- **fire-and-forget** — 응답 안 기다림, 실패해도 redirect 진행.
- 두 endpoint 동시 시작 → server-side DB/거리 계산 warm-up.
- `cache: no-store` 라 응답 자체는 재사용 X 이지만 **PostgreSQL buffer pool / 거리 계산 캐시 / 인덱스 hot** 효과로 두 번째 동일 request 빨라짐.
- token 직접 박음 (이미 region 저장에 쓴 동일 token 재활용 — 추가 auth 호출 X).

## 사용 흐름 (변경 후)

### 메인 피드 첫 진입
1. 사용자 / 또는 /me 진입
2. ExploreClient `loading=true`
3. **신규**: Progress bar + 4 stage 표시 (1.2초 마다 다음 단계)
4. /api/packs/pool 응답 → loading=false → 카드 grid

### 가입 후 onboarding → 메인
1. /onboarding/home-region 진입
2. 동네 선택 + POST /api/user/home-region → 200
3. "확정된 동네" 노출 시작
4. **신규**: 백그라운드 fetch /api/packs/pool + /api/stats/pool 시작 (병렬)
5. 1.1s 후 router.push("/me")
6. /me ExploreClient 마운트 → loadPool 호출 → server-side 캐시 hit → 빠른 응답

## Trade-off

### Progress UI = fake progress

- 실제 server 응답이 0.5s 면 stage 1 만 잠깐 깜빡이고 결과 표시 — 정상.
- 5s 걸리면 stage 4 에 머묾 — 멈춘 거 아님 안내.
- SSE / streaming progress 박는 건 over-engineering (응답 한 번이라 의미 X).

### Prefetch 비용

- 사용자당 +1 /api/packs/pool 호출 (onboarding 1 회만).
- /me 의 ExploreClient 도 동일 endpoint 호출 → 결국 호출 2회 (1회는 어차피 필요).
- prefetch 가 미리 완료되면 두 번째는 빠르지만, prefetch 가 진행 중일 때 두 번째 호출 = 동일 DB 작업 2회 동시 (큰 부담 X — 둘 다 SELECT only).
- abusable X (rate-limit 통과 — 가입 직후 1회).

### Prefetch 실패 안전

- catch (() => undefined) 로 prefetch 실패 무시.
- 실패해도 /me 진입 정상 (그 자체로 fetch 다시 함).

## 미해결 / Follow-up

- **server-side cache layer** — /api/packs/pool 응답 캐싱 (per-user, ~30s TTL). 메인 cold start 자체를 줄이는 본질적 fix.
- **distance 계산 indexing** — Wave 797 거리 계산이 매 request 마다 풀 스캔이면 spatial index (gist) 검토.
- **explore-client 진입 시 인기 카테고리만 우선 fetch** — 전체 풀 한 번에 안 받고 progressive load (큰 변경, 별도 wave).

## 검증 흐름

1. `/me` 첫 진입 시 진행바 4 stage 노출 확인 (1.2초 후 stage 2 진행).
2. sort='distance' 또는 source='daangn' 시 stage 라벨 분기 + 하단 안내 확인.
3. onboarding 완료 후 1.1s 대기 중 background fetch 발생 확인 (Network tab).
4. /me 진입 후 fetch 응답 시간 비교 (prefetch 있을 때 vs 없을 때).
