# Wave 176 — 운영자 풀 검색 기능 (admin-pool-browser)

> 2026-05-17. 사용자 명령: "운영자 풀에 검색도 가능하게 해줘". /me 페이지 (운영자/베타테스터 노출).

---

## 변경

### UI (`src/components/admin-pool-browser.tsx`)
- `searchDraft` (입력 buffer) + `searchQuery` (실제 fetch 파라미터) state 추가
- Enter 또는 🔍 버튼 / X 클릭으로 typing 끝낸 후만 fetch (per-keystroke fetch 안 함, UX 부담 ↓)
- 검색 chip 표시 (현재 검색어 확인 가능)
- 페이지 자동 리셋 (검색 시 page=1)

### API admin route (`src/app/api/admin/pool-listings/route.ts`)
- `q` 파라미터 추가
- 매칭:
  - `mvp_listings.name` ILIKE `*q*`
  - `mvp_listings.sku_name` ILIKE `*q*`
  - `mvp_listing_parsed.comparable_key` ILIKE `*q*`
  - pid 정확 매칭 (숫자 입력 시)
- 결과 pid set 통합 → `mvp_candidate_pool` 필터
- SKU filter와 함께 박히면 intersect (둘 다 충족)

### API public route (`src/app/api/public/pool-listings/route.ts`)
- 동일 patch — peek-pool-7f3kz9 페이지 (운영자만 보는 별도 endpoint)도 검색 지원

---

## 검색 사용 예

| 입력 | 매칭 |
|---|---|
| `327` | NB 327 매물 (name/sku_name/comparable_key 또는 pid 327) |
| `Gazelle` | 아디다스 Gazelle 매물 (sku_name) |
| `shoe\|nb` | comparable_key 시작 |
| `407280827` | 특정 pid (운영자가 매물 직접 검색) |

---

## 검증

- `npx tsc --noEmit` → 변경 파일 에러 0건
- `npm run test:core` → **325/325 pass / 0 fail**

---

## Trade-off

| 측면 | 영향 |
|---|---|
| API I/O | 검색 시 listings + parsed 두 ILIKE query 추가 (5,000 row limit) |
| URL 길이 | searchPids 5,000건이면 PostgREST `pid=in.(...)` URL 길어짐 — 실제로 검색 결과는 보통 100건 이하 |
| 권한 | admin/public route 둘 다 `requireSupabaseUser` + `isAdminUser || isBetaTester` 게이트 유지 (검색만 추가) |
| UX | typing 마다 fetch 안 함 (Enter/버튼) — 부담 ↓ |

---

## 다른 세션 알아볼 핵심 포인트

1. **2026-05-17 Wave 176**: 운영자 풀 (/me) 통합 검색 — name + sku_name + comparable_key + pid.
2. **API q 파라미터** — admin/public route 양쪽.
3. **UI Enter/🔍 버튼** — per-keystroke fetch X.
4. **SKU filter와 intersect** — 둘 다 박히면 AND 의미.

## Git Commits

```
[next] Wave 176: 운영자 풀 검색 기능 (admin-pool-browser)
```
