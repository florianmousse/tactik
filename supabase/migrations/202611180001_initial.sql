-- Apply once in Supabase SQL Editor. Every game mutation is server-only.
begin;
create table public.game_rooms (
  code text primary key check (code ~ '^[A-F0-9]{12}$'),
  state jsonb not null,
  version integer not null default 0,
  expires_at timestamptz not null default now() + interval '7 days'
);
create table public.room_members (
  room_code text not null references public.game_rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (room_code, user_id)
);
create table public.room_events (
  room_code text primary key references public.game_rooms(code) on delete cascade,
  version integer not null default 0
);
create table public.rate_limits (
  key text primary key,
  count integer not null,
  resets_at timestamptz not null
);
alter table public.game_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_events enable row level security;
alter table public.rate_limits enable row level security;
revoke all on public.game_rooms, public.room_members, public.room_events, public.rate_limits from public, anon, authenticated;
grant select on public.room_members, public.room_events to authenticated;
grant all on public.game_rooms, public.room_members, public.room_events, public.rate_limits to service_role;
create policy own_membership on public.room_members for select to authenticated using (user_id = (select auth.uid()));
create policy member_signals on public.room_events for select to authenticated using (
  exists (select 1 from public.room_members m where m.room_code = room_events.room_code and m.user_id = (select auth.uid()))
);

create function public.create_game_room(p_code text, p_state jsonb, p_user uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.game_rooms(code, state) values (p_code, p_state);
  insert into public.room_members(room_code, user_id) values (p_code, p_user);
  insert into public.room_events(room_code) values (p_code);
end; $$;

create function public.commit_game_room(p_code text, p_version integer, p_state jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.game_rooms set state = p_state, version = version + 1
    where code = p_code and version = p_version and expires_at > now();
  if not found then return false; end if;
  insert into public.room_members(room_code, user_id)
    select p_code, (person->>'id')::uuid from jsonb_array_elements(p_state->'people') person
    on conflict do nothing;
  update public.room_events set version = p_version + 1 where room_code = p_code;
  return true;
end; $$;

create function public.consume_rate_limit(p_key text, p_max integer, p_seconds integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare hits integer;
begin
  insert into public.rate_limits(key, count, resets_at) values (p_key, 1, now() + make_interval(secs => p_seconds))
  on conflict (key) do update set
    count = case when public.rate_limits.resets_at <= now() then 1 else least(public.rate_limits.count + 1, p_max + 1) end,
    resets_at = case when public.rate_limits.resets_at <= now() then now() + make_interval(secs => p_seconds) else public.rate_limits.resets_at end
  returning count into hits;
  return hits <= p_max;
end; $$;
revoke all on function public.create_game_room(text,jsonb,uuid), public.commit_game_room(text,integer,jsonb), public.consume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.create_game_room(text,jsonb,uuid), public.commit_game_room(text,integer,jsonb), public.consume_rate_limit(text,integer,integer) to service_role;
-- Only a version signal is published. Never add game_rooms to this publication.
alter publication supabase_realtime add table public.room_events;
create index game_rooms_expiration on public.game_rooms(expires_at);
create index rate_limits_expiration on public.rate_limits(resets_at);
commit;
