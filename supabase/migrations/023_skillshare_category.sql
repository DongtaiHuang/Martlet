-- Skillshare meetups (issue #118): a "skills" category for students teaching or learning a skill
-- (guitar, LaTeX, résumé review…). Same meetups, Pecks, map and moderation; only the allowed
-- category list grows. Keep lib/meetup-categories.ts MEETUP_CATEGORIES in sync.
begin;

-- Drop every check that lists the allowed categories (001's single-category check and 014's
-- multi-category check), whatever they are named, so this runs on any database state.
do $$
declare v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.meetups'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%''gaming''%'
  loop
    execute format('alter table public.meetups drop constraint %I', v_name);
  end loop;
end $$;

alter table public.meetups add constraint meetups_category_check
  check (category in ('coffee', 'study', 'food', 'sports', 'gaming', 'skills', 'other'));

-- The multi-category check from 014, with "skills" added; every other rule is unchanged.
alter table public.meetups add constraint meetups_categories_check check (
  cardinality(categories) between 1 and 3
  and array_ndims(categories) = 1
  and array_lower(categories, 1) = 1
  and case when array_ndims(categories) = 1 then array_position(categories, null) is null else false end
  and categories <@ array['coffee', 'study', 'food', 'sports', 'gaming', 'skills', 'other']::text[]
  and (cardinality(categories) = 1 or not ('other' = any(categories)))
  and (cardinality(categories) < 2 or categories[1] <> categories[2])
  and (cardinality(categories) < 3 or (categories[1] <> categories[3] and categories[2] <> categories[3]))
  and category = categories[1]
);

commit;
