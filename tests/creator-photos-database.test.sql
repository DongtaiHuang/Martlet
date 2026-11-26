-- Creator profile photos (migration 031). Run on a disposable migrated database. Fixtures roll back.
begin;

-- C is a creator; S is a student with no profile; M is a moderator.
insert into auth.users (id) values
  ('9a000000-0000-4000-8000-00000000000a'), ('9a000000-0000-4000-8000-000000000001'), ('9a000000-0000-4000-8000-00000000000c');
update public.profiles set is_moderator = true where id = '9a000000-0000-4000-8000-00000000000c';

set local role authenticated;

-- Without a profile there's nothing to attach a photo to.
select set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('creator-works', auth.uid() || '/photo.jpg', auth.uid()::text);
    raise exception 'Uploaded a photo without a creator profile';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-00000000000a', true);
select public.save_creator_profile('Portrait painter', '', array['art'], '', array[]::text[], true);
do $$ begin
  begin
    perform public.set_creator_photo(true);
    raise exception 'Marked a photo that was never uploaded';
  exception when sqlstate 'P0002' then null; end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('creator-works', '9a000000-0000-4000-8000-000000000001/photo.jpg', auth.uid()::text);
    raise exception 'Uploaded a photo into someone else''s folder';
  exception when insufficient_privilege then null; end;
end $$;
insert into storage.objects (bucket_id, name, owner_id) values ('creator-works', '9a000000-0000-4000-8000-00000000000a/photo.jpg', '9a000000-0000-4000-8000-00000000000a');
select public.set_creator_photo(true);
do $$ begin
  if not (select has_photo from public.creator_profiles where user_id = auth.uid()) then raise exception 'Photo not marked'; end if;
  -- The purge must never offer a live photo (029's purge would have).
  if exists (select 1 from public.my_creator_work_files_to_purge()) then raise exception 'Live photo offered for purge'; end if;
end $$;

-- Students see the photo while the profile is visible.
select set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true);
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'creator-works' and name like '%/photo.jpg') <> 1 then
    raise exception 'Student can''t see the photo';
  end if;
end $$;

-- Hidden by reports: only the owner and moderators see it.
reset role;
update public.creator_profiles set status = 'hidden' where user_id = '9a000000-0000-4000-8000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true);
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'creator-works') then raise exception 'Hidden profile''s photo readable'; end if;
end $$;
select set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-00000000000c', true);
do $$ begin
  if (select count(*) from storage.objects where bucket_id = 'creator-works') <> 1 then raise exception 'Moderator can''t see the photo'; end if;
end $$;

-- Removing the photo makes the file dead: offered to the owner for purge, readable by nobody else.
reset role;
update public.creator_profiles set status = 'visible' where user_id = '9a000000-0000-4000-8000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-00000000000a', true);
select public.set_creator_photo(false);
do $$ begin
  if (select count(*) from public.my_creator_work_files_to_purge()) <> 1 then raise exception 'Removed photo not offered for purge'; end if;
end $$;
select set_config('request.jwt.claim.sub', '9a000000-0000-4000-8000-000000000001', true);
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'creator-works') then raise exception 'Removed photo readable'; end if;
end $$;

rollback;
