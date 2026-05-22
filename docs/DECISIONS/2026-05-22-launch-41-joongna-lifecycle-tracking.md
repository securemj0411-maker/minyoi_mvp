# 2026-05-22 — launch-41: joongna lifecycle 추적 활성 (3중 장애 fix + backfill)

## 사용자 짚음
> "ㄱㄱ 다 박아야되는거아님?? 결국 좋은거아님?? 번개장터 처럼 되는거아닌가? 좋은거 아닌가?"

joongna 매물도 bunjang 처럼 lifecycle (sold/disappeared/missing) 추적 활성.

## 진단 — 3중 장애

### 증거 (DB 확인)
- bunjang: raw 298,083 → lifecycle_checks **71,146** (sold 10,723 / disappeared 4,581 추적)
- joongna: raw 3,664 → lifecycle_checks **0** (sold 3건만 — pack-open detail-access 만 마킹)

### 원인 3중

**1. `seedLifecycleChecks` source "bunjang" 하드코딩** (`src/lib/tick-pipeline.ts:735`)
```ts
await insertIgnoreRows("mvp_lifecycle_checks", [...].map((row) => ({
  pid: row.pid,
  source: "bunjang",   // ← 하드코딩
```
mvp_lifecycle_checks.source 컬럼 DDL default 도 'bunjang'.

**2. joongna-ingest 가 seedLifecycleChecks 호출 안 함**
seedLifecycleChecks 호출처 = tick-pipeline.ts 2곳 (bunjang detail-worker stage + bunjang search title-triage). joongna-ingest 0회 호출.

**3. `lifecycleStage` 의 `fetchDetail` 는 bunjang 전용**
`tick-pipeline.ts:3` — `import { fetchDetail } from "@/lib/bunjang"`. joongna pid (7T+ 영역) 던지면 404.

## fix (6단계)

### Step 1: claim RPC migration
`claim_mvp_lifecycle_checks` 가 source / url 도 return (DROP + CREATE — RETURNS TABLE signature 변경).

### Step 2: `LifecycleClaimRow` 타입 update
`source: "bunjang" | "joongna" | string` + `url: string | null` 추가.

### Step 3: `seedLifecycleChecks` source 파라미터화 + export
- `source?: "bunjang" | "joongna"` 파라미터 추가 (default "bunjang" — 기존 호출처 호환)
- `export` 추가 — joongna-ingest 에서 import 사용

### Step 4: `lifecycleTierForParsed` export
joongna-ingest 가 동일 tier 결정 로직 사용.

### Step 5: joongna-ingest 에서 lifecycle seed 호출
- `buildRows` 에 `lifecycleSeedRows` 추가 — active 매물만 seed
- raw_listings upsert 후 `seedLifecycleChecks(lifecycleSeedRows)` 호출 (best-effort)
- 결과 `lifecycleSeeded` metrics 에 박음

### Step 6: `lifecycleStage` source 별 fetch 분기
새 helper `fetchLifecycleDetailBySource`:
- **bunjang**: `fetchDetail` + `detectSoldOut` (기존)
- **joongna**: `fetchJoongnaDetail(row.url)` + `productStatus !== 0` (sale_status_inactive signal) + `soldOutTextHits(title, description)` (description_traded signal)
  - pack-open.ts:1503-1507 의 joongna sold 감지 패턴 통합

### Step 7: 기존 joongna 매물 backfill (SQL)
- 영향: `mvp_lifecycle_checks` 에 **3,678 row** INSERT (NOT EXISTS 가드)
- priority_tier: parsed.comparable_key 기반 결정
  - market_sample: 1,749 (parse_confidence ≥ 0.65 + needs_review false)
  - exploration: 136 (comparable_key 있지만 confidence 낮음)
  - general: 1,793 (comparable_key 없음 — SKU 매칭 X)
- next_check_at: `now() + random() * 30 min` — burst 차단

## 영향

### 코드
- `src/lib/tick-pipeline.ts` (4곳: type, seedLifecycleChecks, lifecycleTierForParsed, fetchLifecycleDetailBySource + import)
- `src/lib/joongna-ingest.ts` (2곳: buildRows + ingestLoop)

### DB
- `claim_mvp_lifecycle_checks` RPC 시그니처 변경 (DROP + CREATE)
- `mvp_lifecycle_checks` 에 joongna row 3,678 추가

### 사용자
- joongna 매물 sold/disappeared/missing 추적 시작
- 사용자가 sold 매물 클릭 risk 해소 (신뢰 박살 leverage)
- joongna 매물도 lifecycle invalidate 되면 자동 풀 제거

## 남은 영역 (별 wave)
- **poolWarmerStage** (`tick-pipeline.ts:4852`) 도 `fetchDetail` bunjang 전용 — joongna pool 매물 처리 시 fail. lifecycle 가 이미 sold 감지하니 critical X 지만 console error 쌓일 수 있음.
- detail-worker stage 의 `fetchDetail` — joongna-ingest 가 자체 detail enrich 하니 큐 안 들어감 (확인됨).

## 메모리 룰
- 일반인 친화: sold 매물 노출 차단 = 신뢰 보존
- 풀 부족 → source 다양화 (Wave 90): joongna lifecycle 정상 작동하면 joongna 매물 안전하게 사용자 풀 유지
- decision log: 이 파일
