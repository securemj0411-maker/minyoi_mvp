-- Wave 34 — AI cache retention helper view (NOT YET APPLIED).
--
-- 이 migration은 작성만 된 상태이며 production에 apply되지 않았다. Owner sign-off 이후
-- Wave 35에서 apply 예정. 적용 전까지 `scripts/housekeeper-ai-cache-prune-dryrun.ts`는
-- 본 view를 optional 조회하고, 부재 시 R3 sentinel 0을 보고한다.
--
-- 목적: housekeeper가 R3 (content_hash_stale) 후보를 join 없이 단일 SELECT로
-- 측정할 수 있게 한다. mvp_raw_listings에 content_hash 컬럼이 없어 정확한
-- hash drift는 production code (`pipeline.ts:contentHash`)에서만 계산 가능 →
-- DB 측 view는 proxy 기반:
--   - mvp_raw_listings.source_updated_at 이 cache.classified_at 보다 14일 이상 이후로
--     갱신된 경우, 원 매물의 본문이 실질적으로 바뀐 신호로 본다.
--   - mvp_raw_listings 자체가 사라진 경우 (FK CASCADE로 일반적으로 0이지만 sentinel용).
--   - 또한 30일 절대 age cutoff (R1) 동시 reporting.
--
-- 이 view는 retention 결정의 단일 진실 원천이 아니다. production housekeeper가
-- view에서 후보 목록을 받고, code-level contentHash 재계산으로 false positive를
-- 1차 거른 뒤 DELETE 한다.

create or replace view public.mvp_listing_ai_cache_retention_v1 as
with cache as (
  select
    a.pid,
    a.content_hash,
    a.classified_at,
    a.model,
    a.cost_usd
  from public.mvp_listing_ai_classifications a
),
raw as (
  select pid, source_updated_at, last_seen_at
  from public.mvp_raw_listings
)
select
  cache.pid,
  cache.content_hash,
  cache.classified_at,
  cache.model,
  cache.cost_usd,
  raw.source_updated_at,
  raw.last_seen_at,
  -- R1: 30일 절대 age cutoff
  (cache.classified_at < (now() - interval '30 days')) as r1_stale_by_age,
  -- R2: raw row 부재 (FK CASCADE로 정상적으론 0)
  (raw.pid is null) as r2_raw_row_gone,
  -- R3: raw가 cache 이후 14일 이상 갱신됨 (proxy for content_hash drift)
  (
    raw.source_updated_at is not null
    and raw.source_updated_at > (cache.classified_at + interval '14 days')
  ) as r3_raw_updated_after_classify
from cache
left join raw on raw.pid = cache.pid;

comment on view public.mvp_listing_ai_cache_retention_v1 is
  'Wave 34 AI cache retention candidates. R1/R2/R3 booleans for housekeeper-ai-cache-prune. Not authoritative — production code reconciles via contentHash before DELETE.';

-- grant: service_role만 사용한다.
grant select on public.mvp_listing_ai_cache_retention_v1 to service_role;
