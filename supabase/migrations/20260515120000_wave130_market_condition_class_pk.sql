-- Wave 130 (2026-05-15): mvp_market_price_daily / mvp_market_velocity_daily 에 condition_class 컬럼 추가 + PK 3-col 변경.
--
-- 배경: 시세 분석을 condition별로 분리 (mint/clean/normal/worn/low_batt/unopened).
-- 이전: PK = (date, comparable_key) — 모든 condition 평균 1 row
-- 이후: PK = (date, comparable_key, condition_class) — condition별 row 분리
--
-- 이 파일은 file 추적용 (idempotent). DB에는 이미 박혀 있음 — 2026-05-19 schema drift 발견 후 추가 박음.
-- 새 환경 setup 시 schema.sql만으로는 PK 일치 안 되는 문제 해소.
--
-- 5/16 incident: 이 PK 변경 후 legacy `condition_class='all'` row 1559건 DELETE → historical 1559일치 시세 영영 잃음.
--   해당 사고 결정 로그: docs/DECISIONS/2026-05-16-incident-market-price-daily-historical-loss.md

-- ============================================================
-- 1) mvp_market_price_daily — condition_class 컬럼 + PK migration
-- ============================================================
do $$
begin
  -- column add (이미 있으면 skip)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mvp_market_price_daily'
      and column_name = 'condition_class'
  ) then
    alter table public.mvp_market_price_daily
      add column condition_class text not null default 'all';
  end if;

  -- PK migration (이미 3-col이면 skip)
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mvp_market_price_daily'::regclass
      and conname = 'mvp_market_price_daily_pkey'
      and array_length(conkey, 1) = 2
  ) then
    alter table public.mvp_market_price_daily
      drop constraint mvp_market_price_daily_pkey;
    alter table public.mvp_market_price_daily
      add constraint mvp_market_price_daily_pkey
      primary key (date, comparable_key, condition_class);
  end if;
end $$;

-- ============================================================
-- 2) mvp_market_velocity_daily — 동일 패턴
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mvp_market_velocity_daily'
      and column_name = 'condition_class'
  ) then
    alter table public.mvp_market_velocity_daily
      add column condition_class text not null default 'all';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mvp_market_velocity_daily'::regclass
      and conname = 'mvp_market_velocity_daily_pkey'
      and array_length(conkey, 1) = 2
  ) then
    alter table public.mvp_market_velocity_daily
      drop constraint mvp_market_velocity_daily_pkey;
    alter table public.mvp_market_velocity_daily
      add constraint mvp_market_velocity_daily_pkey
      primary key (date, comparable_key, condition_class);
  end if;
end $$;
