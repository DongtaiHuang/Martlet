-- Guest browsing (ADR 0025): signed-out visitors can see meetups and landmarks, read-only.
-- Guests never get table access to meetups, profiles, pecks or flaps. They read through one
-- SECURITY DEFINER function that returns only the summary fields the feed shows:
--   - counts instead of who joined,
--   - the host's display name only,
--   - custom (non-catalog) meeting instructions replaced, since they can be personal.
-- Landmarks are a public campus catalog; landmark photos stay members-only (storage RLS unchanged).
begin;

create or replace function public.guest_meetups(p_id uuid default null)
returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id, 'host_id', m.host_id, 'title', m.title, 'description', m.description,
    'category', m.category, 'categories', m.categories,
    'location_name', case when m.location_type = 'custom' then 'Off-map spot (sign in for details)' else m.location_name end,
    'latitude', m.latitude, 'longitude', m.longitude, 'starts_at', m.starts_at, 'status', m.status,
    'created_at', m.created_at, 'course_code', m.course_code,
    'host', jsonb_build_object('display_name', coalesce(p.display_name, 'Martlet Student')),
    'pecks', jsonb_build_array(jsonb_build_object('count', (select count(*) from public.meetup_pecks k where k.meetup_id = m.id))),
    'flaps', jsonb_build_array(jsonb_build_object('count', (select count(*) from public.meetup_flaps f where f.meetup_id = m.id)))
  )
  from public.meetups m
  left join public.profiles p on p.id = m.host_id
  where case
    when p_id is not null then m.id = p_id
    else m.status = 'open' and m.starts_at > now()
  end
  order by m.starts_at
  limit 100;
$$;
revoke execute on function public.guest_meetups(uuid) from public;
grant execute on function public.guest_meetups(uuid) to anon, authenticated;

grant select on public.landmarks to anon;
drop policy if exists "Guests read landmarks" on public.landmarks;
create policy "Guests read landmarks" on public.landmarks for select to anon using (true);
grant execute on function public.landmark_unlock_counts() to anon;

commit;
