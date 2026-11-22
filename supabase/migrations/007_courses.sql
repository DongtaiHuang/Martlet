-- McGill courses and the courses each student is taking (issue #25). Safe to re-run.
-- Run 008_course_catalog.sql afterwards to load the catalogue.
--
-- public.courses holds real course codes imported from the McGill course catalogue by
-- scripts/import-mcgill-courses.mjs. public.user_courses references it, so the database
-- rejects any code that is not a real McGill course, whatever the browser sends.
-- A student's course list is private: only they can read or change it.
-- Grants are explicit because new Supabase projects don't auto-grant (see 005).

create table if not exists public.courses (
  code text primary key check (code ~ '^[A-Z][A-Z0-9]{2,3} [0-9]{3}[A-Z0-9]{0,3}$'),
  title text not null check (char_length(title) between 1 and 200)
);

alter table public.courses enable row level security;
drop policy if exists "Read courses" on public.courses;
create policy "Read courses" on public.courses for select to authenticated using (true);
revoke all on public.courses from anon, authenticated;
grant select on public.courses to authenticated;

create table if not exists public.user_courses (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_code text not null references public.courses(code) on update cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_code)
);

create index if not exists user_courses_course_code_idx on public.user_courses (course_code);

alter table public.user_courses enable row level security;

drop policy if exists "Read own courses" on public.user_courses;
create policy "Read own courses" on public.user_courses for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Add own course" on public.user_courses;
create policy "Add own course" on public.user_courses for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Remove own course" on public.user_courses;
create policy "Remove own course" on public.user_courses for delete to authenticated
  using (user_id = (select auth.uid()));

-- No UPDATE: changing a course is remove + add.
revoke all on public.user_courses from anon, authenticated;
grant select, delete on public.user_courses to authenticated;
grant insert (user_id, course_code) on public.user_courses to authenticated;
