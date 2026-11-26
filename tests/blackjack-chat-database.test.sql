-- Blackjack table chat (migration 028). Run only on a disposable database with all migrations
-- applied. Fixtures roll back. A and B sit at Redpath, C at Leacock, D nowhere; M moderates.
begin;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected SQLSTATE % from: %', expected, command;
exception when others then
  if sqlstate <> expected then raise; end if;
end;
$$;
create function pg_temp.assert(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'Assertion failed: %', what; end if;
end;
$$;
create function pg_temp.as_user(c text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-00000000000' || c, true);
$$;
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

insert into auth.users (id) values
  ('97000000-0000-4000-8000-00000000000a'), ('97000000-0000-4000-8000-00000000000b'),
  ('97000000-0000-4000-8000-00000000000c'), ('97000000-0000-4000-8000-00000000000d'),
  ('97000000-0000-4000-8000-00000000000e');
update public.profiles set is_moderator = true where id = '97000000-0000-4000-8000-00000000000e';

-- Realtime publishes the chat (when the publication exists).
select pg_temp.assert(
  not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  or exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bj_chat_messages'),
  'chat in the realtime publication');

set local role authenticated;
select pg_temp.as_user('a'); select public.bj_join('redpath');
select pg_temp.as_user('b'); select public.bj_join('redpath');
select pg_temp.as_user('c'); select public.bj_join('leacock');

-- Only seated players can chat; messages are 1–200 characters; nobody writes the table directly.
select pg_temp.as_user('d');
select pg_temp.assert(public.bj_chat_recent() is null, 'not seated: no chat');
select pg_temp.expect_error($q$select public.bj_chat_send('hi')$q$, 'P0001');
select pg_temp.as_user('a');
select pg_temp.expect_error($q$select public.bj_chat_send('   ')$q$, '22023');
select pg_temp.expect_error($q$select public.bj_chat_send(repeat('x', 201))$q$, '22023');
select pg_temp.expect_error($q$insert into public.bj_chat_messages (table_id, user_id, body) values ('redpath', '97000000-0000-4000-8000-00000000000a', 'x')$q$, '42501');
select pg_temp.expect_error($q$update public.bj_chat_messages set body = 'x'$q$, '42501');
select public.bj_chat_send('  good   luck  everyone ');

select pg_temp.as_user('b');
select public.bj_chat_send('thanks!');
do $$
declare c jsonb := public.bj_chat_recent();
begin
  perform pg_temp.assert(c->>'table_id' = 'redpath' and jsonb_array_length(c->'messages') = 2, 'B sees both: ' || c::text);
  perform pg_temp.assert(c->'messages'->0->>'body' = 'good luck everyone', 'whitespace tidied, oldest first');
  perform pg_temp.assert(not (c->'messages'->0->>'mine')::boolean and (c->'messages'->1->>'mine')::boolean, 'mine flags');
  perform pg_temp.assert(c::text not like '%97000000%', 'no user ids');
  perform pg_temp.assert((select count(*) from public.bj_chat_messages) = 2, 'RLS: B reads Redpath chat');
end $$;
insert into ids select 'hello', id from public.bj_chat_messages where body = 'good luck everyone';

-- Another table can't read it, through the RPC or the table.
select pg_temp.as_user('c');
select pg_temp.assert(jsonb_array_length(public.bj_chat_recent()->'messages') = 0, 'Leacock sees no Redpath chat');
select pg_temp.assert((select count(*) from public.bj_chat_messages) = 0, 'RLS hides other tables');
select pg_temp.as_user('d');
select pg_temp.assert((select count(*) from public.bj_chat_messages) = 0, 'RLS hides chat from people not seated');
select pg_temp.assert(public.report_content('table_chat', (select id from ids where name = 'hello'), 'spam', '') = 'already', 'outsiders cannot report');

-- Rate limit: 10 a minute.
select pg_temp.as_user('a');
do $$
begin
  for i in 2..10 loop perform public.bj_chat_send('msg ' || i); end loop;
  perform pg_temp.expect_error($q$select public.bj_chat_send('one too many')$q$, 'P0001');
end $$;

-- One report hides a message; you can't report your own; a moderator sees and restores it.
select pg_temp.assert(public.report_content('table_chat', (select id from ids where name = 'hello'), 'spam', '') = 'already', 'not your own');
select pg_temp.as_user('b');
select pg_temp.assert(public.report_content('table_chat', (select id from ids where name = 'hello'), 'harassment', '') = 'hidden', 'one report hides');
select pg_temp.assert(not exists (select 1 from jsonb_array_elements(public.bj_chat_recent()->'messages') m where m->>'body' = 'good luck everyone'), 'hidden from the chat');
select pg_temp.expect_error(format('select public.moderate_content(%L, %L, %L)', 'table_chat', (select id from ids where name = 'hello'), 'restore'), '42501');
select pg_temp.as_user('e');
select pg_temp.assert((select status from public.bj_chat_messages where id = (select id from ids where name = 'hello')) = 'hidden', 'moderator reads it');
select public.moderate_content('table_chat', (select id from ids where name = 'hello'), 'restore');
select pg_temp.as_user('b');
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.bj_chat_recent()->'messages') m where m->>'body' = 'good luck everyone'), 'restored');

-- Leaving the table ends access to its chat.
select public.bj_leave('redpath');
select pg_temp.assert(public.bj_chat_recent() is null, 'left: no chat');
select pg_temp.assert((select count(*) from public.bj_chat_messages) = 0, 'left: RLS hides it');

-- Old messages are cleared on the next send.
reset role;
update public.bj_chat_messages set created_at = now() - interval '2 days' where body like 'msg %';
set local role authenticated;
select pg_temp.as_user('c');
select public.bj_chat_send('hello leacock');
reset role;
select pg_temp.assert((select count(*) from public.bj_chat_messages where body like 'msg %') = 9, 'other tables untouched');
set local role authenticated;
select pg_temp.as_user('b');
select public.bj_join('redpath');
select public.bj_chat_send('back');
reset role;
select pg_temp.assert((select count(*) from public.bj_chat_messages where body like 'msg %') = 0, 'day-old messages deleted');

-- Guests get nothing.
set local role anon;
select pg_temp.expect_error($q$select * from public.bj_chat_messages$q$, '42501');
select pg_temp.expect_error($q$select public.bj_chat_recent()$q$, '42501');
rollback;
