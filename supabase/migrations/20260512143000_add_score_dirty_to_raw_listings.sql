-- P0-5: score path를 event-driven으로 전환.
-- 기존 loadScorableRows는 last_seen_at desc로 후보를 뽑아 search touch cadence에 끌려갔다.
-- score_dirty boolean을 두고, raw upsert/detail enrichment/market invalidation 시점에만 true로 마킹한다.
-- scoreStage는 dirty=true인 row만 처리하고 종료 시 false로 내린다.

alter table public.mvp_raw_listings
  add column if not exists score_dirty boolean not null default true;

-- partial index: dirty=true인 활성 후보만 빠르게 찾기 위함. score 종료 시 false로 내리면 인덱스에서 자동 제거.
create index if not exists mvp_raw_listings_score_dirty_idx
  on public.mvp_raw_listings(last_seen_at desc)
  where score_dirty = true;
