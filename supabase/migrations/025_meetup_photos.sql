-- Meetup photo albums (issue #117, ADR 0039).
-- The host and students who pecked a meetup share photos from the moment it starts. The album
-- closes 7 days after the start: nobody can see its photos after that, and each file is deleted
-- through the Storage API the next time its uploader uses Martlet (see purge below). The app
-- never uses the service-role key, so the database can't delete Storage files itself.
-- Photos use the Board's reports and moderator queue (target_type 'photo').
-- Keep lib/meetup-album.ts in sync. Run after 017 and 024.
begin;

create table if not exists public.meetup_photos (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index if not exists meetup_photos_meetup_idx on public.meetup_photos (meetup_id, created_at);
alter table public.meetup_photos enable row level security;
revoke all on public.meetup_photos from public, anon, authenticated;
grant select on public.meetup_photos to authenticated;

-- Rules ------------------------------------------------------------------------------------

-- Storage paths are "{meetup-id}/{photo-id}.jpg".
create or replace function public.meetup_photo_id(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select nullif(substring(object_name from '^[0-9a-f-]{36}/([0-9a-f-]{36})\.jpg$'), '')::uuid;
$$;

-- The host, or a student with a Peck. Only the meetup's own participants share photos.
create or replace function public.is_meetup_participant(p_meetup uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.meetups m where m.id = p_meetup and m.host_id = (select auth.uid()))
    or exists (select 1 from public.meetup_pecks k where k.meetup_id = p_meetup and k.user_id = (select auth.uid()))
  );
$$;

-- Open from the start time until 7 days later, for meetups that weren't cancelled.
create or replace function public.meetup_album_open(p_meetup uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meetups m
    where m.id = p_meetup and m.status = 'open'
      and now() >= m.starts_at and now() < m.starts_at + interval '7 days'
  );
$$;

-- A photo that still exists for someone: not removed, and its album is still open.
create or replace function public.meetup_photo_live(p_photo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meetup_photos p
    where p.id = p_photo and p.status <> 'removed' and public.meetup_album_open(p.meetup_id)
  );
$$;

-- Participants see visible photos; moderators also see hidden ones.
create or replace function public.can_view_meetup_photo(p_photo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meetup_photos p
    where p.id = p_photo and public.meetup_photo_live(p.id)
      and ((p.status = 'visible' and public.is_meetup_participant(p.meetup_id)) or public.is_moderator())
  );
$$;

drop policy if exists "Read meetup photos" on public.meetup_photos;
create policy "Read meetup photos" on public.meetup_photos for select to authenticated
  using (public.can_view_meetup_photo(id));

-- Writes -----------------------------------------------------------------------------------

-- Reserve a photo row; the app then uploads "{meetup}/{photo}.jpg" within 10 minutes.
-- Limits: 20 photos per person and 300 per meetup.
create or replace function public.add_meetup_photo(p_meetup uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_id uuid;
begin
  perform 1 from public.meetups where id = p_meetup for update;
  if not public.is_meetup_participant(p_meetup) then
    raise exception 'only the host and people going can add photos' using errcode = '42501';
  end if;
  if not public.meetup_album_open(p_meetup) then
    raise exception 'the album is closed' using errcode = 'P0001', hint = 'album-closed';
  end if;
  if (select count(*) from public.meetup_photos where meetup_id = p_meetup and uploader_id = v_user and status <> 'removed') >= 20 then
    raise exception 'photo limit reached' using errcode = 'P0001', hint = 'photo-limit';
  end if;
  if (select count(*) from public.meetup_photos where meetup_id = p_meetup and status <> 'removed') >= 300 then
    raise exception 'album full' using errcode = 'P0001', hint = 'album-full';
  end if;
  insert into public.meetup_photos (meetup_id, uploader_id) values (p_meetup, v_user) returning id into v_id;
  return v_id;
end $$;

-- The uploader, the meetup's host or a moderator can remove a photo.
create or replace function public.remove_meetup_photo(p_photo uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  update public.meetup_photos p set status = 'removed'
  where p.id = p_photo and (
    p.uploader_id = v_user or public.is_moderator()
    or exists (select 1 from public.meetups m where m.id = p.meetup_id and m.host_id = v_user)
  );
end $$;

-- Purge: files of the signed-in student's photos that nobody can see any more (removed, album
-- closed, or meetup deleted). The app deletes them through the Storage API, then forgets the rows.
create or replace function public.my_meetup_photo_files_to_purge() returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'meetup-photos' and o.owner_id = (select auth.uid())::text
    and not public.meetup_photo_live(public.meetup_photo_id(o.name))
  limit 100;
$$;

create or replace function public.forget_my_purged_meetup_photos() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from public.meetup_photos p
  where p.uploader_id = (select auth.uid()) and not public.meetup_photo_live(p.id)
    and not exists (select 1 from storage.objects o where o.bucket_id = 'meetup-photos' and o.name = p.meetup_id || '/' || p.id || '.jpg');
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Reports and moderation: the Board's functions (017) gain a 'photo' target ----------------

do $$
declare v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.content_reports'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%target_type%'
  loop
    execute format('alter table public.content_reports drop constraint %I', v_name);
  end loop;
end $$;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('post', 'comment', 'photo'));

create or replace function public.report_content(p_type text, p_id uuid, p_reason text, p_note text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_open integer;
begin
  if p_type = 'post' and not exists (select 1 from public.board_posts where id = p_id and author_id <> v_user and status = 'visible') then return 'already'; end if;
  if p_type = 'comment' and not exists (select 1 from public.board_comments where id = p_id and author_id <> v_user and status = 'visible') then return 'already'; end if;
  if p_type = 'photo' and not exists (
    select 1 from public.meetup_photos where id = p_id and uploader_id <> v_user and status = 'visible' and public.can_view_meetup_photo(id)
  ) then return 'already'; end if;
  if p_type not in ('post', 'comment', 'photo') then return 'already'; end if;
  insert into public.content_reports (target_type, target_id, reporter_id, reason, note)
  values (p_type, p_id, v_user, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (target_type, target_id, reporter_id) do nothing;
  if not found then return 'already'; end if;
  select count(*) into v_open from public.content_reports where target_type = p_type and target_id = p_id and resolved_at is null;
  if v_open >= 3 then
    if p_type = 'post' then update public.board_posts set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'comment' then update public.board_comments set status = 'hidden' where id = p_id and status = 'visible';
    else update public.meetup_photos set status = 'hidden' where id = p_id and status = 'visible'; end if;
    return 'hidden';
  end if;
  return 'reported';
end $$;

create or replace function public.moderate_content(p_type text, p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_status text := case p_action when 'restore' then 'visible' when 'remove' then 'removed' else null end;
begin
  if not public.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_action not in ('restore', 'remove', 'dismiss') then raise exception 'bad action'; end if;
  if v_status is not null then
    if p_type = 'post' then update public.board_posts set status = v_status where id = p_id;
    elsif p_type = 'comment' then update public.board_comments set status = v_status where id = p_id;
    elsif p_type = 'photo' then update public.meetup_photos set status = v_status where id = p_id and status <> 'removed'; end if;
  end if;
  update public.content_reports
  set resolved_at = now(), resolution = case p_action when 'restore' then 'restored' when 'remove' then 'removed' else 'dismissed' end
  where target_type = p_type and target_id = p_id and resolved_at is null;
end $$;

-- Storage ----------------------------------------------------------------------------------
-- Private bucket; "{meetup-id}/{photo-id}.jpg", JPEG only (re-encoded in the browser, so no
-- EXIF/GPS), 5 MB. No update policy: files can't be replaced.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meetup-photos', 'meetup-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Upload own meetup photo" on storage.objects;
create policy "Upload own meetup photo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meetup-photos'
    and exists (
      select 1 from public.meetup_photos p
      where p.id = public.meetup_photo_id(objects.name) and objects.name = p.meetup_id || '/' || p.id || '.jpg'
        and p.uploader_id = (select auth.uid()) and p.status = 'visible'
        and p.created_at > now() - interval '10 minutes' and public.meetup_album_open(p.meetup_id)
    )
  );

-- Viewers read live photos. Uploaders may also read (and so delete) their own dead files:
-- the Storage API needs both to delete. Nobody else can read a photo once it's dead.
drop policy if exists "Read meetup photos" on storage.objects;
create policy "Read meetup photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'meetup-photos'
    and (
      public.can_view_meetup_photo(public.meetup_photo_id(objects.name))
      or (objects.owner_id = (select auth.uid())::text and not public.meetup_photo_live(public.meetup_photo_id(objects.name)))
    )
  );
drop policy if exists "Delete own dead meetup photo" on storage.objects;
create policy "Delete own dead meetup photo" on storage.objects for delete to authenticated
  using (
    bucket_id = 'meetup-photos'
    and objects.owner_id = (select auth.uid())::text
    and not public.meetup_photo_live(public.meetup_photo_id(objects.name))
  );

-- Grants -----------------------------------------------------------------------------------
revoke execute on function public.is_meetup_participant(uuid), public.meetup_album_open(uuid), public.meetup_photo_live(uuid),
  public.can_view_meetup_photo(uuid), public.add_meetup_photo(uuid), public.remove_meetup_photo(uuid),
  public.my_meetup_photo_files_to_purge(), public.forget_my_purged_meetup_photos(), public.meetup_photo_id(text)
  from public, anon;
grant execute on function public.is_meetup_participant(uuid), public.meetup_album_open(uuid), public.meetup_photo_live(uuid),
  public.can_view_meetup_photo(uuid), public.add_meetup_photo(uuid), public.remove_meetup_photo(uuid),
  public.my_meetup_photo_files_to_purge(), public.forget_my_purged_meetup_photos(), public.meetup_photo_id(text)
  to authenticated;

commit;
