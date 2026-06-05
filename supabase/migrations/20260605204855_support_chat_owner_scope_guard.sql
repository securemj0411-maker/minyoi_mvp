-- Wave 1170 (2026-06-06): harden 1:1 support chat ownership.
-- A support message must belong to the same auth user as its parent
-- conversation. The app routes also filter by both conversation_id and
-- auth_user_id; this constraint keeps future data writes from drifting.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mvp_support_conversations_id_auth_user_unique'
      and conrelid = 'public.mvp_support_conversations'::regclass
  ) then
    alter table public.mvp_support_conversations
      add constraint mvp_support_conversations_id_auth_user_unique
      unique (id, auth_user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mvp_support_messages_conversation_user_fk'
      and conrelid = 'public.mvp_support_messages'::regclass
  ) then
    alter table public.mvp_support_messages
      add constraint mvp_support_messages_conversation_user_fk
      foreign key (conversation_id, auth_user_id)
      references public.mvp_support_conversations(id, auth_user_id)
      on delete cascade;
  end if;
end $$;

drop policy if exists mvp_support_messages_select_own on public.mvp_support_messages;
create policy mvp_support_messages_select_own
  on public.mvp_support_messages
  for select
  to authenticated
  using (
    auth.uid() = auth_user_id
    and exists (
      select 1
      from public.mvp_support_conversations c
      where c.id = mvp_support_messages.conversation_id
        and c.auth_user_id = auth.uid()
    )
  );
