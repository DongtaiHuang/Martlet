-- Martlet Drift leaderboard (issue #149, ADR 0037). One best score per student, same approach as
-- Martlet Flight (migration 016, ADR 0026): the game runs in the browser, so a score can't be fully
-- trusted. To keep fake scores out:
--   - the server times each run: start_drift_run() stamps the start, and submit_drift_score() only
--     accepts a run that lasted at least 85 s (a run is 90 s of driving, plus any pauses) and at
--     most 15 minutes;
--   - the score must be possible: at most 2300 points per second of driving (top speed × full
--     angle × the ×5 combo, see lib/drift.ts MAX_POINTS_PER_SECOND), so at most 207,000;
--   - each run can be submitted once, by its own player (auth.uid()); nobody can write the tables.
begin;

create table public.drift_scores (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  best integer not null check (best between 0 and 207000),
  updated_at timestamptz not null default now()
);
create index drift_scores_best_idx on public.drift_scores (best desc, updated_at);

create table public.drift_runs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  run_id uuid not null,
  started_at timestamptz not null default now()
);

alter table public.drift_scores enable row level security;
alter table public.drift_runs enable row level security;
revoke all on public.drift_scores, public.drift_runs from public, anon, authenticated;
-- No policies: all access goes through the functions below.

create function public.start_drift_run() returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_run uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  insert into public.drift_runs (user_id, run_id, started_at) values (auth.uid(), v_run, now())
  on conflict (user_id) do update set run_id = excluded.run_id, started_at = excluded.started_at;
  return v_run;
end $$;

-- Returns 'new-best', 'saved' (not a new best) or 'rejected'.
create function public.submit_drift_score(p_run uuid, p_score integer) returns text
language plpgsql security definer set search_path = '' as $$
declare v_started timestamptz; v_seconds numeric;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  delete from public.drift_runs where user_id = auth.uid() and run_id = p_run returning started_at into v_started;
  if v_started is null or p_score is null or p_score < 0 or p_score > 207000 then return 'rejected'; end if;
  v_seconds := extract(epoch from now() - v_started);
  if v_seconds < 85 or v_seconds > 900 then return 'rejected'; end if;

  insert into public.drift_scores (user_id, best, updated_at) values (auth.uid(), p_score, now())
  on conflict (user_id) do update set best = excluded.best, updated_at = excluded.updated_at
    where public.drift_scores.best < excluded.best;
  return case when found then 'new-best' else 'saved' end;
end $$;

-- Top drivers plus the caller's own rank. Display names only.
create function public.get_drift_leaderboard(p_limit integer default 10) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ranked as (
    select s.user_id, s.best, s.updated_at, coalesce(p.display_name, 'Martlet Student') as name,
           rank() over (order by s.best desc) as rank
    from public.drift_scores s left join public.profiles p on p.id = s.user_id
    where s.best > 0
  )
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', rank, 'name', name, 'score', best, 'me', user_id = auth.uid()) order by rank, updated_at)
                     from (select * from ranked order by rank, updated_at limit least(greatest(p_limit, 1), 50)) t), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', rank, 'score', best) from ranked where user_id = auth.uid()),
    'players', (select count(*) from ranked)
  );
$$;

revoke execute on function public.start_drift_run(), public.submit_drift_score(uuid, integer), public.get_drift_leaderboard(integer) from public, anon;
grant execute on function public.start_drift_run(), public.submit_drift_score(uuid, integer), public.get_drift_leaderboard(integer) to authenticated;

commit;
