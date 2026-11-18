-- Apply after 202611180001_initial.sql. Existing rooms are preserved.
begin;
alter table public.room_events add column chat_revision bigint not null default 0;
create table public.room_messages (
  id uuid primary key,
  room_code text not null references public.game_rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  text text not null check (char_length(btrim(text)) between 1 and 500),
  created_at timestamptz not null default clock_timestamp()
);
create index room_messages_latest on public.room_messages(room_code, created_at desc, id desc);
alter table public.room_messages enable row level security;
revoke all on public.room_messages from public, anon, authenticated;
grant all on public.room_messages to service_role;

create or replace function public.commit_game_room(p_code text, p_version integer, p_state jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.game_rooms set state = p_state, version = version + 1
    where code = p_code and version = p_version and expires_at > now();
  if not found then return false; end if;
  insert into public.room_members(room_code, user_id)
    select p_code, (person->>'id')::uuid from jsonb_array_elements(p_state->'people') person
    where coalesce((person->>'bot')::boolean, false) = false
    on conflict do nothing;
  update public.room_events set version = p_version + 1 where room_code = p_code;
  return true;
end; $$;

create function public.append_room_message(p_code text, p_user uuid, p_id uuid, p_name text, p_text text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.room_members m join public.game_rooms r on r.code = m.room_code
    where m.room_code = p_code and m.user_id = p_user and r.expires_at > now()
  ) then raise exception 'Not a member'; end if;
  -- Serialize messages in one room, without changing the game's CAS version.
  perform 1 from public.room_events where room_code = p_code for update;
  insert into public.room_messages(id, room_code, user_id, name, text)
    values (p_id, p_code, p_user, p_name, p_text) on conflict (id) do nothing;
  if found then
    update public.room_events set chat_revision = chat_revision + 1 where room_code = p_code;
    delete from public.room_messages where room_code = p_code and id in (
      select id from public.room_messages where room_code = p_code order by created_at desc, id desc offset 100
    );
  end if;
end; $$;
revoke all on function public.append_room_message(text,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.append_room_message(text,uuid,uuid,text,text) to service_role;
-- Never publish message bodies or game_rooms to Realtime. Only room_events signals.
commit;
