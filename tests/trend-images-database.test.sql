-- Trend images (migration 030). Run on a disposable migrated database. Fixtures roll back.
begin;

-- A shares; B1, B2, B3 are students; M is a moderator.
insert into auth.users (id) values
  ('99000000-0000-4000-8000-00000000000a'), ('99000000-0000-4000-8000-000000000001'),
  ('99000000-0000-4000-8000-000000000002'), ('99000000-0000-4000-8000-000000000003'),
  ('99000000-0000-4000-8000-00000000000c');
update public.profiles set is_moderator = true where id = '99000000-0000-4000-8000-00000000000c';

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-00000000000a', true);

insert into ids values
  ('song', public.create_trend_entry('Test song for images', 'song', '', 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', null)),
  ('plain', public.create_trend_entry('Test coffee without image', 'coffee', '', '', null));

-- Attaching needs an uploaded file; the sharer uploads one for their own new entry only.
do $$ begin
  begin
    perform public.attach_trend_image((select id from ids where name = 'song'));
    raise exception 'Attached an image that was never uploaded';
  exception when sqlstate 'P0002' then null; end;
end $$;
insert into storage.objects (bucket_id, name, owner_id) select 'trend-images', id || '.img', auth.uid()::text from ids where name = 'song';
select public.attach_trend_image((select id from ids where name = 'song'));
do $$ begin
  if (select (e->>'hasImage')::boolean from jsonb_array_elements(public.get_trending_entries(null, 50)) e
      where e->>'id' = (select id::text from ids where name = 'song')) is not true then
    raise exception 'Entry should report hasImage';
  end if;
  if (select (e->>'hasImage')::boolean from jsonb_array_elements(public.get_trending_entries(null, 50)) e
      where e->>'id' = (select id::text from ids where name = 'plain')) is not false then
    raise exception 'Entry without an image should report hasImage false';
  end if;
  -- No second file once the image is set (RLS's check runs before the unique name check).
  begin
    insert into storage.objects (bucket_id, name, owner_id) select 'trend-images', id || '.img', auth.uid()::text from ids where name = 'song';
    raise exception 'Uploaded over an attached image';
  exception when insufficient_privilege then null; end;
end $$;

-- Other students can't upload for someone else's entry or attach it, but can read the image.
select set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin
    insert into storage.objects (bucket_id, name, owner_id) select 'trend-images', id || '.img', auth.uid()::text from ids where name = 'plain';
    raise exception 'Uploaded an image for someone else''s entry';
  exception when insufficient_privilege then null; end;
  begin
    perform public.attach_trend_image((select id from ids where name = 'plain'));
    raise exception 'Attached an image to someone else''s entry';
  exception when sqlstate 'P0002' then null; end;
  if (select count(*) from storage.objects where bucket_id = 'trend-images') <> 1 then raise exception 'Student can''t see the image'; end if;
  if public.report_content('trend_image', (select id from ids where name = 'plain'), 'spam', '') <> 'already' then
    raise exception 'Reported an entry that has no image';
  end if;
end $$;

-- The sharer can't report their own image; three reports hide it from everyone but moderators.
select set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-00000000000a', true);
do $$ begin
  if public.report_content('trend_image', (select id from ids where name = 'song'), 'spam', '') <> 'already' then
    raise exception 'Sharer reported their own image';
  end if;
end $$;
do $$
declare v_user text; v_result text;
begin
  foreach v_user in array array['99000000-0000-4000-8000-000000000001', '99000000-0000-4000-8000-000000000002', '99000000-0000-4000-8000-000000000003'] loop
    perform set_config('request.jwt.claim.sub', v_user, true);
    v_result := public.report_content('trend_image', (select id from ids where name = 'song'), 'sexual', '');
  end loop;
  if v_result <> 'hidden' then raise exception 'Third report should hide the image, got %', v_result; end if;
  if exists (select 1 from storage.objects where bucket_id = 'trend-images') then raise exception 'Hidden image still readable'; end if;
  if (select (e->>'hasImage')::boolean from jsonb_array_elements(public.get_trending_entries(null, 50)) e
      where e->>'id' = (select id::text from ids where name = 'song')) then
    raise exception 'Hidden image still listed';
  end if;

  perform set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-00000000000c', true);
  if (select count(*) from storage.objects where bucket_id = 'trend-images') <> 1 then raise exception 'Moderator can''t see the hidden image'; end if;
  perform public.moderate_content('trend_image', (select id from ids where name = 'song'), 'restore');
  if (select image_status from public.trend_entries where id = (select id from ids where name = 'song')) <> 'visible' then
    raise exception 'Restore should make the image visible';
  end if;
  perform public.moderate_content('trend_image', (select id from ids where name = 'song'), 'remove');
end $$;

-- A removed image's file is dead: offered to its owner for purge, readable by nobody else.
select set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-000000000001', true);
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'trend-images') then raise exception 'Removed image readable'; end if;
  if exists (select 1 from public.my_trend_image_files_to_purge()) then raise exception 'Student offered someone else''s file'; end if;
end $$;
select set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-00000000000a', true);
do $$ begin
  if (select count(*) from public.my_trend_image_files_to_purge()) <> 1 then raise exception 'Removed image not offered for purge'; end if;
  -- The entry itself stays; only its image is gone.
  if (select image_status from public.trend_entries where id = (select id from ids where name = 'song')) <> 'removed' then
    raise exception 'Image should be removed';
  end if;
end $$;

rollback;
