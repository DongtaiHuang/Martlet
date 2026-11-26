-- Trend images (issue #116, ADR 0043): album art for songs and a photo for recipes, fetched once
-- by the server when the entry is shared and copied into a private bucket, so viewers never
-- contact Spotify or recipe sites. Images are reportable; three reports hide one.
-- Run after 010, 011 and 029. Safe to re-run.
begin;

alter table public.trend_entries add column if not exists image_status text not null default 'none';
alter table public.trend_entries drop constraint if exists trend_entries_image_status_check;
alter table public.trend_entries add constraint trend_entries_image_status_check
  check (image_status in ('none', 'visible', 'hidden', 'removed'));

-- Reading: the ranked list now says whether an entry has a visible image ("hasImage").
create or replace function public.get_trending_entries(p_type text default null, p_limit integer default 20) returns jsonb
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
    select e.id, e.title, e.type, e.detail, e.link, e.created_by, e.created_at, e.image_status,
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
    'createdAt', limited.created_at, 'hasImage', limited.image_status = 'visible'
  ) order by limited.like_count desc, limited.created_at desc), '[]'::jsonb) into result
  from (
    select * from ranked order by like_count desc, created_at desc limit p_limit
  ) limited;
  return result;
end;
$$;

-- Storage --------------------------------------------------------------------------------------
-- Private bucket; "{entry-id}.img". JPEG, PNG or WebP, 2 MB. The app uploads with the sharer's
-- session right after creating the entry, then calls attach_trend_image.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trend-images', 'trend-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.trend_image_entry_id(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select nullif(substring(object_name from '^([0-9a-f-]{36})\.img$'), '')::uuid;
$$;

-- A file is live while its entry exists and its image isn't removed.
create or replace function public.trend_image_live(p_entry uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trend_entries where id = p_entry and image_status <> 'removed');
$$;

drop policy if exists "Upload own trend image" on storage.objects;
create policy "Upload own trend image" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trend-images'
    and exists (
      select 1 from public.trend_entries e
      where e.id = public.trend_image_entry_id(objects.name)
        and e.created_by = (select auth.uid()) and e.image_status = 'none'
        and e.created_at > now() - interval '10 minutes'
    )
  );
drop policy if exists "Read trend images" on storage.objects;
create policy "Read trend images" on storage.objects for select to authenticated
  using (
    bucket_id = 'trend-images'
    and (
      exists (select 1 from public.trend_entries e where e.id = public.trend_image_entry_id(objects.name) and e.image_status = 'visible')
      or public.is_moderator()
      or (objects.owner_id = (select auth.uid())::text and not public.trend_image_live(public.trend_image_entry_id(objects.name)))
    )
  );
drop policy if exists "Delete own dead trend image" on storage.objects;
create policy "Delete own dead trend image" on storage.objects for delete to authenticated
  using (
    bucket_id = 'trend-images'
    and objects.owner_id = (select auth.uid())::text
    and not public.trend_image_live(public.trend_image_entry_id(objects.name))
  );

-- Marks the sharer's new entry as having an image once its file is uploaded.
create or replace function public.attach_trend_image(p_entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'trend-images' and name = p_entry || '.img' and owner_id = v_user::text
  ) then
    raise exception 'no image uploaded' using errcode = 'P0002';
  end if;
  update public.trend_entries set image_status = 'visible'
  where id = p_entry and created_by = v_user and image_status = 'none';
end $$;

-- The signed-in student's dead trend image files, deleted by the app through the Storage API.
create or replace function public.my_trend_image_files_to_purge() returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'trend-images' and o.owner_id = (select auth.uid())::text
    and not public.trend_image_live(public.trend_image_entry_id(o.name))
  limit 100;
$$;

-- Reports and moderation: trend images join the queue ------------------------------------------
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('post', 'comment', 'photo', 'listing', 'listing_message', 'table_chat', 'creator', 'creator_message', 'trend_image'));

create or replace function public.report_content(p_type text, p_id uuid, p_reason text, p_note text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_open integer;
begin
  if p_type = 'post' and not exists (select 1 from public.board_posts where id = p_id and author_id <> v_user and status = 'visible') then return 'already'; end if;
  if p_type = 'comment' and not exists (select 1 from public.board_comments where id = p_id and author_id <> v_user and status = 'visible') then return 'already'; end if;
  if p_type = 'photo' and not exists (
    select 1 from public.meetup_photos where id = p_id and uploader_id <> v_user and status = 'visible' and public.can_view_meetup_photo(id)
  ) then return 'already'; end if;
  if p_type = 'listing' and not exists (
    select 1 from public.listings where id = p_id and seller_id <> v_user and status in ('active', 'reserved', 'sold') and expires_at > now()
  ) then return 'already'; end if;
  if p_type = 'listing_message' and not exists (
    select 1 from public.listing_messages m join public.listings l on l.id = m.listing_id
    where m.id = p_id and m.sender_id <> v_user and m.status = 'visible' and (m.buyer_id = v_user or l.seller_id = v_user)
  ) then return 'already'; end if;
  if p_type = 'table_chat' and not exists (
    select 1 from public.bj_chat_messages where id = p_id and user_id <> v_user and status = 'visible' and public.bj_is_seated(table_id)
  ) then return 'already'; end if;
  if p_type = 'creator' and not exists (
    select 1 from public.creator_profiles where user_id = p_id and user_id <> v_user and status = 'visible'
  ) then return 'already'; end if;
  if p_type = 'creator_message' and not exists (
    select 1 from public.creator_messages m join public.creator_requests r on r.id = m.request_id
    where m.id = p_id and m.sender_id <> v_user and m.status = 'visible' and v_user in (r.creator_id, r.client_id)
  ) then return 'already'; end if;
  if p_type = 'trend_image' and not exists (
    select 1 from public.trend_entries where id = p_id and created_by <> v_user and image_status = 'visible'
  ) then return 'already'; end if;
  if p_type not in ('post', 'comment', 'photo', 'listing', 'listing_message', 'table_chat', 'creator', 'creator_message', 'trend_image') then return 'already'; end if;
  insert into public.content_reports (target_type, target_id, reporter_id, reason, note)
  values (p_type, p_id, v_user, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (target_type, target_id, reporter_id) do nothing;
  if not found then return 'already'; end if;
  select count(*) into v_open from public.content_reports where target_type = p_type and target_id = p_id and resolved_at is null;
  -- A private message has one possible reporter, and a table has at most four others, so one
  -- report hides either.
  if v_open >= 3 or p_type in ('listing_message', 'table_chat', 'creator_message') then
    if p_type = 'post' then update public.board_posts set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'comment' then update public.board_comments set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'photo' then update public.meetup_photos set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'listing' then update public.listings set status = 'hidden', updated_at = now() where id = p_id and status in ('active', 'reserved', 'sold');
    elsif p_type = 'listing_message' then update public.listing_messages set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'table_chat' then update public.bj_chat_messages set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'creator' then update public.creator_profiles set status = 'hidden' where user_id = p_id and status = 'visible';
    elsif p_type = 'creator_message' then update public.creator_messages set status = 'hidden' where id = p_id and status = 'visible';
    else update public.trend_entries set image_status = 'hidden' where id = p_id and image_status = 'visible'; end if;
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
    elsif p_type = 'photo' then update public.meetup_photos set status = v_status where id = p_id and status <> 'removed';
    elsif p_type = 'listing' then
      update public.listings set status = case v_status when 'visible' then 'active' else v_status end, updated_at = now()
      where id = p_id and status <> 'removed';
    elsif p_type = 'listing_message' then update public.listing_messages set status = v_status where id = p_id and status <> 'removed';
    elsif p_type = 'table_chat' then update public.bj_chat_messages set status = v_status where id = p_id and status <> 'removed';
    elsif p_type = 'creator' then update public.creator_profiles set status = v_status, updated_at = now() where user_id = p_id and status <> 'removed';
    elsif p_type = 'creator_message' then update public.creator_messages set status = v_status where id = p_id and status <> 'removed';
    elsif p_type = 'trend_image' then update public.trend_entries set image_status = v_status where id = p_id and image_status in ('visible', 'hidden'); end if;
  end if;
  update public.content_reports
  set resolved_at = now(), resolution = case p_action when 'restore' then 'restored' when 'remove' then 'removed' else 'dismissed' end
  where target_type = p_type and target_id = p_id and resolved_at is null;
end $$;

-- Grants ----------------------------------------------------------------------------------------
revoke execute on function public.trend_image_entry_id(text), public.trend_image_live(uuid),
  public.attach_trend_image(uuid), public.my_trend_image_files_to_purge()
  from public, anon;
grant execute on function public.trend_image_entry_id(text), public.trend_image_live(uuid),
  public.attach_trend_image(uuid), public.my_trend_image_files_to_purge()
  to authenticated;

commit;
