-- AI L2 cache FK: mvp_listings → mvp_raw_listings
-- preflight: cache_rows_missing_raw = 0 (확인됨)
-- 목적: parsed.needs_review=true row가 mvp_listings에 없을 때도 AI cache 저장 가능
alter table public.mvp_listing_ai_classifications
  drop constraint if exists mvp_listing_ai_classifications_pid_fkey;

alter table public.mvp_listing_ai_classifications
  add constraint mvp_listing_ai_classifications_pid_fkey
  foreign key (pid)
  references public.mvp_raw_listings(pid)
  on delete cascade;
