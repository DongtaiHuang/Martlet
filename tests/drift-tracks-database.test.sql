-- Drift tracks (migration 036). Run on a disposable migrated database. Fixtures roll back.
begin;

insert into auth.users (id) values ('9e000000-0000-4000-8000-000000000001');
create temp table runs (name text primary key, run uuid);
create temp table paths (name text primary key, path smallint[]);
grant all on runs, paths to authenticated;
insert into paths values
  ('good', (select array_agg(v order by i, k) from generate_series(0, 899) i,
            lateral (values (1, (i * 2)::smallint), (2, 0::smallint), (3, 0::smallint), (4, (i * 900 / 899)::smallint)) as t(k, v)));

set local role authenticated;
select set_config('request.jwt.claim.sub', '9e000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin
    perform public.start_drift_run('rally-cross');
    raise exception 'Started a run on an unknown track';
  exception when invalid_parameter_value then null; end;
end $$;

-- A streets run, scored and backdated, then a campus run.
insert into runs values ('streets', public.start_drift_run());
reset role;
update public.drift_runs set started_at = now() - interval '90 seconds';
set local role authenticated;
select set_config('request.jwt.claim.sub', '9e000000-0000-4000-8000-000000000001', true);
select public.submit_drift_score((select run from runs where name = 'streets'), 15000);

insert into runs values ('campus', public.start_drift_run('campus'));
reset role;
update public.drift_runs set started_at = now() - interval '90 seconds';
set local role authenticated;
select set_config('request.jwt.claim.sub', '9e000000-0000-4000-8000-000000000001', true);
do $$ begin
  if public.submit_drift_run((select run from runs where name = 'campus'), 9000, 1, (select path from paths where name = 'good')) <> 'new-best' then
    raise exception 'Campus run not a new best (a lower score than streets must still be a best on its own track)';
  end if;
  -- Each track has its own board and ghosts; the old signatures mean streets.
  if (public.get_drift_leaderboard(10, 'streets')->'me'->>'score')::int <> 15000 then raise exception 'Streets board wrong'; end if;
  if (public.get_drift_leaderboard(10, 'campus')->'me'->>'score')::int <> 9000 then raise exception 'Campus board wrong'; end if;
  if (public.get_drift_leaderboard()->'me'->>'score')::int <> 15000 then raise exception 'Old signature should mean streets'; end if;
  if jsonb_array_length(public.get_drift_ghosts(5, 'campus')) <> 1 then raise exception 'Campus ghost missing'; end if;
  if jsonb_array_length(public.get_drift_ghosts(5, 'streets')) <> 0 then raise exception 'Ghost landed on the wrong track'; end if;
  if (public.get_my_drift_ghost('campus')->>'score')::int <> 9000 then raise exception 'My campus ghost missing'; end if;
end $$;

rollback;
