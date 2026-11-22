-- Notifications (issues #25 + #30): persistent per-user notices, color-coded by
-- kind in the UI. Writes happen only through security-definer RPCs; clients can
-- read their own rows and mark them read, nothing else (ADR 0021).
--
-- Kinds:
--   meetup_new     a new meetup matching the student's courses or category interests
--   meetup_reminder a meetup they host or pecked starts within 2 hours
--   trend_like     someone liked a trend they shared
--
-- Safe to re-run.

begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('meetup_new', 'meetup_reminder', 'trend_like')),
  meetup_id uuid references public.meetups(id) on delete cascade,
  trend_entry_id uuid references public.trend_entries(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 300),
  href text not null default '' check (char_length(href) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'meetup_new' or meetup_id is not null),
  check (kind <> 'meetup_reminder' or meetup_id is not null),
  check (kind <> 'trend_like' or trend_entry_id is not null)
);

-- One row per (user, kind, subject). NULLs are distinct in unique indexes, so
-- the dedupe index coalesces the unused subject column to a sentinel uuid.
create unique index notifications_dedupe_idx
  on public.notifications (
    user_id, kind,
    coalesce(meetup_id, '00000000-0000-4000-8000-000000000000'::uuid),
    coalesce(trend_entry_id, '00000000-0000-4000-8000-000000000000'::uuid)
  );
create index notifications_user_unread_idx on public.notifications (user_id, read_at);

alter table public.notifications enable row level security;

drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

-- Update exists but is limited to read_at by the column grant below: students
-- can never edit the content of a notification, only dismiss it.
drop policy if exists "Mark own notifications read" on public.notifications;
create policy "Mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- No INSERT/DELETE policy or grant: notifications are created by RPCs only.
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- New-meetup notices: course-matched for study meetups with a course code,
-- category-interest (past pecks/flaps in the same category) for everything
-- else. The host never notifies themself.
create function public.notify_meetup_created(p_meetup_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null then raise exception 'Sign in to create meetups.' using errcode = '42501'; end if;
  if not exists (select 1 from public.meetups m where m.id = p_meetup_id and m.host_id = viewer) then
    raise exception 'Only the host can send creation notices.' using errcode = '42501';
  end if;

  with meetup as (select * from public.meetups where id = p_meetup_id),
  recipients as (
    select uc.user_id
    from public.user_courses uc
    where uc.course_code = (select course_code from meetup where course_code is not null)
    union
    select p.user_id
    from public.meetup_pecks p
    join public.meetups other on other.id = p.meetup_id
    where other.category = (select category from meetup)
    union
    select f.user_id
    from public.meetup_flaps f
    join public.meetups other on other.id = f.meetup_id
    where other.category = (select category from meetup)
  )
  insert into public.notifications (user_id, kind, meetup_id, title, body, href)
  select r.user_id, 'meetup_new', meetup.id,
    'New ' || meetup.category || ' meetup: ' || meetup.title,
    meetup.location_name || ' · starts ' || to_char(meetup.starts_at at time zone 'UTC', 'Mon DD HH24:MI') || ' UTC',
    '/meetups/' || meetup.id::text
  from recipients r cross join meetup
  where r.user_id is distinct from meetup.host_id
  on conflict do nothing;
  return 0;
end;
$$;

-- Reminders materialize on page load for meetups the student hosts or pecked
-- that start within the next 2 hours. Idempotent via the dedupe index, so no
-- cron is needed (ADR 0021).
create function public.materialize_meetup_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  created integer := 0;
begin
  if viewer is null then raise exception 'Sign in to see reminders.' using errcode = '42501'; end if;

  with upcoming as (
    select m.id, m.title, m.location_name, m.starts_at
    from public.meetups m
    where m.status = 'open'
      and m.starts_at > statement_timestamp()
      and m.starts_at <= statement_timestamp() + interval '2 hours'
      and (m.host_id = viewer or exists (
        select 1 from public.meetup_pecks p where p.meetup_id = m.id and p.user_id = viewer))
  )
  insert into public.notifications (user_id, kind, meetup_id, title, body, href)
  select viewer, 'meetup_reminder', u.id,
    'Starting soon: ' || u.title,
    u.location_name || ' · ' || to_char(u.starts_at at time zone 'UTC', 'HH24:MI') || ' UTC',
    '/meetups/' || u.id::text
  from upcoming u
  on conflict do nothing;
  get diagnostics created = row_count;
  return created;
end;
$$;

create function public.list_my_notifications(p_limit integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  result jsonb;
begin
  if viewer is null then raise exception 'Sign in to see notifications.' using errcode = '42501'; end if;
  if p_limit is null or p_limit not between 1 and 100 then p_limit := 30; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body, 'href', n.href,
    'meetupId', n.meetup_id, 'readAt', n.read_at, 'createdAt', n.created_at
  ) order by (n.read_at is null) desc, n.created_at desc), '[]'::jsonb) into result
  from (
    select * from public.notifications
    where user_id = viewer
    order by (read_at is null) desc, created_at desc
    limit p_limit
  ) n;
  return result;
end;
$$;

create function public.count_my_unread_notifications() returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to see notifications.' using errcode = '42501'; end if;
  return (select count(*) from public.notifications
          where user_id = auth.uid() and read_at is null);
end;
$$;

create function public.mark_my_notifications_read() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  updated integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to manage notifications.' using errcode = '42501'; end if;
  update public.notifications set read_at = statement_timestamp()
  where user_id = auth.uid() and read_at is null;
  get diagnostics updated = row_count;
  return updated;
end;
$$;

-- set_trend_like, extended to notify the entry's owner on a *new* like
-- (re-likes and self-likes never notify).
create or replace function public.set_trend_like(p_entry_id uuid, p_liked boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  entry public.trend_entries%rowtype;
begin
  if viewer is null then raise exception 'Sign in to like trends.' using errcode = '42501'; end if;
  select * into strict entry from public.trend_entries e where e.id = p_entry_id;
  if p_liked then
    if not exists (select 1 from public.trend_likes l where l.entry_id = entry.id and l.user_id = viewer) then
      insert into public.trend_likes (entry_id, user_id) values (entry.id, viewer);
      if entry.created_by is distinct from viewer then
        insert into public.notifications (user_id, kind, trend_entry_id, title, body, href)
        values (entry.created_by, 'trend_like', entry.id,
          'Someone likes your trend',
          entry.title, '/meetups')
        on conflict do nothing;
      end if;
    end if;
  else
    delete from public.trend_likes where entry_id = entry.id and user_id = viewer;
  end if;
  return entry.id;
end;
$$;

revoke all on function public.notify_meetup_created(uuid),
  public.materialize_meetup_reminders(),
  public.list_my_notifications(integer),
  public.count_my_unread_notifications(),
  public.mark_my_notifications_read(),
  public.set_trend_like(uuid, boolean) from public, anon, authenticated;
grant execute on function public.notify_meetup_created(uuid),
  public.materialize_meetup_reminders(),
  public.list_my_notifications(integer),
  public.count_my_unread_notifications(),
  public.mark_my_notifications_read(),
  public.set_trend_like(uuid, boolean) to authenticated;

commit;
