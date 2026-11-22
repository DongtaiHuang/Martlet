begin;

-- Trends (issue #43, like-based reshaping): student-shared entries for coffee
-- spots, study spots, morning recipes and songs, ranked by like count.
-- Coffee/study entries may pin an approved campus location; recipes and songs
-- are address-free. Songs are user-pasted https links, deliberately NOT the
-- Spotify-API integration deferred in issue #49 (no OAuth, no listening data).

create table public.trend_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (title = btrim(title) and char_length(title) between 3 and 120),
  type text not null check (type in ('coffee', 'study', 'recipe', 'song')),
  detail text not null default '' check (char_length(detail) <= 280),
  link text not null default '' check (link = '' or (link ~ '^https://.+' and char_length(link) <= 300)),
  campus_location_id text references public.campus_locations(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- The same spot or song can only be shared once per type.
create unique index trend_entries_type_title_idx on public.trend_entries (type, lower(title));

create table public.trend_likes (
  entry_id uuid not null references public.trend_entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);
create index trend_likes_user_idx on public.trend_likes (user_id);

alter table public.trend_entries enable row level security;
alter table public.trend_likes enable row level security;
revoke all on public.trend_entries, public.trend_likes from public, anon, authenticated;
grant select on public.trend_entries to authenticated;

create policy "Read trend entries" on public.trend_entries for select to authenticated
  using (true);

-- Ranked list: most likes first, newest breaks ties. p_limit caps at 50.
create function public.get_trending_entries(p_type text default null, p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  result jsonb;
begin
  if viewer is null then raise exception 'Sign in to see trends.' using errcode = '42501'; end if;
  if p_type is not null and p_type not in ('coffee', 'study', 'recipe', 'song') then
    raise exception 'Choose a valid trend type.' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then p_limit := 20; end if;

  with ranked as (
    select e.id, e.title, e.type, e.detail, e.link, e.created_by, e.created_at,
      case when c.id is null then null
        else jsonb_build_object('id', c.id, 'name', c.name, 'latitude', c.latitude, 'longitude', c.longitude)
      end as campus_location,
      (select count(*) from public.trend_likes l where l.entry_id = e.id) as like_count,
      exists (select 1 from public.trend_likes l where l.entry_id = e.id and l.user_id = viewer) as liked_by_me
    from public.trend_entries e
    left join public.campus_locations c on c.id = e.campus_location_id
    where p_type is null or e.type = p_type
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', limited.id, 'title', limited.title, 'type', limited.type, 'detail', limited.detail,
    'link', limited.link, 'campusLocation', limited.campus_location, 'likeCount', limited.like_count,
    'likedByMe', limited.liked_by_me, 'createdByMe', limited.created_by = viewer,
    'createdAt', limited.created_at
  ) order by limited.like_count desc, limited.created_at desc), '[]'::jsonb) into result
  from (
    select * from ranked order by like_count desc, created_at desc limit p_limit
  ) limited;
  return result;
end;
$$;

create function public.create_trend_entry(
  p_title text, p_type text, p_detail text, p_link text, p_campus_location_id text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  clean_title text := btrim(coalesce(p_title, ''));
  clean_detail text := coalesce(btrim(p_detail), '');
  clean_link text := coalesce(btrim(p_link), '');
  campus_id text := nullif(btrim(coalesce(p_campus_location_id, '')), '');
  entry_id uuid;
begin
  if viewer is null then raise exception 'Sign in to share a trend.' using errcode = '42501'; end if;
  if p_type is null or p_type not in ('coffee', 'study', 'recipe', 'song')
    or char_length(clean_title) not between 3 and 120
    or char_length(clean_detail) > 280
    or char_length(clean_link) > 300
    or (clean_link <> '' and clean_link !~ '^https://.+') then
    raise exception 'Check the title, type, detail and link.' using errcode = '22023';
  end if;
  if campus_id is not null and not exists (select 1 from public.campus_locations c where c.id = campus_id) then
    raise exception 'Choose an approved campus location.' using errcode = '22023';
  end if;

  insert into public.trend_entries (title, type, detail, link, campus_location_id, created_by)
    values (clean_title, p_type, clean_detail, clean_link, campus_id, viewer)
  returning id into entry_id;
  return entry_id;
end;
$$;

-- One like per student per entry; liking again is a no-op, unliking removes.
create function public.set_trend_like(p_entry_id uuid, p_liked boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Sign in to like trends.' using errcode = '42501'; end if;
  if not exists (select 1 from public.trend_entries e where e.id = p_entry_id) then
    raise exception 'This entry no longer exists.' using errcode = 'P0002';
  end if;
  if p_liked then
    insert into public.trend_likes (entry_id, user_id) values (p_entry_id, viewer)
    on conflict (entry_id, user_id) do nothing;
  else
    delete from public.trend_likes where entry_id = p_entry_id and user_id = viewer;
  end if;
  return p_entry_id;
end;
$$;

revoke all on function public.get_trending_entries(text, integer),
  public.create_trend_entry(text, text, text, text, text),
  public.set_trend_like(uuid, boolean) from public, anon, authenticated;
grant execute on function public.get_trending_entries(text, integer),
  public.create_trend_entry(text, text, text, text, text),
  public.set_trend_like(uuid, boolean) to authenticated;

commit;
