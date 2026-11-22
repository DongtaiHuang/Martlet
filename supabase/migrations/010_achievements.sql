-- ADR 0015: achievements for niche and hidden features.
-- Run after 001-009 in the Supabase SQL Editor. Safe to re-run.
--
-- Rules enforced here (not just in the UI):
--  - Users can only read and add their OWN achievements.
--  - Each achievement is earned once per user (primary key).
--  - Achievements are permanent: no update or delete for users.
-- Which ids are valid lives in lib/achievement-catalog.ts; the server action rejects
-- anything else. The check below only bounds the shape of the id.
-- Grants are explicit because new Supabase projects don't auto-grant (see 005).

create table if not exists public.user_achievements (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  achievement_id text not null check (achievement_id ~ '^[a-z0-9-]{2,40}$'),
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.user_achievements enable row level security;

drop policy if exists "Read own achievements" on public.user_achievements;
create policy "Read own achievements" on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Earn own achievement" on public.user_achievements;
create policy "Earn own achievement" on public.user_achievements for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Deliberately no UPDATE/DELETE policy or grant: achievements are permanent.
revoke all on public.user_achievements from anon, authenticated;
grant select on public.user_achievements to authenticated;
grant insert (user_id, achievement_id) on public.user_achievements to authenticated;
