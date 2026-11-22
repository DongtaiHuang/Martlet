-- Run only on a disposable database with migrations 001-010 applied.
begin;

create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected SQLSTATE %', expected;
exception when others then
  if sqlstate <> expected then raise; end if;
end;
$$;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

-- RPC validation.
select pg_temp.expect_error($q$select public.create_trend_entry('Good title', 'playlist', '', '', null)$q$, '22023');
select pg_temp.expect_error($q$select public.create_trend_entry('ab', 'coffee', '', '', null)$q$, '22023');
select pg_temp.expect_error($q$select public.create_trend_entry('Good title', 'song', repeat('x', 281), '', null)$q$, '22023');
select pg_temp.expect_error($q$select public.create_trend_entry('Good title', 'song', '', 'http://insecure.example', null)$q$, '22023');
select pg_temp.expect_error($q$select public.create_trend_entry('Good title', 'coffee', '', '', 'made-up-place')$q$, '22023');
select pg_temp.expect_error($q$select public.get_trending_entries('playlist', 5)$q$, '22023');

-- Table grants: entries are readable, writes and like reads are RPC-only.
select pg_temp.expect_error($q$insert into public.trend_entries default values$q$, '42501');
select pg_temp.expect_error($q$select * from public.trend_likes$q$, '42501');
select pg_temp.expect_error($q$insert into public.trend_likes default values$q$, '42501');

-- Sharing; duplicates are rejected case-insensitively per type.
select public.create_trend_entry('Le James flat white', 'coffee', 'Best on campus', '', 'redpath-library');
select public.create_trend_entry('Overnight oats', 'recipe', 'Prep the night before', '', null);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.expect_error($q$select public.create_trend_entry('le james FLAT WHITE', 'coffee', '', '', null)$q$, '23505');
select public.create_trend_entry('Redpath 6th floor', 'study', '', '', 'redpath-library');
select public.create_trend_entry('Espresso yourself', 'song', 'Playlist opener', 'https://open.spotify.com/track/abc', null);

-- Likes: user2 likes the study spot, user1 likes the study spot and the recipe.
select public.set_trend_like((select (e->>'id')::uuid from jsonb_array_elements(public.get_trending_entries('study', 5)) e where e->>'title' = 'Redpath 6th floor'), true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.set_trend_like((select (e->>'id')::uuid from jsonb_array_elements(public.get_trending_entries('study', 5)) e where e->>'title' = 'Redpath 6th floor'), true);
select public.set_trend_like((select (e->>'id')::uuid from jsonb_array_elements(public.get_trending_entries('recipe', 5)) e where e->>'title' = 'Overnight oats'), true);

-- Liking again is idempotent.
select public.set_trend_like((select (e->>'id')::uuid from jsonb_array_elements(public.get_trending_entries('study', 5)) e where e->>'title' = 'Redpath 6th floor'), true);

do $$
declare
  study jsonb;
begin
  select e into study from jsonb_array_elements(public.get_trending_entries('study', 5)) e where e->>'title' = 'Redpath 6th floor';
  if (study->>'likeCount')::int <> 2 or study->>'likedByMe' <> 'true'
      or study->'campusLocation'->>'name' <> 'Redpath Library' then
    raise exception 'Like state wrong: %', study;
  end if;
end $$;

-- Ranking: 2 likes, then 1, then ties newest-first (song after coffee in creation order).
do $$
declare
  titles text;
begin
  select string_agg(e->>'title', ',' order by ord) into titles
  from jsonb_array_elements(public.get_trending_entries(null, 10)) with ordinality as arr(e, ord);
  if titles <> 'Redpath 6th floor,Overnight oats,Espresso yourself,Le James flat white' then
    raise exception 'Unexpected ranking: %', titles;
  end if;
end $$;

-- Unliking removes the like.
select public.set_trend_like((select (e->>'id')::uuid from jsonb_array_elements(public.get_trending_entries('recipe', 5)) e where e->>'title' = 'Overnight oats'), false);
do $$
declare recipe jsonb;
begin
  select e into recipe from jsonb_array_elements(public.get_trending_entries('recipe', 5)) e;
  if (recipe->>'likeCount')::int <> 0 or recipe->>'likedByMe' <> 'false' then
    raise exception 'Unlike failed: %', recipe;
  end if;
end $$;

-- Missing entries and signed-out access.
select pg_temp.expect_error($q$select public.set_trend_like('00000000-0000-4000-8000-000000000099', true)$q$, 'P0002');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($q$select public.get_trending_entries()$q$, '42501');
select pg_temp.expect_error($q$select public.set_trend_like('00000000-0000-4000-8000-000000000011', true)$q$, '42501');
