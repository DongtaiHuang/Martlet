-- Martlet Drift ghost races (ADR 0050): your best run is kept as a replay (positions, heading and
-- running score 10 times a second) that you and others can race as a see-through car. A ghost is
-- only stored through the same server-timed submission as the score (022), and its path must be
-- physically possible. Run after 022. Safe to re-run.
begin;

-- One ghost per student: their best run. path = [x*10, z*10, heading*1000, score/10] per sample
-- at 10 Hz (smallint fits: the loop is within ±400 m, scores reach 207,000).
create table if not exists public.drift_ghosts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  score integer not null check (score between 0 and 207000),
  paint smallint not null default 0 check (paint between 0 and 15),
  path smallint[] not null check (cardinality(path) between 40 and 4000 and cardinality(path) % 4 = 0),
  updated_at timestamptz not null default now()
);
alter table public.drift_ghosts enable row level security;
revoke all on public.drift_ghosts from public, anon, authenticated;

/** True when a path never moves faster than the car can (46 m/s, with slack) between samples. */
create or replace function public.drift_path_plausible(p_path smallint[]) returns boolean
language plpgsql immutable set search_path = '' as $$
declare i integer; n integer := cardinality(p_path) / 4; dx numeric; dz numeric;
begin
  for i in 1..n - 1 loop
    dx := (p_path[i * 4 + 1] - p_path[(i - 1) * 4 + 1]) / 10.0;
    dz := (p_path[i * 4 + 2] - p_path[(i - 1) * 4 + 2]) / 10.0;
    -- 0.1 s apart: at most 46 m/s × 0.1 s × 1.5.
    if sqrt(dx * dx + dz * dz) > 6.9 then return false; end if;
    -- The running score never goes down.
    if p_path[i * 4 + 4] < p_path[(i - 1) * 4 + 4] then return false; end if;
  end loop;
  return true;
end $$;

-- Like submit_drift_score (022), and on a new best also keeps the run as a ghost.
create or replace function public.submit_drift_run(p_run uuid, p_score integer, p_paint integer, p_path smallint[]) returns text
language plpgsql security definer set search_path = '' as $$
declare v_result text;
begin
  v_result := public.submit_drift_score(p_run, p_score);
  if v_result = 'new-best' and p_path is not null
     and cardinality(p_path) between 40 and 4000 and cardinality(p_path) % 4 = 0
     and public.drift_path_plausible(p_path)
     -- The replay ends on the submitted score (stored /10, so allow rounding).
     and abs(p_path[cardinality(p_path)] * 10 - p_score) <= 10 then
    insert into public.drift_ghosts (user_id, score, paint, path, updated_at)
    values (auth.uid(), p_score, least(greatest(coalesce(p_paint, 0), 0), 15), p_path, now())
    on conflict (user_id) do update set score = excluded.score, paint = excluded.paint, path = excluded.path, updated_at = now();
  end if;
  return v_result;
end $$;

-- The best ghosts (and yours), with display names, for the "race a ghost" picker.
create or replace function public.get_drift_ghosts(p_limit integer default 5) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', coalesce(p.display_name, 'Martlet Student'), 'score', g.score, 'paint', g.paint, 'path', g.path, 'me', g.user_id = auth.uid()
  ) order by g.score desc), '[]'::jsonb)
  from (
    select * from public.drift_ghosts order by score desc limit least(greatest(p_limit, 1), 10)
  ) g left join public.profiles p on p.id = g.user_id;
$$;

-- Your own ghost, even when it's not in the top few.
create or replace function public.get_my_drift_ghost() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', coalesce(p.display_name, 'Martlet Student'), 'score', g.score, 'paint', g.paint, 'path', g.path, 'me', true)
  from public.drift_ghosts g left join public.profiles p on p.id = g.user_id
  where g.user_id = auth.uid();
$$;

revoke execute on function public.drift_path_plausible(smallint[]), public.submit_drift_run(uuid, integer, integer, smallint[]),
  public.get_drift_ghosts(integer), public.get_my_drift_ghost() from public, anon;
grant execute on function public.submit_drift_run(uuid, integer, integer, smallint[]),
  public.get_drift_ghosts(integer), public.get_my_drift_ghost() to authenticated;

commit;
