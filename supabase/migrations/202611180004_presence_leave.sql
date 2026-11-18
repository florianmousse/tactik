begin;
create table public.room_presence (
  room_code text not null,
  user_id uuid not null,
  connection_id uuid not null,
  active boolean not null,
  seen_at timestamptz not null default now(),
  primary key (room_code, user_id, connection_id),
  foreign key (room_code, user_id) references public.room_members(room_code, user_id) on delete cascade
);
alter table public.room_presence enable row level security;
revoke all on public.room_presence from public, anon, authenticated;
grant all on public.room_presence to service_role;

create function public.touch_room_presence(p_code text, p_user uuid, p_connection uuid, p_version integer, p_active boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.game_rooms where code = p_code and version = p_version and expires_at > now() for update;
  if not found then return false; end if;
  if not exists (select 1 from public.room_members where room_code = p_code and user_id = p_user)
    then raise exception 'Not a member'; end if;
  delete from public.room_presence where room_code = p_code and seen_at < now() - interval '2 minutes';
  insert into public.room_presence(room_code, user_id, connection_id, active, seen_at)
    values(p_code, p_user, p_connection, p_active, clock_timestamp())
    on conflict (room_code, user_id, connection_id) do update set active = excluded.active, seen_at = excluded.seen_at;
  delete from public.room_presence where room_code = p_code and user_id = p_user and connection_id in (
    select connection_id from public.room_presence where room_code = p_code and user_id = p_user
    order by seen_at desc, connection_id offset 8
  );
  return true;
end; $$;

create function public.leave_game_room(p_code text, p_user uuid, p_connection uuid, p_version integer, p_state jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.game_rooms where code = p_code and version = p_version and expires_at > now() for update;
  if not found then return false; end if;
  if not exists (select 1 from public.room_members where room_code = p_code and user_id = p_user)
    then raise exception 'Not a member'; end if;
  if not public.commit_game_room(p_code, p_version, p_state) then return false; end if;
  delete from public.room_presence where room_code = p_code and user_id = p_user and connection_id = p_connection;
  return true;
end; $$;
revoke all on function public.touch_room_presence(text,uuid,uuid,integer,boolean), public.leave_game_room(text,uuid,uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.touch_room_presence(text,uuid,uuid,integer,boolean), public.leave_game_room(text,uuid,uuid,integer,jsonb) to service_role;
-- Presence is read through the private API projection, never published to Realtime.
commit;
