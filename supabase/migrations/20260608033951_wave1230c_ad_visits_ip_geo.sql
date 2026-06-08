-- Wave 1230c (2026-06-08): 광고 유입 기록에 IP + 지역(Vercel edge geo) 컬럼 추가.
--   관리자 '광고 유입' 모니터에서 기기/IP/지역 확인용.
alter table public.mvp_ad_visits
  add column if not exists ip text,
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists region text;
