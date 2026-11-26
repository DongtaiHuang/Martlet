-- Creator profile photos (ADR 0045): an optional square photo on a creator profile, stored as
-- "{student-id}/photo.jpg" in the private creator-works bucket (029). Visible to whoever can read
-- the profile; reports on the profile cover the photo. Run after 029. Safe to re-run.
begin;

alter table public.creator_profiles add column if not exists has_photo boolean not null default false;

create or replace function public.creator_photo_owner(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select nullif(substring(object_name from '^([0-9a-f-]{36})/photo\.jpg$'), '')::uuid;
$$;

-- A photo is live while its owner's profile exists, isn't removed and says it has one.
create or replace function public.creator_photo_live(p_owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.creator_profiles where user_id = p_owner and has_photo and status <> 'removed');
$$;

-- Upload or replace your own photo while you have a profile that isn't removed. Replacing needs
-- update as well as insert (the Storage API's upsert).
drop policy if exists "Upload own creator photo" on storage.objects;
create policy "Upload own creator photo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'creator-works'
    and public.creator_photo_owner(objects.name) = (select auth.uid())
    and exists (select 1 from public.creator_profiles where user_id = (select auth.uid()) and status <> 'removed')
  );
drop policy if exists "Replace own creator photo" on storage.objects;
create policy "Replace own creator photo" on storage.objects for update to authenticated
  using (bucket_id = 'creator-works' and public.creator_photo_owner(objects.name) = (select auth.uid()))
  with check (
    bucket_id = 'creator-works'
    and public.creator_photo_owner(objects.name) = (select auth.uid())
    and exists (select 1 from public.creator_profiles where user_id = (select auth.uid()) and status <> 'removed')
  );
-- Others see a photo while they can read the profile (029's creator_readable).
drop policy if exists "Read creator photos" on storage.objects;
create policy "Read creator photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'creator-works'
    and public.creator_photo_owner(objects.name) is not null
    and public.creator_readable(public.creator_photo_owner(objects.name))
    and public.creator_photo_live(public.creator_photo_owner(objects.name))
  );
drop policy if exists "Delete own creator photo" on storage.objects;
create policy "Delete own creator photo" on storage.objects for delete to authenticated
  using (bucket_id = 'creator-works' and objects.owner_id = (select auth.uid())::text
         and public.creator_photo_owner(objects.name) = (select auth.uid()));

-- Marks your profile as having (or not having) a photo. Turning it on needs the uploaded file.
create or replace function public.set_creator_photo(p_has_photo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  if p_has_photo and not exists (
    select 1 from storage.objects where bucket_id = 'creator-works' and name = v_user || '/photo.jpg' and owner_id = v_user::text
  ) then
    raise exception 'no photo uploaded' using errcode = 'P0002';
  end if;
  update public.creator_profiles set has_photo = coalesce(p_has_photo, false), updated_at = now()
  where user_id = v_user and status <> 'removed';
end $$;

-- The purge (029) must never offer a live photo: a photo's name isn't a work id, so the old
-- function treated every photo as dead.
create or replace function public.my_creator_work_files_to_purge() returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'creator-works' and o.owner_id = (select auth.uid())::text
    and case
      when public.creator_photo_owner(o.name) is not null then not public.creator_photo_live(public.creator_photo_owner(o.name))
      else not public.creator_work_live(public.creator_work_file_id(o.name))
    end
  limit 100;
$$;

revoke execute on function public.creator_photo_owner(text), public.creator_photo_live(uuid), public.set_creator_photo(boolean) from public, anon;
grant execute on function public.creator_photo_owner(text), public.creator_photo_live(uuid), public.set_creator_photo(boolean) to authenticated;

commit;
