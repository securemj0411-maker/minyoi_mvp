-- Wave 1104 (2026-06-05): 1:1 customer support chat.
-- Client writes go through Next.js API routes with service_role.
-- Authenticated clients only get SELECT on their own rows so Supabase Realtime
-- postgres_changes can deliver their own support messages.

create table if not exists public.mvp_support_conversations (
  id bigserial primary key,
  auth_user_id uuid not null,
  user_ref text not null,
  user_email text,
  user_display_name text,
  subject text not null default '1대1 고객상담',
  status text not null default 'open',
  admin_unread_count integer not null default 0,
  user_unread_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  last_user_message_at timestamptz,
  last_admin_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mvp_support_conversations_status_chk
    check (status in ('open', 'closed'))
);

create table if not exists public.mvp_support_messages (
  id bigserial primary key,
  conversation_id bigint not null references public.mvp_support_conversations(id) on delete cascade,
  auth_user_id uuid not null,
  sender text not null,
  body text not null,
  admin_name text,
  created_at timestamptz not null default now(),
  constraint mvp_support_messages_sender_chk
    check (sender in ('user', 'admin', 'system')),
  constraint mvp_support_messages_body_len_chk
    check (char_length(body) between 1 and 2000)
);

create index if not exists mvp_support_conversations_user_open_idx
  on public.mvp_support_conversations(auth_user_id, status, last_message_at desc);

create index if not exists mvp_support_conversations_admin_queue_idx
  on public.mvp_support_conversations(status, last_message_at desc);

create index if not exists mvp_support_messages_conversation_idx
  on public.mvp_support_messages(conversation_id, created_at asc);

create index if not exists mvp_support_messages_user_created_idx
  on public.mvp_support_messages(auth_user_id, created_at desc);

alter table public.mvp_support_conversations enable row level security;
alter table public.mvp_support_messages enable row level security;

drop policy if exists mvp_support_conversations_select_own on public.mvp_support_conversations;
create policy mvp_support_conversations_select_own
  on public.mvp_support_conversations
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists mvp_support_messages_select_own on public.mvp_support_messages;
create policy mvp_support_messages_select_own
  on public.mvp_support_messages
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

grant select on public.mvp_support_conversations to authenticated;
grant select on public.mvp_support_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'mvp_support_messages'
    )
  then
    alter publication supabase_realtime add table public.mvp_support_messages;
  end if;
end $$;
