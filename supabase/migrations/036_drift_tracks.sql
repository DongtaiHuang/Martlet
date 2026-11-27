-- Martlet Drift tracks (ADR 0052): the street loop and a campus loop, each with its own
-- leaderboard and ghosts. Existing scores, runs and ghosts become the street loop's. The old
-- function signatures keep meaning "streets", so an older app still works. Run after 034.
-- Safe to re-run.
begin;

alter table public.drift_scores add column if not exists track text not null default 'streets';
alter table public.drift_runs add column if not exists track text not null default 'streets';
alter table public.drift_ghosts add column if not exists track text not null default 'streets';
alter table public.drift_scores drop constraint if exists drift_scores_track_check;
alter table public.drift_scores add constraint drift_scores_track_check check (track in ('streets', 'campus'));
alter table public.drift_runs drop constraint if exists drift_runs_track_check;
alter table public.drift_runs add constraint drift_runs_track_check check (track in ('streets', 'campus'));
alter table public.drift_ghosts drop constraint if exists drift_ghosts_track_check;
alter table public.drift_ghosts add constraint drift_ghosts_track_check check (track in ('streets', 'campus'));

-- One best score and one ghost per student per track. (drift_runs keeps one open run per student.)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'drift_scores_pkey' and pg_get_constraintdef(oid) like '%track%') then
    alter table public.drift_scores drop constraint if exists drift_scores_pkey;
    alter table public.drift_scores add constraint drift_scores_pkey primary key (user_id, track);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'drift_ghosts_pkey' and pg_get_constraintdef(oid) like '%track%') then
    alter table public.drift_ghosts drop constraint if exists drift_ghosts_pkey;
    alter table public.drift_ghosts add constraint drift_ghosts_pkey primary key (user_id, track);
  end if;
end $$;
drop index if exists public.drift_scores_best_idx;
create index drift_scores_best_idx on public.drift_scores (track, best desc, updated_at);

create or replace function public.drift_track_ok(p_track text) returns boolean
language sql immutable set search_path = '' as $$ select p_track in ('streets', 'campus'); $$;

-- Runs -------------------------------------------------------------------------------------------
create or replace function public.start_drift_run(p_track text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_run uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not public.drift_track_ok(p_track) then raise exception 'unknown track' using errcode = '22023'; end if;
  insert into public.drift_runs (user_id, run_id, started_at, track) values (auth.uid(), v_run, now(), p_track)
  on conflict (user_id) do update set run_id = excluded.run_id, started_at = excluded.started_at, track = excluded.track;
  return v_run;
end $$;
create or replace function public.start_drift_run() returns uuid
language sql security definer set search_path = '' as $$ select public.start_drift_run('streets'); $$;

-- 022's checks, scored on the run's own track.
create or replace function public.submit_drift_score(p_run uuid, p_score integer) returns text
language plpgsql security definer set search_path = '' as $$
declare v_started timestamptz; v_track text; v_seconds numeric;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  delete from public.drift_runs where user_id = auth.uid() and run_id = p_run returning started_at, track into v_started, v_track;
  if v_started is null or p_score is null or p_score < 0 or p_score > 207000 then return 'rejected'; end if;
  v_seconds := extract(epoch from now() - v_started);
  if v_seconds < 85 or v_seconds > 900 then return 'rejected'; end if;
  insert into public.drift_scores (user_id, track, best, updated_at) values (auth.uid(), v_track, p_score, now())
  on conflict (user_id, track) do update set best = excluded.best, updated_at = excluded.updated_at
    where public.drift_scores.best < excluded.best;
  return case when found then 'new-best' else 'saved' end;
end $$;

-- 034's ghost keeping, on the run's track.
create or replace function public.submit_drift_run(p_run uuid, p_score integer, p_paint integer, p_path smallint[]) returns text
language plpgsql security definer set search_path = '' as $$
declare v_result text; v_track text;
begin
  select track into v_track from public.drift_runs where user_id = auth.uid() and run_id = p_run;
  v_result := public.submit_drift_score(p_run, p_score);
  if v_result = 'new-best' and v_track is not null and p_path is not null
     and cardinality(p_path) between 40 and 4000 and cardinality(p_path) % 4 = 0
     and public.drift_path_plausible(p_path)
     and abs(p_path[cardinality(p_path)] * 10 - p_score) <= 10 then
    insert into public.drift_ghosts (user_id, track, score, paint, path, updated_at)
    values (auth.uid(), v_track, p_score, least(greatest(coalesce(p_paint, 0), 0), 15), p_path, now())
    on conflict (user_id, track) do update set score = excluded.score, paint = excluded.paint, path = excluded.path, updated_at = now();
  end if;
  return v_result;
end $$;

-- Reading, per track -----------------------------------------------------------------------------
create or replace function public.get_drift_leaderboard(p_limit integer, p_track text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ranked as (
    select s.user_id, s.best, s.updated_at, coalesce(p.display_name, 'Martlet Student') as name,
           rank() over (order by s.best desc) as rank
    from public.drift_scores s left join public.profiles p on p.id = s.user_id
    where s.best > 0 and s.track = p_track
  )
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', rank, 'name', name, 'score', best, 'me', user_id = auth.uid()) order by rank, updated_at)
                     from (select * from ranked order by rank, updated_at limit least(greatest(p_limit, 1), 50)) t), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', rank, 'score', best) from ranked where user_id = auth.uid()),
    'players', (select count(*) from ranked)
  );
$$;
create or replace function public.get_drift_leaderboard(p_limit integer default 10) returns jsonb
language sql stable security definer set search_path = '' as $$ select public.get_drift_leaderboard(p_limit, 'streets'); $$;

create or replace function public.get_drift_ghosts(p_limit integer, p_track text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', coalesce(p.display_name, 'Martlet Student'), 'score', g.score, 'paint', g.paint, 'path', g.path, 'me', g.user_id = auth.uid()
  ) order by g.score desc), '[]'::jsonb)
  from (
    select * from public.drift_ghosts where track = p_track order by score desc limit least(greatest(p_limit, 1), 10)
  ) g left join public.profiles p on p.id = g.user_id;
$$;
create or replace function public.get_drift_ghosts(p_limit integer default 5) returns jsonb
language sql stable security definer set search_path = '' as $$ select public.get_drift_ghosts(p_limit, 'streets'); $$;

create or replace function public.get_my_drift_ghost(p_track text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', coalesce(p.display_name, 'Martlet Student'), 'score', g.score, 'paint', g.paint, 'path', g.path, 'me', true)
  from public.drift_ghosts g left join public.profiles p on p.id = g.user_id
  where g.user_id = auth.uid() and g.track = p_track;
$$;
create or replace function public.get_my_drift_ghost() returns jsonb
language sql stable security definer set search_path = '' as $$ select public.get_my_drift_ghost('streets'); $$;

revoke execute on function public.drift_track_ok(text) from public, anon, authenticated;
revoke execute on function public.start_drift_run(text), public.get_drift_leaderboard(integer, text),
  public.get_drift_ghosts(integer, text), public.get_my_drift_ghost(text) from public, anon;
grant execute on function public.start_drift_run(text), public.get_drift_leaderboard(integer, text),
  public.get_drift_ghosts(integer, text), public.get_my_drift_ghost(text) to authenticated;

commit;
