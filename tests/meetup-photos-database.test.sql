-- Meetup photo albums (migration 025). Run on a disposable migrated database. Fixtures roll back.
begin;

-- H hosts; P1-P4 pecked; O is an outsider; M is a moderator.
insert into auth.users (id) values
  ('95000000-0000-4000-8000-00000000000a'), ('95000000-0000-4000-8000-000000000001'), ('95000000-0000-4000-8000-000000000002'),
  ('95000000-0000-4000-8000-000000000003'), ('95000000-0000-4000-8000-000000000004'), ('95000000-0000-4000-8000-00000000000b'),
  ('95000000-0000-4000-8000-00000000000c');
update public.profiles set is_moderator = true where id = '95000000-0000-4000-8000-00000000000c';

-- Owner-inserted fixtures so past start times are allowed: started 1 h ago, starts in 2 h, started 8 days ago.
insert into public.meetups (id, host_id, title, category, location_type, location_name, latitude, longitude, starts_at) values
  ('95100000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-00000000000a', 'Photo walk',   'other', 'custom', 'Cafe Olimpico', null, null, now() - interval '1 hour'),
  ('95100000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-00000000000a', 'Later walk',   'other', 'custom', 'Cafe Olimpico', null, null, now() + interval '2 hours'),
  ('95100000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-00000000000a', 'Old walk',     'other', 'custom', 'Cafe Olimpico', null, null, now() - interval '8 days');
insert into public.meetup_pecks (meetup_id, user_id)
select m, u from (values ('95100000-0000-4000-8000-000000000001'::uuid), ('95100000-0000-4000-8000-000000000002'), ('95100000-0000-4000-8000-000000000003')) ms(m)
cross join (values ('95000000-0000-4000-8000-000000000001'::uuid), ('95000000-0000-4000-8000-000000000002'), ('95000000-0000-4000-8000-000000000003'), ('95000000-0000-4000-8000-000000000004')) us(u);
-- A photo in the closed album, with no file.
insert into public.meetup_photos (id, meetup_id, uploader_id) values
  ('95200000-0000-4000-8000-000000000001', '95100000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000001');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;

-- Outsiders can't add photos; participants and the host can, only while the album is open.
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-00000000000b', true);
do $$ begin
  perform public.add_meetup_photo('95100000-0000-4000-8000-000000000001');
  raise exception 'Outsider added a photo';
exception when insufficient_privilege then null; end $$;

select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
insert into ids values ('p1', public.add_meetup_photo('95100000-0000-4000-8000-000000000001'));
do $$
declare v_meetup uuid;
begin
  foreach v_meetup in array array['95100000-0000-4000-8000-000000000002', '95100000-0000-4000-8000-000000000003']::uuid[] loop
    begin
      perform public.add_meetup_photo(v_meetup);
      raise exception 'Photo added to a closed album %', v_meetup;
    exception when raise_exception then
      if sqlerrm <> 'the album is closed' then raise; end if;
    end;
  end loop;
end $$;

select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-00000000000a', true);
insert into ids values ('host', public.add_meetup_photo('95100000-0000-4000-8000-000000000001'));

-- 20 photos per person.
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
do $$ begin
  for i in 1..20 loop perform public.add_meetup_photo('95100000-0000-4000-8000-000000000001'); end loop;
  begin
    perform public.add_meetup_photo('95100000-0000-4000-8000-000000000001');
    raise exception 'Went past 20 photos';
  exception when raise_exception then
    if sqlerrm <> 'photo limit reached' then raise; end if;
  end;
end $$;

-- Storage: upload only to your own fresh photo's path.
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
insert into storage.objects (bucket_id, name, owner_id)
select 'meetup-photos', '95100000-0000-4000-8000-000000000001/' || id || '.jpg', auth.uid()::text from ids where name = 'p1';
do $$ begin
  insert into storage.objects (bucket_id, name, owner_id)
  select 'meetup-photos', '95100000-0000-4000-8000-000000000001/' || id || '.jpg', auth.uid()::text from ids where name = 'host';
  raise exception 'Uploaded to someone else''s photo';
exception when insufficient_privilege then null; end $$;

-- Reading: participants see the album, outsiders see nothing.
do $$ begin
  if (select count(*) from public.meetup_photos where meetup_id = '95100000-0000-4000-8000-000000000001') <> 22 then
    raise exception 'Participant should see 22 photos';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'meetup-photos') <> 1 then raise exception 'Participant should see the file'; end if;
  if exists (select 1 from public.meetup_photos where meetup_id = '95100000-0000-4000-8000-000000000003') then
    raise exception 'Closed album still visible';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-00000000000b', true);
do $$ begin
  if exists (select 1 from public.meetup_photos) or exists (select 1 from storage.objects where bucket_id = 'meetup-photos') then
    raise exception 'Outsider can see photos';
  end if;
  if public.report_content('photo', (select id from ids where name = 'p1'), 'spam', '') <> 'already' then
    raise exception 'Outsider could report a photo they can''t see';
  end if;
end $$;

-- Three reports hide a photo; moderators see and restore it.
do $$
declare v_user text; v_result text;
begin
  foreach v_user in array array['95000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000004'] loop
    perform set_config('request.jwt.claim.sub', v_user, true);
    v_result := public.report_content('photo', (select id from ids where name = 'p1'), 'harassment', '');
  end loop;
  if v_result <> 'hidden' then raise exception 'Third report should hide the photo, got %', v_result; end if;
  if exists (select 1 from public.meetup_photos where id = (select id from ids where name = 'p1')) then
    raise exception 'Hidden photo still visible to participants';
  end if;
  perform set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-00000000000c', true);
  if not exists (select 1 from public.meetup_photos where id = (select id from ids where name = 'p1')) then
    raise exception 'Moderator can''t see the hidden photo';
  end if;
  perform public.moderate_content('photo', (select id from ids where name = 'p1'), 'restore');
  perform set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
  if not exists (select 1 from public.meetup_photos where id = (select id from ids where name = 'p1')) then
    raise exception 'Restored photo not visible';
  end if;
end $$;

-- Removal: other participants can't, the host can. Removed photos disappear and become purgeable.
do $$ begin
  perform public.remove_meetup_photo((select id from ids where name = 'host'));
  if not exists (select 1 from public.meetup_photos where id = (select id from ids where name = 'host')) then
    raise exception 'A participant removed the host''s photo';
  end if;
  perform set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-00000000000a', true);
  perform public.remove_meetup_photo((select id from ids where name = 'p1'));
  perform set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000001', true);
  if exists (select 1 from public.meetup_photos where id = (select id from ids where name = 'p1')) then
    raise exception 'Removed photo still visible';
  end if;
  if (select count(*) from public.my_meetup_photo_files_to_purge()) <> 1 then
    raise exception 'Removed photo''s file not offered for purge to its uploader';
  end if;
  -- The file still exists, so only the closed album's file-less row is forgotten.
  if public.forget_my_purged_meetup_photos() <> 1 then raise exception 'Expected one forgotten photo'; end if;
  perform set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-000000000002', true);
  if exists (select 1 from public.my_meetup_photo_files_to_purge()) then
    raise exception 'Another student was offered someone''s file';
  end if;
end $$;

reset role;
do $$ begin
  if not exists (select 1 from public.meetup_photos where id = (select id from ids where name = 'p1')) then
    raise exception 'Row with a remaining file was forgotten';
  end if;
  if exists (select 1 from public.meetup_photos where id = '95200000-0000-4000-8000-000000000001') then
    raise exception 'File-less dead row was kept';
  end if;
end $$;

rollback;
