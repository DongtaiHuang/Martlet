-- Creator directory (migration 029). Run on a disposable migrated database. Fixtures roll back.
begin;

-- C is a creator; S1, S2, S3 are students; M is a moderator.
insert into auth.users (id) values
  ('98000000-0000-4000-8000-00000000000a'), ('98000000-0000-4000-8000-000000000001'),
  ('98000000-0000-4000-8000-000000000002'), ('98000000-0000-4000-8000-000000000003'),
  ('98000000-0000-4000-8000-00000000000c');
update public.profiles set is_moderator = true where id = '98000000-0000-4000-8000-00000000000c';

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-00000000000a', true);

-- Profiles: a valid one, then the shape rules. Saving again updates in place.
select public.save_creator_profile('Film photographer', 'Portraits and events.', array['photography', 'video'], 'From $40 an hour',
  array['https://example.com/portfolio'], true);
do $$
declare v_case text;
begin
  foreach v_case in array array['no-discipline', 'four-disciplines', 'bad-discipline', 'http-link', 'six-links', 'short-headline'] loop
    begin
      case v_case
        when 'no-discipline' then perform public.save_creator_profile('Valid headline', '', array[]::text[], '', array[]::text[], true);
        when 'four-disciplines' then perform public.save_creator_profile('Valid headline', '', array['music', 'coding', 'art', 'video'], '', array[]::text[], true);
        when 'bad-discipline' then perform public.save_creator_profile('Valid headline', '', array['juggling'], '', array[]::text[], true);
        when 'http-link' then perform public.save_creator_profile('Valid headline', '', array['music'], '', array['http://example.com'], true);
        when 'six-links' then perform public.save_creator_profile('Valid headline', '', array['music'], '',
          array['https://a.co/1', 'https://a.co/2', 'https://a.co/3', 'https://a.co/4', 'https://a.co/5', 'https://a.co/6'], true);
        else perform public.save_creator_profile('Hi', '', array['music'], '', array[]::text[], true);
      end case;
      raise exception 'Accepted invalid profile: %', v_case;
    exception when check_violation then null;
    end;
  end loop;
  if (select headline from public.creator_profiles where user_id = '98000000-0000-4000-8000-00000000000a') <> 'Film photographer' then
    raise exception 'A rejected save changed the profile';
  end if;
end $$;

-- Works: an image work and a link-only work; a work needs one or the other; 8 at most.
insert into ids values
  ('shot', public.add_creator_work('Graduation portraits', 'Shot on Portra 400', null, true)),
  ('reel', public.add_creator_work('Club promo video', '', 'https://example.com/reel', false));
do $$ begin
  begin
    perform public.add_creator_work('Empty work', '', null, false);
    raise exception 'Accepted a work with no image or link';
  exception when check_violation then null; end;
  for i in 1..6 loop perform public.add_creator_work('Work ' || i, '', 'https://example.com/' || i, false); end loop;
  begin
    perform public.add_creator_work('Ninth work', '', 'https://example.com/9', false);
    raise exception 'Work limit not applied';
  exception when raise_exception then if sqlerrm <> 'too many works' then raise; end if; end;
end $$;

-- Storage: the creator uploads the image work's file, but not one for the link-only work or
-- one under someone else's folder.
insert into storage.objects (bucket_id, name, owner_id)
select 'creator-works', auth.uid() || '/' || id || '.jpg', auth.uid()::text from ids where name = 'shot';
do $$ begin
  begin
    insert into storage.objects (bucket_id, name, owner_id) select 'creator-works', auth.uid() || '/' || id || '.jpg', auth.uid()::text from ids where name = 'reel';
    raise exception 'Uploaded a file for a link-only work';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name, owner_id)
    select 'creator-works', '98000000-0000-4000-8000-000000000001/' || id || '.jpg', auth.uid()::text from ids where name = 'shot';
    raise exception 'Uploaded into another student''s folder';
  exception when insufficient_privilege then null; end;
end $$;

-- Students see the profile, works and file. Nobody can request their own profile.
do $$ begin
  begin
    perform public.send_creator_request('98000000-0000-4000-8000-00000000000a', 'photography', null, null, 'Self request');
    raise exception 'Creator requested their own profile';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);
do $$ begin
  if (select count(*) from public.creator_profiles) <> 1 then raise exception 'Student can''t see the profile'; end if;
  if (select count(*) from public.creator_works) <> 8 then raise exception 'Student can''t see the works'; end if;
  if (select count(*) from storage.objects where bucket_id = 'creator-works') <> 1 then raise exception 'Student can''t see the image'; end if;
  begin
    perform public.send_creator_request('98000000-0000-4000-8000-00000000000a', 'photography', 5000, current_date - 1, 'Yesterday please');
    raise exception 'Accepted a deadline in the past';
  exception when invalid_parameter_value then null; end;
  insert into ids values ('req', public.send_creator_request('98000000-0000-4000-8000-00000000000a', 'photography', 8000, current_date + 14,
    'Could you shoot our club''s end-of-term party?'));
  perform public.send_creator_request('98000000-0000-4000-8000-00000000000a', 'video', null, null, 'And a short recap video?');
  begin
    perform public.send_creator_request('98000000-0000-4000-8000-00000000000a', 'video', null, null, 'A third one');
    raise exception 'Open-request limit not applied';
  exception when raise_exception then if sqlerrm <> 'too many open requests' then raise; end if; end;
end $$;

-- The creator sees both requests and got one notification per request.
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-00000000000a', true);
do $$ begin
  if (select count(*) from public.creator_requests) <> 2 then raise exception 'Creator should see both requests'; end if;
  if (select count(*) from public.notifications where kind = 'creator_request') <> 2 then raise exception 'Creator should have two notifications'; end if;
  perform public.send_creator_message((select id from ids where name = 'req'), 'Sure! Which date?');
  perform public.set_creator_request_status((select id from ids where name = 'req'), 'accepted');
  begin
    perform public.set_creator_request_status((select id from ids where name = 'req'), 'declined');
    raise exception 'Declined an accepted request';
  exception when insufficient_privilege then null; end;
end $$;

-- Outsiders can't read, write or report into the thread.
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000002', true);
do $$
declare v_msg uuid;
begin
  if exists (select 1 from public.creator_requests) or exists (select 1 from public.creator_messages) then
    raise exception 'Outsider can read a request';
  end if;
  begin
    perform public.send_creator_message((select id from ids where name = 'req'), 'Hijack');
    raise exception 'Outsider wrote into a request';
  exception when sqlstate 'P0002' then null; end;
  begin
    perform public.set_creator_request_status((select id from ids where name = 'req'), 'closed');
    raise exception 'Outsider closed a request';
  exception when sqlstate 'P0002' then null; end;
end $$;

-- The client sees the acceptance, reports the creator's reply (one report hides it) and can't
-- accept their own request.
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);
do $$
declare v_reply uuid;
begin
  if (select status from public.creator_requests where id = (select id from ids where name = 'req')) <> 'accepted' then
    raise exception 'Client should see the request accepted';
  end if;
  if (select count(*) from public.notifications where kind = 'creator_request') <> 1 then
    raise exception 'Client should have one refreshed notification';
  end if;
  begin
    perform public.set_creator_request_status((select id from ids where name = 'req'), 'accepted');
    raise exception 'Client accepted their own request';
  exception when insufficient_privilege then null; end;
  select id into v_reply from public.creator_messages where sender_id = '98000000-0000-4000-8000-00000000000a';
  if public.report_content('creator_message', v_reply, 'harassment', '') <> 'hidden' then raise exception 'Message not hidden'; end if;
  if exists (select 1 from public.creator_messages where id = v_reply) then raise exception 'Hidden message still shown to client'; end if;
  perform public.set_creator_request_status((select id from ids where name = 'req'), 'closed');
  begin
    perform public.send_creator_message((select id from ids where name = 'req'), 'Still there?');
    raise exception 'Wrote into a closed request';
  exception when sqlstate 'P0002' then null; end;
end $$;

-- Three reports hide a profile (and its works and files); the creator can still edit it but
-- not un-hide it; a moderator restores it.
do $$
declare v_user text; v_result text;
begin
  foreach v_user in array array['98000000-0000-4000-8000-000000000001', '98000000-0000-4000-8000-000000000002', '98000000-0000-4000-8000-000000000003'] loop
    perform set_config('request.jwt.claim.sub', v_user, true);
    v_result := public.report_content('creator', '98000000-0000-4000-8000-00000000000a', 'spam', '');
  end loop;
  if v_result <> 'hidden' then raise exception 'Third report should hide the profile, got %', v_result; end if;
  if exists (select 1 from public.creator_profiles) or exists (select 1 from public.creator_works)
     or exists (select 1 from storage.objects where bucket_id = 'creator-works') then
    raise exception 'Hidden profile still visible';
  end if;
  begin
    perform public.send_creator_request('98000000-0000-4000-8000-00000000000a', 'photography', null, null, 'Hello?');
    raise exception 'Requested a hidden creator';
  exception when sqlstate 'P0002' then null; end;

  perform set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-00000000000a', true);
  perform public.save_creator_profile('Film photographer (updated)', '', array['photography'], '', array[]::text[], true);
  if (select status from public.creator_profiles where user_id = auth.uid()) <> 'hidden' then raise exception 'Creator un-hid a reported profile'; end if;

  perform set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-00000000000c', true);
  perform public.moderate_content('creator', '98000000-0000-4000-8000-00000000000a', 'restore');
  if (select status from public.creator_profiles where user_id = '98000000-0000-4000-8000-00000000000a') <> 'visible' then
    raise exception 'Moderator restore should make it visible';
  end if;
end $$;

-- Deleting a work makes its file dead: offered for purge, readable only by its owner.
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-00000000000a', true);
do $$ begin
  if exists (select 1 from public.my_creator_work_files_to_purge()) then raise exception 'Live file offered for purge'; end if;
  perform public.delete_creator_work((select id from ids where name = 'shot'));
  if (select count(*) from public.my_creator_work_files_to_purge()) <> 1 then raise exception 'Deleted work''s file not offered for purge'; end if;
end $$;
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-000000000001', true);
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'creator-works') then raise exception 'Dead file readable by others'; end if;
  if exists (select 1 from public.my_creator_work_files_to_purge()) then raise exception 'Student offered the creator''s file'; end if;
  perform public.delete_creator_work((select id from ids where name = 'reel'));
  if (select count(*) from public.creator_works where id = (select id from ids where name = 'reel')) <> 1 then
    raise exception 'Student deleted someone else''s work';
  end if;
end $$;

-- A removed profile can't be edited; cleanup is owner-only and deletes old closed requests and
-- removed profiles.
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-00000000000c', true);
select public.moderate_content('creator', '98000000-0000-4000-8000-00000000000a', 'remove');
select set_config('request.jwt.claim.sub', '98000000-0000-4000-8000-00000000000a', true);
do $$ begin
  begin
    perform public.save_creator_profile('Back again', '', array['photography'], '', array[]::text[], true);
    raise exception 'Edited a removed profile';
  exception when insufficient_privilege then null; end;
  begin
    perform public.cleanup_creators();
    raise exception 'Students could run the creator cleanup';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  -- The closed request (31 days later) and the removed profile go; the profile takes the other request with it.
  if public.cleanup_creators(now() + interval '31 days') <> 2 then raise exception 'Expected the closed request and the removed profile to go'; end if;
  if exists (select 1 from public.creator_requests where creator_id = '98000000-0000-4000-8000-00000000000a') then
    raise exception 'Requests outlived their profile';
  end if;
end $$;

rollback;
