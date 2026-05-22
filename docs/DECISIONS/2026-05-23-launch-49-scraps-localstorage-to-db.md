# 2026-05-23 — launch-49: scrap localStorage → DB (hybrid)

## 사용자 짚음
> "2,3 아니 이건 db로 구현해야하는거 아니이임...???"

scrap (즐겨찾기) 가 localStorage 만 박혀있어:
- device 간 sync X (모바일에서 scrap → PC 안 보임)
- logout/login 시 사라짐
- localStorage 5MB 한도 → 매물 100+ scrap 시 fail risk
- 다른 browser/private mode 안 보임

= 사용자 데이터 보호 X. critical.

## fix (3 단계)

### Step 1: DB migration
```sql
CREATE TABLE mvp_user_scraps (
  user_ref text NOT NULL,
  pid bigint NOT NULL,
  pool_item jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_ref, pid)
);
CREATE INDEX mvp_user_scraps_user_ref_created_at_idx
  ON mvp_user_scraps (user_ref, created_at DESC);
ALTER TABLE mvp_user_scraps ENABLE ROW LEVEL SECURITY;
-- service_role 만 access (server-side API 가 auth 검증)
```

### Step 2: API endpoints
`src/app/api/packs/scraps/route.ts` (신규):
- `GET /api/packs/scraps` — 사용자 scrap 목록 (server source)
- `POST /api/packs/scraps` — 매물 scrap 추가 (body: `{ pid, pool_item }` 또는 bulk `{ items: [...] }`)
- `DELETE /api/packs/scraps?pid=X` — scrap 제거

기존 pool route 패턴: `requireSupabaseUser` + `userRefForAuthUser(auth.user.id)` + `restFetch` + `serviceHeaders`.

### Step 3: Frontend hybrid (explore-client.tsx)
**localStorage cache + DB source**:
1. Mount: localStorage 의 scrap 즉시 표시 (빠른 mount + offline fallback)
2. Background: API GET → server source 가 진짜
3. localStorage 에만 있던 매물 (legacy) → API POST bulk import → re-fetch
4. scrap 추가 (`handleScrapToggle`): `postScrapToServer` + localStorage update
5. scrap 제거: `deleteScrapFromServer` + localStorage update

helper functions:
- `fetchServerScraps()` — DB GET
- `postScrapToServer(item)` — fire-and-forget POST
- `deleteScrapFromServer(pid)` — fire-and-forget DELETE
- `importLocalScrapsToServer(items)` — bulk POST (migration)

## 영향

### 코드
- migration 1: `launch_49_mvp_user_scraps`
- 신규 API: `src/app/api/packs/scraps/route.ts`
- 수정: `src/components/explore-client.tsx` (helper + mount + handleScrapToggle)

### 사용자
- 모바일 ↔ PC 동기화 ✅
- logout/login 후 유지 ✅
- 5MB 한도 X (DB)
- 다른 browser/private mode 도 동일 scrap

### Fail-safe
- DB GET fail → localStorage cache 그대로 표시
- POST fail → localStorage 만 update (다음 mount 시 server 와 sync)
- DELETE fail → localStorage 만 update

## Trade-off
- 장점: 진짜 user data 보호
- 단점: scrap 변경 시 network call 1회 추가. fire-and-forget 이라 UX 영향 X.

## 메모리 룰
- 사용자 데이터 = DB. localStorage 는 cache 만.
- decision log: 이 파일
