-- Drift live races (migration 037). Run on a disposable migrated database. Fixtures roll back.
begin;

insert into auth.users (id) select ('9f000000-0000-4000-8000-00000000000' || n)::uuid from generate_series(1, 7) n;
create temp table ctx (name text primary key, val text);
create temp table paths (name text primary key, path smallint[]);
grant all on ctx, paths to authenticated;
insert into paths values
  ('good', (select array_agg(v order by i, k) from generate_series(0, 899) i,
            lateral (values (1, (i * 2)::smallint), (2, 0::smallint), (3, 0::smallint), (4, (i * 900 / 899)::smallint)) as t(k, v))),
  ('teleport', (select array_agg(v order by i, k) from generate_series(0, 899) i,
            lateral (values (1, (case when i = 400 then 30000 else i * 2 end)::smallint), (2, 0::smallint), (3, 0::smallint), (4, (i * 500 / 899)::smallint)) as t(k, v)));

-- User 1 opens a room; user 2 joins; only the host can start.
set local role authenticated;
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000001', true);
insert into ctx values ('code', public.create_drift_room('campus')->>'code');
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000002', true);
do $$ declare r jsonb; begin
  r := public.join_drift_room(lower((select val from ctx where name = 'code')));
  if jsonb_array_length(r->'players') <> 2 or (r->>'host')::boolean then raise exception 'Join wrong: %', r; end if;
  if not public.drift_room_topic_member('drift-room:' || (select val from ctx where name = 'code')) then raise exception 'Member refused the channel'; end if;
  begin
    perform public.start_drift_room();
    raise exception 'A guest started the race';
  exception when insufficient_privilege then null; end;
end $$;

-- Someone else can't hear the room's channel; once started, nobody new can join.
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000003', true);
do $$ begin
  if public.drift_room_topic_member('drift-room:' || (select val from ctx where name = 'code')) then raise exception 'Outsider on the channel'; end if;
end $$;
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000001', true);
do $$ begin
  if public.start_drift_room()->>'status' <> 'countdown' then raise exception 'Start should count down'; end if;
  if public.finish_drift_race(100, (select path from paths where name = 'good')) <> 'rejected' then raise exception 'Finished during the countdown'; end if;
end $$;
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000003', true);
do $$ begin
  begin
    perform public.join_drift_room((select val from ctx where name = 'code'));
    raise exception 'Joined a race in progress';
  exception when raise_exception then if sqlerrm <> 'race started' then raise; end if; end;
end $$;

-- 90 seconds later: a real run counts, a teleporting one finishes without a score.
reset role;
update public.drift_rooms set starts_at = now() - interval '90 seconds';
set local role authenticated;
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000001', true);
do $$ begin
  if public.finish_drift_race(9000, (select path from paths where name = 'good')) <> 'saved' then raise exception 'Good run not saved'; end if;
  if public.finish_drift_race(9000, (select path from paths where name = 'good')) <> 'rejected' then raise exception 'Finished twice'; end if;
  if public.get_drift_room()->>'status' <> 'racing' then raise exception 'Race over before everyone finished'; end if;
end $$;
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000002', true);
do $$ declare r jsonb; begin
  if public.finish_drift_race(5000, (select path from paths where name = 'teleport')) <> 'rejected' then raise exception 'Teleport accepted'; end if;
  r := public.get_drift_room();
  if r->>'status' <> 'done' then raise exception 'Race should be done: %', r; end if;
  if (r->'players'->0->>'score')::int <> 9000 or r->'players'->1->'score' <> 'null'::jsonb then raise exception 'Results wrong: %', r; end if;
end $$;

-- Rematch on the street loop; when the host leaves, the next seat hosts.
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000001', true);
do $$ begin
  if public.rematch_drift_room('streets')->>'status' <> 'lobby' then raise exception 'Rematch failed'; end if;
  perform public.leave_drift_room();
  if public.get_drift_room() is not null then raise exception 'Still in the room'; end if;
end $$;
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000002', true);
do $$ begin
  if not (public.get_drift_room()->>'host')::boolean then raise exception 'Host not handed on'; end if;
end $$;

-- Someone who blocked a member (or was blocked) can't join.
reset role;
insert into public.user_blocks (blocker_id, blocked_id) values ('9f000000-0000-4000-8000-000000000002', '9f000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000003', true);
do $$ begin
  begin
    perform public.join_drift_room((select val from ctx where name = 'code'));
    raise exception 'Blocked student joined';
  exception when insufficient_privilege then null; end;
end $$;

-- Four seats: users 4, 5 and 6 fill the room, user 7 is turned away.
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000004', true);
select public.join_drift_room((select val from ctx where name = 'code'));
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000005', true);
select public.join_drift_room((select val from ctx where name = 'code'));
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000006', true);
select public.join_drift_room((select val from ctx where name = 'code'));
select set_config('request.jwt.claim.sub', '9f000000-0000-4000-8000-000000000007', true);
do $$ begin
  begin
    perform public.join_drift_room((select val from ctx where name = 'code'));
    raise exception 'Fifth player joined';
  exception when raise_exception then if sqlerrm <> 'room full' then raise; end if; end;
end $$;

-- The tables are reachable only through the functions.
do $$ begin
  begin
    perform 1 from public.drift_room_players;
    raise exception 'Read players directly';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
