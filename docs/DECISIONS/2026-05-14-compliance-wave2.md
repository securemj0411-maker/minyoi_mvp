# 2026-05-14 Compliance Wave 2 — 셀러 정보 hashing + 닉네임 폐기

> 배경: Wave 1.1 마감 후 사용자가 다음 wave 결정 — 개보법 위험 (셀러 닉네임 평문 보유) 즉시 제거.
> 셀러 한 명의 신고만으로 시정명령 트리거 가능 → 분쟁 발생 자체를 막는 wave (Wave 3/4는 분쟁 후 손해 줄이는 wave).
> 4 phase (2C → 2A → 2B → 2D)로 안전 우선 진행.

---

## 결정 — 셀러 정보 처리 방향

- 시간: 2026-05-14
- 발견:
  - `mvp_raw_listings.seller_uid`/`seller_name`, `mvp_sellers.seller_uid`/`seller_name`, `mvp_listing_observations.seller_uid` 평문 저장 중
  - 코드 의존도 grep:
    - `seller_uid`는 [market-math.ts:27](mvp/src/lib/market-math.ts:27)에서 시세 dedup 키 (`seller:${uid}`). 같은 셀러 매물 중복 카운트 방지. 식별만 가능하면 됨 → hash로 호환
    - `seller_name`은 처음에 "UI 어디서도 안 씀"이라 판단했으나 검증 후 **3군데 UI/API 경로 사용** 발견:
      - [pack-reveal-modal.tsx:168-172](mvp/src/components/pack-reveal-modal.tsx:168): 팩 오픈 모달의 셀러 닉네임 chip
      - [user-reveal-dashboard.tsx:18, 240, 293](mvp/src/components/user-reveal-dashboard.tsx:18): RevealItem 타입 + passing + fallback
      - [packs/me/route.ts:201, 233-234](mvp/src/app/api/packs/me/route.ts:201): API select + 응답에 박음
    - 단 [pack-open.ts:600-645](mvp/src/lib/pack-open.ts:600) `loadRevealListingDetail`이 **사용자 클릭마다 실시간 fetchDetail 호출** → 정상 동작 시 DB seller_name 사용 안 함. fallback 시에만 사용
- 결정:
  - `seller_uid` → SHA-256 hash + `sha256:` prefix (idempotent). dedup 동작 보존
  - `seller_name` 컬럼 완전 폐기 (mvp_sellers, mvp_raw_listings 둘 다 DROP)
  - frontend chip 표시 제거 (정상 동작 시 영향 0, fallback 시 chip 1개 사라짐)
- 위험:
  - market-math.ts dedup: 같은 raw → 같은 hash → 동일 키. 코드 머지와 백필 atomic 처리 필요 (혼재 시 dedup 깨짐)
  - mvp_sellers PK (source, seller_uid): seller_uid update는 update constraint OK. FK 없음 (다른 테이블 reference X)
  - SHA-256 충돌 사실상 불가 (2^256)
  - hash → raw uid 복구 불가능. drop된 컬럼 복구 불가능 → **백필 전 supabase 백업 가정**
- 안전한 진행 순서:
  - **Phase 2C (Frontend 먼저)**: sellerName 표시·API select 제거 → DB 변경 전 → UI backward-compatible
  - **Phase 2A (Code hash)**: bunjang.ts fetch 시점 hash → 신규 데이터부터 hash 저장
  - **Phase 2B (Backfill)**: 기존 raw → hash 일괄 변환 → atomic이므로 dedup 깨짐 최소
  - **Phase 2D (Column drop)**: 코드 정리 끝난 후 seller_name 컬럼 폐기

---

## 적용 1 — Phase 2C Frontend 정리

- 변경:
  - [pack-reveal-modal.tsx:168-172](mvp/src/components/pack-reveal-modal.tsx:168): sellerName chip 표시 블록 제거 (rating chip은 그대로 유지)
  - [packs/me/route.ts:201](mvp/src/app/api/packs/me/route.ts:201): select에서 `seller_uid, seller_name` 제거
  - [packs/me/route.ts:35-52](mvp/src/app/api/packs/me/route.ts:35): `RawRow` 타입에서 `seller_uid`, `seller_name` 필드 제거
  - [packs/me/route.ts:232-233](mvp/src/app/api/packs/me/route.ts:232): 응답에서 `sellerUid: null, sellerName: null` (타입 호환 위해 null 박음)
  - `RevealItem` 타입의 sellerUid/sellerName 필드는 유지 (null로만 채워짐 — frontend type 호환)
- 검증: `npx tsc --noEmit` clean
- 위험: 없음. fallback 시 chip 1개 사라짐 (정상 fetch 시 어차피 실시간 detail 사용)

---

## 적용 2 — Phase 2A Hash helper + bunjang.ts fetch 시점 hash

- 변경:
  - 신규 파일 [src/lib/compliance-hashing.ts](mvp/src/lib/compliance-hashing.ts): `hashSellerUid()` Node crypto SHA-256 + `sha256:` prefix
    - idempotent (이미 prefix 있으면 그대로 반환) → 백필 재실행 안전
    - 단일 helper로 향후 다른 hash 작업도 모음
  - [bunjang.ts:3](mvp/src/lib/bunjang.ts:3): `import { hashSellerUid }` 추가
  - [bunjang.ts:139](mvp/src/lib/bunjang.ts:139): `sellerUid: hashSellerUid(stringOrNull(item.uid))` — 검색 결과 hash
  - [bunjang.ts:204-205](mvp/src/lib/bunjang.ts:204): `shopUid: hashSellerUid(...)`, `shopName: null` — 상세 결과 hash + 이름 항상 null
  - [pack-open.ts:632-633](mvp/src/lib/pack-open.ts:632): `seller.name: null` (`detail.shopName` 사용 중단)
  - `DetailData.shopName` 타입은 string | null 유지 (호환성). 다른 코드에서 detail.shopName 접근 시 항상 null 반환됨
- 검증: tsc clean
- 위험: 코드 머지부터 백필 사이에 새 매물 수집되면 hash 저장 → 기존 raw와 혼재 → dedup 일시 깨짐. Phase 2B 직후 즉시 진행해서 시간 최소화 (atomic)

---

## 적용 3 — Phase 2B DB backfill

- 변경: supabase migration `compliance_wave2_seller_hashing_backfill` 적용 (apply_migration 성공)
- SQL:
  ```sql
  create extension if not exists pgcrypto;
  
  update public.mvp_sellers set seller_uid = 'sha256:' || encode(digest(seller_uid, 'sha256'), 'hex'), updated_at = now()
    where seller_uid is not null and seller_uid <> '' and seller_uid not like 'sha256:%';
  
  update public.mvp_raw_listings set seller_uid = 'sha256:' || encode(digest(seller_uid, 'sha256'), 'hex'), updated_at = now()
    where seller_uid is not null and seller_uid <> '' and seller_uid not like 'sha256:%';
  
  update public.mvp_listing_observations set seller_uid = 'sha256:' || encode(digest(seller_uid, 'sha256'), 'hex')
    where seller_uid is not null and seller_uid <> '' and seller_uid not like 'sha256:%';
  
  update public.mvp_raw_listings set seller_name = null, updated_at = now() where seller_name is not null;
  update public.mvp_sellers set seller_name = null, updated_at = now() where seller_name is not null;
  ```
- 검증 — 사전 count:
  | 테이블 | 변환 대상 raw_count | hashed_count | seller_name 데이터 |
  |---|---:|---:|---:|
  | mvp_sellers | 21,694 | 0 | 6,664 |
  | mvp_raw_listings | 37,984 | 0 | 13,184 |
  | mvp_listing_observations | 141,810 | 0 | (컬럼 없음) |
- 검증 — 사후 count:
  | 테이블 | remaining_raw | hashed | remaining_name |
  |---|---:|---:|---:|
  | mvp_sellers | 0 | 21,694 | 0 |
  | mvp_raw_listings | 0 | 37,984 | 0 |
  | mvp_listing_observations | 0 | 141,810 | 0 |
- 결과: 모든 raw 데이터 hash 변환 완료. seller_name 모두 NULL 처리 완료. atomic 적용 (단일 migration transaction)
- 위험: PK update 시 충돌 가능성 — 발생 0건 (SHA-256 충돌 사실상 불가)

---

## 적용 4 — Phase 2D 컬럼 drop + 코드 cleanup

먼저 tick-pipeline.ts에서 컬럼 drop 후 INSERT 에러 방지 위해 unused 라인 정리. **"tick-pipeline.ts 0줄" 원칙은 새 로직 추가 금지 정신이고, 본 변경은 deletion만 (정합성 cleanup)**. 사용자 검토 후 진행.

- 변경 (deletion only, 5줄):
  - [tick-pipeline.ts:386](mvp/src/lib/tick-pipeline.ts:386): `seller_name: row.seller_name ?? existing?.seller_name,` 제거 (upsert payload)
  - [tick-pipeline.ts:1497](mvp/src/lib/tick-pipeline.ts:1497): `seller_name: detail.shopName,` 제거 (raw_listings update)
  - [tick-pipeline.ts:1563](mvp/src/lib/tick-pipeline.ts:1563): 동일
  - [tick-pipeline.ts:1584](mvp/src/lib/tick-pipeline.ts:1584): `seller_name: detail.shopName,` 제거 (mvp_sellers upsert)
  - [tick-pipeline.ts:152](mvp/src/lib/tick-pipeline.ts:152): `seller_name?: string | null;` SellerUpsertRow 타입 필드 제거 (unused)
- SQL migration `compliance_wave2_drop_seller_name_columns` 적용:
  ```sql
  alter table public.mvp_raw_listings drop column if exists seller_name;
  alter table public.mvp_sellers drop column if exists seller_name;
  ```
- schema.sql sync (3 라인 deletion):
  - [schema.sql:80](mvp/supabase/schema.sql:80): mvp_sellers의 `seller_name text,` 제거
  - [schema.sql:117](mvp/supabase/schema.sql:117): mvp_raw_listings의 `seller_name text,` 제거
  - [schema.sql:153](mvp/supabase/schema.sql:153): alter table의 `add column if not exists seller_name text,` 제거
- 검증:
  - `npx tsc --noEmit` clean
  - `information_schema.columns where column_name = 'seller_name'` → 0 row (어디에도 없음)
  - `grep -r "seller_name" src/ supabase/` → 0 매칭

---

## 안전성 종합 평가

| 영역 | 변경 | 영향 |
|---|---|---|
| `tick-pipeline.ts` 핫패스 | 5줄 deletion만 (`seller_name` 4 + type 1) | 로직 변경 0, 정합성 cleanup |
| `pipeline.ts` / `option-parser.ts` / `catalog.ts` / `market-math.ts` | 0줄 | 영향 0 |
| market-math dedup | `seller:${uid}` 그대로 — uid가 hash로 바뀌어도 같은 셀러는 같은 키 | 동작 동일 ✓ |
| 시세/회전률 계산 | `observations.price`/`market_*_daily` 변경 없음 | 영향 0 ✓ |
| 점수 계산 | `shop_review_rating`/`shop_review_count` 보존 | 영향 0 ✓ |
| 사용자 카드 노출 | sellerName chip 제거. 정상 fetch 시 실시간 detail에서 다 가져옴 | UI 정보 손실 미미 |
| fallback UI | sellerName이 null → chip 안 보임. 단지 chip 1개 사라짐 | 미미 |
| AI L2 review | seller 정보 의존 안 함 | 영향 0 ✓ |

검증:
- `npx tsc --noEmit` clean
- Phase 2B 사후 count 모두 0 raw / 일치 hashed
- Phase 2D 후 information_schema에 seller_name 0 row

---

## Rollback

| Level | 방법 | 복구 가능 |
|---|---|---|
| 1. cron/code rollback | 신규 파일 (`compliance-hashing.ts`) 삭제 + bunjang.ts 3줄 revert + tick-pipeline.ts 5줄 restore | ✓ |
| 2. seller_uid hash 역변환 | **불가능** — SHA-256은 단방향. 원본 raw uid 복구 X | ❌ |
| 3. seller_name 컬럼 복구 | alter table add column 가능 but 데이터는 영구 손실 | ❌ (스키마만) |

→ Phase 2B 이후는 사실상 **point of no return**. 사전 supabase 백업 가정. 진행 후 추가 변경 시에는 hash 값 그대로 사용 가능 (idempotent).

---

## 변경 정리

- 신규 파일:
  - `src/lib/compliance-hashing.ts` (Phase 2A)
- 수정 파일:
  - `src/lib/bunjang.ts` (Phase 2A: import + 2줄 patch)
  - `src/lib/pack-open.ts` (Phase 2A: 1줄 patch)
  - `src/lib/tick-pipeline.ts` (Phase 2D: 5줄 deletion — 로직 변경 0, 정합성 cleanup)
  - `src/components/pack-reveal-modal.tsx` (Phase 2C: sellerName chip 블록 제거)
  - `src/app/api/packs/me/route.ts` (Phase 2C: select + RawRow 타입 + 응답 정리)
  - `supabase/schema.sql` (Phase 2D: 3줄 deletion, DB와 sync)
- Supabase migration:
  - `compliance_wave2_seller_hashing_backfill` (Phase 2B)
  - `compliance_wave2_drop_seller_name_columns` (Phase 2D)
- 외부 영향:
  - production deploy 후 즉시 적용 (DB는 이미 변경됨)
  - vercel cron 미변경 (이 wave에서 추가 cron 없음)
  - 첫 cron 호출 시 새 매물은 hash로 들어옴

---

## 다음 — 별도 wave로 미루는 항목 (이 wave 마감, 추가 변경 없음)

- **Compliance Wave 1.2**: dead 매물 `thumbnail_url`/`image_url_template` 30일 TTL — 이미 hot-link만 사용 중이라 저작권 위험 0, 우선순위 낮음
- **Compliance Wave 3**: Rate Limit 평시 cron 200→1500ms + 시간대 02-06시 회피 + robots.txt fetch + 로그 보존 — 분쟁 시 "선의" 입증 자료 확보
- **Compliance Wave 4**: 코드 변수명/문서 sweep (`crawl`/`수집`/`우회`/`차단 회피` → `시세 모니터링`/`대체 경로`/`안정성 확보`) — 분쟁 시 증거력 약화
- **법률의견서 발주**: 매뉴얼 P0 권고. 200~500만원, 1개월. 코드 wave와 별도 병렬 진행
