-- Wave 1040: membership application review queue.
-- The public application flow now stores an operator-reviewable row instead
-- of only sending a Telegram notification.

create table if not exists public.mvp_membership_applications (
  id bigserial primary key,
  user_ref text not null,
  auth_user_id uuid not null,
  email text,
  display_name text,
  product_key text not null default 'limited_300_3mo',
  price_krw integer not null default 99000,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  applicant_note text,
  admin_note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mvp_membership_applications_pending_user_idx
  on public.mvp_membership_applications (auth_user_id)
  where status = 'pending';

create index if not exists mvp_membership_applications_status_created_idx
  on public.mvp_membership_applications (status, created_at desc);

alter table public.mvp_membership_applications enable row level security;

revoke all on public.mvp_membership_applications from anon;
revoke all on public.mvp_membership_applications from authenticated;
grant select, insert, update, delete on public.mvp_membership_applications to service_role;
grant usage, select on sequence public.mvp_membership_applications_id_seq to service_role;

notify pgrst, 'reload schema';
