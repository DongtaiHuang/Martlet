-- Blocking (migration 035). Run on a disposable migrated database. Fixtures roll back.
begin;

-- A sells and makes things; B is a student who gets blocked; C is a bystander.
insert into auth.users (id) values
  ('9d000000-0000-4000-8000-00000000000a'), ('9d000000-0000-4000-8000-00000000000b'), ('9d000000-0000-4000-8000-00000000000c');
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '9d000000-0000-4000-8000-00000000000a', true);
insert into ids values ('listing', public.create_listing('free', 'other', 'Desk lamp', '', null, null, null, 'leacock-building', 0));
select public.save_creator_profile('Film photographer', '', array['photography'], '', array[]::text[], true);

-- B messages A's listing, then A blocks B by that message.
select set_config('request.jwt.claim.sub', '9d000000-0000-4000-8000-00000000000b', true);
insert into ids values ('msg', public.send_listing_message((select id from ids where name = 'listing'), null, 'Still available?'));
select set_config('request.jwt.claim.sub', '9d000000-0000-4000-8000-00000000000a', true);
do $$ begin
  if public.block_author('listing_message', (select id from ids where name = 'msg')) <> 'blocked' then raise exception 'Block failed'; end if;
  if public.block_author('listing_message', (select id from ids where name = 'msg')) <> 'already' then raise exception 'Second block not "already"'; end if;
  if public.block_author('listing', (select id from ids where name = 'listing')) <> 'self' then raise exception 'Blocked yourself'; end if;
  if jsonb_array_length(public.my_blocks()) <> 1 then raise exception 'Block not listed'; end if;
  -- A can't reply into B's thread now.
  begin
    perform public.send_listing_message((select id from ids where name = 'listing'), '9d000000-0000-4000-8000-00000000000b', 'Hi');
    raise exception 'Messaged a blocked student';
  exception when insufficient_privilege then null; end;
end $$;

-- B can't message A or request A's services either; C still can.
select set_config('request.jwt.claim.sub', '9d000000-0000-4000-8000-00000000000b', true);
do $$ begin
  if exists (select 1 from public.user_blocks) then raise exception 'B can see who blocked them'; end if;
  begin
    perform public.send_listing_message((select id from ids where name = 'listing'), null, 'Hello?');
    raise exception 'Blocked student messaged';
  exception when insufficient_privilege then null; end;
  begin
    perform public.send_creator_request('9d000000-0000-4000-8000-00000000000a', 'photography', null, null, 'Can you shoot my event?');
    raise exception 'Blocked student sent a request';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '9d000000-0000-4000-8000-00000000000c', true);
do $$ begin
  perform public.send_listing_message((select id from ids where name = 'listing'), null, 'Is it free?');
  perform public.send_creator_request('9d000000-0000-4000-8000-00000000000a', 'photography', null, null, 'Portraits please!');
end $$;

-- Table chat: A doesn't see B's lines; C sees both.
reset role;
insert into public.bj_seats (table_id, seat, user_id) values
  ('redpath', 1, '9d000000-0000-4000-8000-00000000000a'), ('redpath', 2, '9d000000-0000-4000-8000-00000000000b'), ('redpath', 3, '9d000000-0000-4000-8000-00000000000c');
insert into public.bj_chat_messages (table_id, user_id, body) values
  ('redpath', '9d000000-0000-4000-8000-00000000000b', 'From B'), ('redpath', '9d000000-0000-4000-8000-00000000000c', 'From C');
set local role authenticated;
select set_config('request.jwt.claim.sub', '9d000000-0000-4000-8000-00000000000a', true);
do $$ begin
  if jsonb_array_length(public.bj_chat_recent()->'messages') <> 1 then raise exception 'A should see only C''s line'; end if;
end $$;
select set_config('request.jwt.claim.sub', '9d000000-0000-4000-8000-00000000000c', true);
do $$ begin
  if jsonb_array_length(public.bj_chat_recent()->'messages') <> 2 then raise exception 'C should see both lines'; end if;
end $$;

-- Unblocking restores messaging.
select set_config('request.jwt.claim.sub', '9d000000-0000-4000-8000-00000000000a', true);
select public.unblock_user('9d000000-0000-4000-8000-00000000000b');
do $$ begin
  if jsonb_array_length(public.my_blocks()) <> 0 then raise exception 'Unblock failed'; end if;
  perform public.send_listing_message((select id from ids where name = 'listing'), '9d000000-0000-4000-8000-00000000000b', 'Sorry, yes it is!');
end $$;

rollback;
