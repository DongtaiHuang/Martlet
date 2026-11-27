-- Drift ghosts (migration 034). Run on a disposable migrated database. Fixtures roll back.
begin;

insert into auth.users (id) values ('9c000000-0000-4000-8000-000000000001'), ('9c000000-0000-4000-8000-000000000002');

-- A plausible 90 s path: 900 samples moving 0.2 m per sample along x, score rising to 12,000.
create temp table paths (name text primary key, path smallint[]);
create temp table runs (name text primary key, run uuid);
grant all on paths, runs to authenticated;
insert into paths values
  ('good', (select array_agg(v order by i, k) from generate_series(0, 899) i,
            lateral (values (1, (i * 2)::smallint), (2, 0::smallint), (3, 0::smallint), (4, (i * 1200 / 899)::smallint)) as t(k, v))),
  ('teleport', array[0, 0, 0, 0, 2000, 0, 0, 0]::smallint[] || array_fill(0::smallint, array[32]));

set local role authenticated;

-- A run that's too short is rejected and leaves no ghost.
select set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000001', true);
do $$
declare v_run uuid := public.start_drift_run();
begin
  if public.submit_drift_run(v_run, 12000, 2, (select path from paths where name = 'good')) <> 'rejected' then raise exception 'Short run accepted'; end if;
  if public.get_my_drift_ghost() is not null then raise exception 'Ghost stored for a rejected run'; end if;
end $$;

-- Start a run for each student, then backdate them 90 s as the owner.
insert into runs values ('one', public.start_drift_run());
select set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000002', true);
insert into runs values ('two', public.start_drift_run());
reset role;
update public.drift_runs set started_at = now() - interval '90 seconds';
set local role authenticated;

-- A plausible run becomes a new best and a ghost, with its paint.
select set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000001', true);
do $$ begin
  if public.submit_drift_run((select run from runs where name = 'one'), 12000, 2, (select path from paths where name = 'good')) <> 'new-best' then
    raise exception 'Good run not a new best';
  end if;
  if (public.get_my_drift_ghost()->>'score')::int <> 12000 then raise exception 'Ghost not stored'; end if;
  if (public.get_my_drift_ghost()->>'paint')::int <> 2 then raise exception 'Paint not stored'; end if;
end $$;

-- A teleporting path still scores but stores no ghost. Everyone can list ghosts, nobody can write them.
select set_config('request.jwt.claim.sub', '9c000000-0000-4000-8000-000000000002', true);
do $$ begin
  if public.submit_drift_run((select run from runs where name = 'two'), 0, 0, (select path from paths where name = 'teleport')) <> 'new-best' then
    raise exception 'Score should still count';
  end if;
  if public.get_my_drift_ghost() is not null then raise exception 'Teleporting ghost stored'; end if;
  if jsonb_array_length(public.get_drift_ghosts(5)) <> 1 then raise exception 'Expected one ghost in the list'; end if;
  begin
    insert into public.drift_ghosts (user_id, score, path) values (auth.uid(), 1, array_fill(0::smallint, array[40]));
    raise exception 'Wrote a ghost directly';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
