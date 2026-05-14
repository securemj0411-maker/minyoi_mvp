-- Wave 93a: Telegram bot 연동 — 사용자 chat_id 매핑.
-- pending_codes는 verify_code(6자리) 발급 → bot에 /start <code> 보내면 매칭 → chat_id 저장.

create table if not exists public.mvp_telegram_bindings (
  user_ref text primary key,
  auth_user_id uuid not null,
  chat_id bigint,
  telegram_username text,
  verify_code text,
  verify_code_expires_at timestamptz,
  verified_at timestamptz,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mvp_telegram_bindings_chat_id_idx
  on public.mvp_telegram_bindings (chat_id) where chat_id is not null;
create index if not exists mvp_telegram_bindings_verify_code_idx
  on public.mvp_telegram_bindings (verify_code) where verify_code is not null;

alter table public.mvp_telegram_bindings enable row level security;
-- RLS: anon ALL false, service_role only (다른 user-facing 테이블 패턴 일치).
-- (DENY_ALL = RLS on + policy 0)
