-- Marketplace (migration 026). Run on a disposable migrated database. Fixtures roll back.
begin;

-- S sells; B1, B2, B3 are students; M is a moderator.
insert into auth.users (id) values
  ('96000000-0000-4000-8000-00000000000a'), ('96000000-0000-4000-8000-000000000001'),
  ('96000000-0000-4000-8000-000000000002'), ('96000000-0000-4000-8000-000000000003'),
  ('96000000-0000-4000-8000-00000000000c');
update public.profiles set is_moderator = true where id = '96000000-0000-4000-8000-00000000000c';

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-00000000000a', true);

-- Creating: valid listings, then the shape rules.
insert into ids values
  ('book', public.create_listing('sell', 'textbooks', 'COMP 202 textbook', 'Barely used', 4500, 'like-new', 'COMP 202', 'leacock-building', 1)),
  ('lamp', public.create_listing('free', 'furniture', 'Desk lamp', '', null, 'good', '', 'leacock-building', 0));
do $$
declare v_case text;
begin
  foreach v_case in array array['sell-no-price', 'free-with-price', 'course-not-textbook', 'off-campus', 'bad-kind'] loop
    begin
      case v_case
        when 'sell-no-price' then perform public.create_listing('sell', 'other', 'Something', '', null, null, null, 'leacock-building', 0);
        when 'free-with-price' then perform public.create_listing('free', 'other', 'Something', '', 500, null, null, 'leacock-building', 0);
        when 'course-not-textbook' then perform public.create_listing('sell', 'other', 'Something', '', 500, null, 'COMP 202', 'leacock-building', 0);
        when 'off-campus' then perform public.create_listing('sell', 'other', 'Something', '', 500, null, null, 'my-apartment', 0);
        else perform public.create_listing('auction', 'other', 'Something', '', 500, null, null, 'leacock-building', 0);
      end case;
      raise exception 'Accepted invalid listing: %', v_case;
    exception when check_violation or foreign_key_violation then null;
    end;
  end loop;
end $$;

-- Ten a day.
do $$ begin
  for i in 1..8 loop perform public.create_listing('free', 'other', 'Freebie ' || i, '', null, null, null, 'leacock-building', 0); end loop;
  begin
    perform public.create_listing('free', 'other', 'One too many', '', null, null, null, 'leacock-building', 0);
    raise exception 'Rate limit not applied';
  exception when raise_exception then if sqlerrm <> 'listing too fast' then raise; end if; end;
end $$;

-- Storage: the seller uploads photo 0 of the book, but not photo 1 or a photo of the lamp.
insert into storage.objects (bucket_id, name, owner_id)
select 'listing-photos', id || '/0.jpg', auth.uid()::text from ids where name = 'book';
do $$ begin
  begin
    insert into storage.objects (bucket_id, name, owner_id) select 'listing-photos', id || '/1.jpg', auth.uid()::text from ids where name = 'book';
    raise exception 'Uploaded past photo_count';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) select 'listing-photos', id || '/0.jpg', auth.uid()::text from ids where name = 'lamp';
    raise exception 'Uploaded to a listing without photos';
  exception when insufficient_privilege then null; end;
end $$;

-- Messages: buyers start threads; the seller replies only into an existing thread.
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000001', true);
do $$ begin
  if (select count(*) from public.listings where seller_id = '96000000-0000-4000-8000-00000000000a') <> 10 then
    raise exception 'Students should see the seller''s 10 listings';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'listing-photos') <> 1 then raise exception 'Buyer can''t see the photo'; end if;
  insert into ids values ('msg', public.send_listing_message((select id from ids where name = 'book'), null, 'Is it still available?'));
  begin
    perform public.send_listing_message((select id from ids where name = 'book'), '96000000-0000-4000-8000-000000000002', 'Hijack');
    raise exception 'Wrote into someone else''s thread';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-00000000000a', true);
do $$ begin
  perform public.send_listing_message((select id from ids where name = 'book'), '96000000-0000-4000-8000-000000000001', 'Yes! Leacock at noon?');
  begin
    perform public.send_listing_message((select id from ids where name = 'book'), '96000000-0000-4000-8000-000000000002', 'Cold message');
    raise exception 'Seller messaged someone without a thread';
  exception when sqlstate 'P0002' then null; end;
  if (select count(*) from public.listing_messages) <> 2 then raise exception 'Seller should see the whole thread'; end if;
  if (select count(*) from public.notifications where kind = 'listing_message') <> 1 then
    raise exception 'Seller should have one message notification';
  end if;
end $$;

-- Other students can't read the thread.
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000002', true);
do $$ begin
  if exists (select 1 from public.listing_messages) then raise exception 'Outsider can read a thread'; end if;
  if public.report_content('listing_message', (select id from ids where name = 'msg'), 'spam', '') <> 'already' then
    raise exception 'Outsider could report a private message';
  end if;
end $$;

-- Buyer reports the seller's reply: one report hides a private message.
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000001', true);
do $$
declare v_reply uuid;
begin
  if (select count(*) from public.notifications where kind = 'listing_message') <> 1 then
    raise exception 'Buyer should have one message notification';
  end if;
  select id into v_reply from public.listing_messages where sender_id = '96000000-0000-4000-8000-00000000000a';
  if public.report_content('listing_message', v_reply, 'harassment', '') <> 'hidden' then raise exception 'Message not hidden'; end if;
  if exists (select 1 from public.listing_messages where id = v_reply) then raise exception 'Hidden message still shown to buyer'; end if;
end $$;

-- Three reports hide a listing; a moderator restores it to active.
do $$
declare v_user text; v_result text;
begin
  foreach v_user in array array['96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000002', '96000000-0000-4000-8000-000000000003'] loop
    perform set_config('request.jwt.claim.sub', v_user, true);
    v_result := public.report_content('listing', (select id from ids where name = 'lamp'), 'scam', '');
  end loop;
  if v_result <> 'hidden' then raise exception 'Third report should hide the listing, got %', v_result; end if;
  if exists (select 1 from public.listings where id = (select id from ids where name = 'lamp')) then
    raise exception 'Hidden listing still visible';
  end if;
  perform set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-00000000000a', true);
  perform public.set_listing_status((select id from ids where name = 'lamp'), 'active');
  if (select status from public.listings where id = (select id from ids where name = 'lamp')) <> 'hidden' then
    raise exception 'Seller un-hid a reported listing';
  end if;
  perform set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-00000000000c', true);
  perform public.moderate_content('listing', (select id from ids where name = 'lamp'), 'restore');
  if (select status from public.listings where id = (select id from ids where name = 'lamp')) <> 'active' then
    raise exception 'Moderator restore should make it active';
  end if;
end $$;

-- Seller status changes, renew window, removal and purge.
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-00000000000a', true);
do $$
declare v_book uuid := (select id from ids where name = 'book'); v_expires timestamptz;
begin
  perform public.set_listing_status(v_book, 'reserved');
  if (select status from public.listings where id = v_book) <> 'reserved' then raise exception 'Reserve failed'; end if;
  select expires_at into v_expires from public.listings where id = v_book;
  perform public.renew_listing(v_book);
  if (select expires_at from public.listings where id = v_book) <> v_expires then raise exception 'Renewed too early'; end if;
  if exists (select 1 from public.my_listing_photo_files_to_purge()) then raise exception 'Live photo offered for purge'; end if;
  perform public.remove_my_listing(v_book);
  if (select count(*) from public.my_listing_photo_files_to_purge()) <> 1 then raise exception 'Removed listing photo not offered for purge'; end if;
end $$;
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-000000000001', true);
do $$ begin
  if exists (select 1 from public.listings where id = (select id from ids where name = 'book')) then raise exception 'Removed listing visible'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'listing-photos') then raise exception 'Removed listing photo readable'; end if;
  if exists (select 1 from public.my_listing_photo_files_to_purge()) then raise exception 'Buyer offered seller''s file'; end if;
end $$;

-- Cleanup is owner-only and deletes old removed and long-expired listings.
do $$ begin
  perform public.cleanup_marketplace();
  raise exception 'Students could run the marketplace cleanup';
exception when insufficient_privilege then null; end $$;
reset role;
do $$ begin
  update public.listings set expires_at = now() - interval '31 days' where id = (select id from ids where name = 'lamp');
  if public.cleanup_marketplace(now() + interval '8 days') <> 2 then raise exception 'Expected the removed and the long-expired listing to go'; end if;
end $$;

rollback;
