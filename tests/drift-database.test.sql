-- Martlet Drift leaderboard (migration 022). Run only on a disposable database with all migrations applied.
begin;
create function pg_temp.assert(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Assertion failed: %', what; end if;
end;
$$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected SQLSTATE % from: %', expected, command;
exception when others then
  if sqlstate <> expected then raise; end if;
end;
$$;
create temp table run (id uuid) on commit drop;
grant all on run to authenticated;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000501'), ('00000000-0000-4000-8000-000000000502');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000501', true);

select pg_temp.expect_error($q$select * from public.drift_scores$q$, '42501');
select pg_temp.expect_error($q$insert into public.drift_scores (user_id, best) values (auth.uid(), 5)$q$, '42501');

-- Too quick: a run must last at least 85 s.
insert into run select public.start_drift_run();
select pg_temp.assert(public.submit_drift_score((select id from run), 1000) = 'rejected', 'run too short');
-- A run can't be submitted twice.
select pg_temp.assert(public.submit_drift_score((select id from run), 1000) = 'rejected', 'run already used');

-- A real-length run (its start moved back 95 s).
truncate run;
insert into run select public.start_drift_run();
reset role;
update public.drift_runs set started_at = now() - interval '95 seconds';
set local role authenticated;
select pg_temp.assert(public.submit_drift_score((select id from run), 207001) = 'rejected', 'over the cap');
truncate run;
insert into run select public.start_drift_run();
reset role;
update public.drift_runs set started_at = now() - interval '95 seconds';
set local role authenticated;
select pg_temp.assert(public.submit_drift_score((select id from run), 12000) = 'new-best', 'first score');

-- Not a new best: kept, not lowered.
truncate run;
insert into run select public.start_drift_run();
reset role;
update public.drift_runs set started_at = now() - interval '100 seconds';
set local role authenticated;
select pg_temp.assert(public.submit_drift_score((select id from run), 9000) = 'saved', 'lower score saved, best kept');

-- Someone else's run id doesn't work.
truncate run;
insert into run select public.start_drift_run();
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000502', true);
select pg_temp.assert(public.submit_drift_score((select id from run), 5000) = 'rejected', 'not your run');

-- Leaderboard: names, scores and the caller's rank; no ids.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000501', true);
do $$
declare lb jsonb := public.get_drift_leaderboard(10);
begin
  perform pg_temp.assert((lb->'top'->0->>'score')::int = 12000 and (lb->'top'->0->>'me')::boolean, 'best on the board: ' || lb::text);
  perform pg_temp.assert((lb->'me'->>'rank')::int = 1 and (lb->>'players')::int = 1, 'my rank');
  perform pg_temp.assert(lb::text not like '%00000000-%', 'no user ids');
end $$;

reset role;
set local role anon;
select pg_temp.expect_error($q$select public.start_drift_run()$q$, '42501');

rollback;
