-- Martlet Drift live races (ADR 0053): private rooms of up to 4 friends, joined with a 6-letter
-- code, who drive the same 90-second run at the same moment. Cars' positions travel over a private
-- Realtime broadcast channel ("drift-room:<code>") that only the room's members can use; the
-- database keeps the room, its seats and the checked results. Race results don't go on the
-- leaderboard. Run after 035 and 036. Safe to re-run.
begin;

create table if not exists public.drift_rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null references public.profiles(id) on delete cascade,
  track text not null check (track in ('streets', 'campus')),
  status text not null default 'lobby' check (status in ('lobby', 'racing')),
  starts_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.drift_room_players (
  code text not null references public.drift_rooms(code) on delete cascade,
  seat smallint not null check (seat between 1 and 4),
  user_id uuid not null unique references public.profiles(id) on delete cascade, -- one room at a time
  joined_at timestamptz not null default now(),
  score integer check (score between 0 and 207000),
  finished_at timestamptz,
  primary key (code, seat)
);
alter table public.drift_rooms enable row level security;
alter table public.drift_room_players enable row level security;
revoke all on public.drift_rooms, public.drift_room_players from public, anon, authenticated;

-- A race lasts 90 s; results are accepted from 85 s (clock slack) to 5 minutes after the start,
-- and a race is over once everyone has finished or 2½ minutes have passed.
create or replace function public.drift_room_state(p_code text, p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'code', r.code, 'track', r.track, 'host', r.host_id = p_user,
    'status', case
      when r.status = 'lobby' then 'lobby'
      when now() < r.starts_at then 'countdown'
      when now() > r.starts_at + interval '150 seconds'
        or not exists (select 1 from public.drift_room_players x where x.code = r.code and x.finished_at is null) then 'done'
      else 'racing' end,
    'starts_at', r.starts_at, 'server_now', now(),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', p.seat, 'name', coalesce(pr.display_name, 'Martlet Student'), 'me', p.user_id = p_user,
        'host', p.user_id = r.host_id, 'score', p.score, 'finished', p.finished_at is not null
      ) order by p.seat)
      from public.drift_room_players p left join public.profiles pr on pr.id = p.user_id where p.code = r.code), '[]'::jsonb)
  ) from public.drift_rooms r where r.code = p_code;
$$;

create or replace function public.drift_room_leave_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  delete from public.drift_room_players where user_id = p_user returning code into v_code;
  if v_code is null then return; end if;
  if not exists (select 1 from public.drift_room_players where code = v_code) then
    delete from public.drift_rooms where code = v_code;
  else
    update public.drift_rooms set host_id = (select user_id from public.drift_room_players where code = v_code order by seat limit 1)
    where code = v_code and host_id = p_user;
  end if;
end $$;

/** Opens a room on a track with you in seat 1 (leaving any room you were in). */
create or replace function public.create_drift_room(p_track text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_code text; v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if p_track not in ('streets', 'campus') then raise exception 'unknown track' using errcode = '22023'; end if;
  delete from public.drift_rooms where created_at < now() - interval '3 hours';
  if (select count(*) from public.drift_rooms where host_id = v_user and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many rooms' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  perform public.drift_room_leave_user(v_user);
  loop
    v_code := (select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.drift_rooms where code = v_code);
  end loop;
  insert into public.drift_rooms (code, host_id, track) values (v_code, v_user, p_track);
  insert into public.drift_room_players (code, seat, user_id) values (v_code, 1, v_user);
  return public.drift_room_state(v_code, v_user);
end $$;

/** Takes a free seat in a room that hasn't started. Refused when full, started, or anyone there and you have blocked each other. */
create or replace function public.join_drift_room(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_room public.drift_rooms%rowtype; v_seat smallint;
begin
  select * into v_room from public.drift_rooms where code = upper(btrim(p_code)) for update;
  if not found or v_room.created_at < now() - interval '3 hours' then raise exception 'no such room' using errcode = 'P0002'; end if;
  if exists (select 1 from public.drift_room_players where code = v_room.code and user_id = v_user) then
    return public.drift_room_state(v_room.code, v_user);
  end if;
  if v_room.status <> 'lobby' then raise exception 'race started' using errcode = 'P0001', hint = 'started'; end if;
  if exists (select 1 from public.drift_room_players p where p.code = v_room.code and public.blocked_between(v_user, p.user_id)) then
    raise exception 'blocked' using errcode = '42501', hint = 'blocked';
  end if;
  select s into v_seat from generate_series(1, 4) s
  where s not in (select seat from public.drift_room_players where code = v_room.code) order by s limit 1;
  if v_seat is null then raise exception 'room full' using errcode = 'P0001', hint = 'full'; end if;
  perform public.drift_room_leave_user(v_user);
  insert into public.drift_room_players (code, seat, user_id) values (v_room.code, v_seat, v_user);
  return public.drift_room_state(v_room.code, v_user);
end $$;

create or replace function public.leave_drift_room() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.drift_room_leave_user(public.board_require_user());
end $$;

/** Your room, or null. */
create or replace function public.get_drift_room() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.drift_room_state(code, auth.uid()) from public.drift_room_players where user_id = auth.uid();
$$;

/** The host starts the race (2 to 4 players): everyone's run begins 6 seconds from now. */
create or replace function public.start_drift_room() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_room public.drift_rooms%rowtype;
begin
  select r.* into v_room from public.drift_rooms r join public.drift_room_players p on p.code = r.code
  where p.user_id = v_user for update of r;
  if not found then raise exception 'not in a room' using errcode = 'P0002'; end if;
  if v_room.host_id <> v_user then raise exception 'only the host can start' using errcode = '42501'; end if;
  if v_room.status <> 'lobby' then raise exception 'race started' using errcode = 'P0001', hint = 'started'; end if;
  if (select count(*) from public.drift_room_players where code = v_room.code) < 2 then
    raise exception 'need a friend' using errcode = 'P0001', hint = 'alone';
  end if;
  update public.drift_room_players set score = null, finished_at = null where code = v_room.code;
  update public.drift_rooms set status = 'racing', starts_at = now() + interval '6 seconds' where code = v_room.code;
  return public.drift_room_state(v_room.code, v_user);
end $$;

/** The host takes a finished race back to the lobby for a rematch, optionally on another track. */
create or replace function public.rematch_drift_room(p_track text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_room public.drift_rooms%rowtype;
begin
  select r.* into v_room from public.drift_rooms r join public.drift_room_players p on p.code = r.code
  where p.user_id = v_user for update of r;
  if not found then raise exception 'not in a room' using errcode = 'P0002'; end if;
  if v_room.host_id <> v_user then raise exception 'only the host can do that' using errcode = '42501'; end if;
  if p_track not in ('streets', 'campus') then raise exception 'unknown track' using errcode = '22023'; end if;
  if v_room.status = 'racing' and (public.drift_room_state(v_room.code, v_user)->>'status') <> 'done' then
    raise exception 'race in progress' using errcode = 'P0001', hint = 'racing';
  end if;
  update public.drift_room_players set score = null, finished_at = null where code = v_room.code;
  update public.drift_rooms set status = 'lobby', starts_at = null, track = p_track where code = v_room.code;
  return public.drift_room_state(v_room.code, v_user);
end $$;

/**
 * Your result: accepted once, from 85 s after the start, with a replay that passes the ghost checks
 * (ADR 0050) and ends on the score. Returns 'saved', 'rejected' or 'late'.
 */
create or replace function public.finish_drift_race(p_score integer, p_path smallint[]) returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_room public.drift_rooms%rowtype; v_player public.drift_room_players%rowtype;
begin
  select * into v_player from public.drift_room_players where user_id = v_user;
  select * into v_room from public.drift_rooms where code = v_player.code;
  if v_player.code is null or v_room.status <> 'racing' or v_player.finished_at is not null then return 'rejected'; end if;
  if now() < v_room.starts_at + interval '85 seconds' then return 'rejected'; end if;
  if now() > v_room.starts_at + interval '5 minutes' then return 'late'; end if;
  if p_score is null or p_score < 0 or p_score > 207000 or p_path is null
     or cardinality(p_path) not between 40 and 4000 or cardinality(p_path) % 4 <> 0
     or not public.drift_path_plausible(p_path)
     or abs(p_path[cardinality(p_path)] * 10 - p_score) > 10 then
    update public.drift_room_players set finished_at = now() where user_id = v_user; -- finished, no score
    return 'rejected';
  end if;
  update public.drift_room_players set score = p_score, finished_at = now() where user_id = v_user;
  return 'saved';
end $$;

-- Realtime: only a room's members can send or hear on its channel. --------------------------------
create or replace function public.drift_room_topic_member(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.drift_room_players where user_id = auth.uid() and 'drift-room:' || code = p_topic);
$$;

do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "Drift room members hear" on realtime.messages';
    execute $p$create policy "Drift room members hear" on realtime.messages for select to authenticated
      using (realtime.messages.extension = 'broadcast' and public.drift_room_topic_member((select realtime.topic())))$p$;
    execute 'drop policy if exists "Drift room members send" on realtime.messages';
    execute $p$create policy "Drift room members send" on realtime.messages for insert to authenticated
      with check (realtime.messages.extension = 'broadcast' and public.drift_room_topic_member((select realtime.topic())))$p$;
  end if;
end $$;

revoke execute on function public.drift_room_state(text, uuid), public.drift_room_leave_user(uuid) from public, anon, authenticated;
revoke execute on function public.create_drift_room(text), public.join_drift_room(text), public.leave_drift_room(), public.get_drift_room(),
  public.start_drift_room(), public.rematch_drift_room(text), public.finish_drift_race(integer, smallint[]), public.drift_room_topic_member(text)
  from public, anon;
grant execute on function public.create_drift_room(text), public.join_drift_room(text), public.leave_drift_room(), public.get_drift_room(),
  public.start_drift_room(), public.rematch_drift_room(text), public.finish_drift_race(integer, smallint[]), public.drift_room_topic_member(text)
  to authenticated;

commit;
