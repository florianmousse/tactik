-- Apply after 202611180002. Old invitations remain valid.
begin;
alter table public.game_rooms drop constraint game_rooms_code_check;
alter table public.game_rooms add constraint game_rooms_code_check
  check (code ~ '^([A-Z2-9]{8}|[A-F0-9]{12})$');
create or replace function public.commit_game_room(p_code text, p_version integer, p_state jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.game_rooms set state = p_state, version = version + 1
    where code = p_code and version = p_version and expires_at > now();
  if not found then return false; end if;
  delete from public.room_members where room_code = p_code and user_id not in (
    select (person->>'id')::uuid from jsonb_array_elements(p_state->'people') person
    where coalesce((person->>'bot')::boolean, false) = false
  );
  insert into public.room_members(room_code, user_id)
    select p_code, (person->>'id')::uuid from jsonb_array_elements(p_state->'people') person
    where coalesce((person->>'bot')::boolean, false) = false
    on conflict do nothing;
  update public.room_events set version = p_version + 1 where room_code = p_code;
  return true;
end; $$;


create function public.list_public_rooms()
returns table(code text, name text, capacity integer, players integer, jokers boolean)
language sql security invoker set search_path = '' as $$
  select r.code, r.state->'people'->0->>'name', (r.state->>'capacity')::integer,
    jsonb_array_length(r.state->'people'), coalesce((r.state->>'jokers')::boolean, false)
  from public.game_rooms r
  where r.expires_at > now() and r.state->>'public' = 'true'
    and r.state->'game' = 'null'::jsonb
    and jsonb_array_length(r.state->'people') < (r.state->>'capacity')::integer
  order by r.expires_at desc, r.code limit 30;
$$;
revoke all on function public.list_public_rooms() from public, anon, authenticated;
grant execute on function public.list_public_rooms() to service_role;
create index game_rooms_public_expiration on public.game_rooms(expires_at desc)
  where state->>'public' = 'true' and state->'game' = 'null'::jsonb;
create or replace function public.append_room_message(p_code text, p_user uuid, p_id uuid, p_name text, p_text text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  -- Serialize access checks with membership changes and game commits.
  perform 1 from public.game_rooms where code = p_code for update;
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
commit;
