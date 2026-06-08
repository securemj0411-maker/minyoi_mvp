-- Wave 1230 (2026-06-08): 광고(구글애즈 등) 유입 추적.
--   메인 페이지(server)가 ?src= / utm_* / gclid·gbraid·wbraid 감지 → 1건 기록.
--   RLS on + 정책 없음 = anon/authenticated 차단, service_role 만 read/write.
create table if not exists public.mvp_ad_visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  click_id text,
  click_id_type text,
  landing_path text,
  referer text,
  user_agent text
);
comment on table public.mvp_ad_visits is 'Wave 1230: 광고(구글애즈 등) 유입 추적. Final URL ?src= 또는 gclid/gbraid/wbraid 감지해 서버에서 1건씩 기록. 페이지 렌더 영향 없음(fire-and-forget). 일반 방문은 기록 안 함.';
create index if not exists mvp_ad_visits_created_at_idx on public.mvp_ad_visits (created_at desc);
create index if not exists mvp_ad_visits_source_idx on public.mvp_ad_visits (source);
alter table public.mvp_ad_visits enable row level security;
