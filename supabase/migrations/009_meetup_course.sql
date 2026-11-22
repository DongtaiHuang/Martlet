-- Optional McGill course on study meetups (issue #25). Run after 007/008. Safe to re-run.
--
-- The course must be a real McGill course (foreign key to public.courses) and is only
-- allowed on study meetups. Existing meetups keep course_code = null.
-- Run this BEFORE deploying the app code that reads meetups.course_code.

alter table public.meetups
  add column if not exists course_code text references public.courses(code) on update cascade;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meetups_course_only_for_study') then
    alter table public.meetups
      add constraint meetups_course_only_for_study check (course_code is null or category = 'study');
  end if;
end $$;

create index if not exists meetups_course_code_idx on public.meetups (course_code) where course_code is not null;

-- Same column-level insert grant as 002/005, plus course_code. Updates stay limited to status.
grant insert (host_id, title, description, category, location_name, latitude, longitude, starts_at, course_code)
  on public.meetups to authenticated;
