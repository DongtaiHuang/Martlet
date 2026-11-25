-- Multiplayer blackjack tables (migration 020). Run only on a disposable database with all
-- migrations applied. Decks are fixed through bj_table_secrets.test_deck.
-- Deal order with k players: deck[1..k] first cards, deck[k+1] dealer up, deck[k+2..2k+1] second
-- cards, deck[2k+2] dealer hole, then draws. Cards: rank = card % 13 (0 = ace, 9–12 = 10s).
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
create function pg_temp.deck(variadic first integer[]) returns smallint[] language sql as $$
  select (select array_agg(c::smallint order by o) from unnest(first) with ordinality as f(c, o))
      || (select array_agg(c::smallint order by c) from generate_series(0, 51) as c where c <> all (first));
$$;
create function pg_temp.as_user(n integer) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000030' || n, true);
$$;
create function pg_temp.bal(n integer) returns integer language sql as $$
  select balance from public.market_wallets where user_id = ('00000000-0000-4000-8000-00000000030' || n)::uuid;
$$;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000301'), ('00000000-0000-4000-8000-000000000302'), ('00000000-0000-4000-8000-000000000303');

-- Realtime: the public table is published (when the publication exists); secrets and seats aren't.
select pg_temp.assert(
  not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
  or exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'bj_tables'),
  'bj_tables in the realtime publication');
select pg_temp.assert(not exists (select 1 from pg_publication_tables where tablename in ('bj_table_secrets', 'bj_seats')), 'secrets not published');

set local role authenticated;
select pg_temp.as_user(1);
select pg_temp.assert(jsonb_array_length(public.bj_list_tables()) = 3, 'three tables');
select pg_temp.expect_error($q$select * from public.bj_table_secrets$q$, '42501');
select pg_temp.expect_error($q$select * from public.bj_seats$q$, '42501');
select pg_temp.expect_error($q$select public.bj_deal('redpath')$q$, '42501');
select pg_temp.expect_error($q$select public.bj_dealer_play('redpath')$q$, '42501');
select pg_temp.expect_error($q$update public.bj_tables set phase = 'open'$q$, '42501');
select pg_temp.expect_error($q$select public.bj_bet('redpath', 10)$q$, 'P0001'); -- no seat yet
select pg_temp.expect_error($q$select public.bj_join('nowhere')$q$, 'P0002');

-- Two players sit down.
select pg_temp.assert((public.bj_join('redpath')->>'my_seat')::int = 1, 'first seat');
select pg_temp.as_user(2);
select pg_temp.assert((public.bj_join('redpath')->>'my_seat')::int = 2, 'second seat');
select pg_temp.expect_error($q$select public.bj_bet('redpath', 0)$q$, '22023');
select pg_temp.expect_error($q$select public.bj_bet('redpath', 101)$q$, '22023');

-- Round 1. P1: 10 9 (19). P2: 10 6 (16), hits a 5 (21). Dealer: 10 up, 7 hole (17).
reset role;
update public.bj_table_secrets set test_deck = pg_temp.deck(9, 22, 35, 8, 5, 6, 4) where table_id = 'redpath';
set local role authenticated;
select pg_temp.as_user(1);
do $$
declare s jsonb := public.bj_bet('redpath', 10);
begin
  perform pg_temp.assert(s->>'phase' = 'betting', 'first bet opens the window: ' || (s->>'phase'));
  perform pg_temp.assert(pg_temp.bal(1) = 990, 'bet taken');
end $$;
select pg_temp.expect_error($q$select public.bj_bet('redpath', 10)$q$, 'P0001'); -- already bet
select pg_temp.as_user(2);
do $$
declare s jsonb := public.bj_bet('redpath', 20); -- everyone has bet: deals at once
begin
  perform pg_temp.assert(s->>'phase' = 'playing' and (s->>'turn_seat')::int = 1, 'dealt, seat 1 to act: ' || s::text);
  perform pg_temp.assert(jsonb_array_length(s->'dealer') = 1 and (s->>'dealer_hidden')::boolean, 'hole card hidden');
  perform pg_temp.assert(s::text not like '%deck%' and s::text not like '%test_deck%', 'no deck in the state');
  perform pg_temp.assert((select cardinality(dealer) from public.bj_tables where id = 'redpath') = 1, 'public row has only the up card');
  perform pg_temp.assert((s->'seats'->0->>'value')::int = 19 and (s->'seats'->1->>'value')::int = 16, 'hands dealt in seat order');
end $$;
select pg_temp.expect_error($q$select public.bj_act('redpath', 'hit')$q$, 'P0001'); -- not P2's turn
select pg_temp.expect_error($q$select public.bj_bet('redpath', 5)$q$, 'P0001');     -- round in play
select pg_temp.as_user(1);
select pg_temp.expect_error($q$select public.bj_act('redpath', 'split')$q$, '22023');
select pg_temp.expect_error($q$select public.bj_leave('redpath')$q$, 'P0001');      -- mid-hand
select pg_temp.assert((public.bj_act('redpath', 'stand')->>'turn_seat')::int = 2, 'turn passes to seat 2');
select pg_temp.as_user(2);
do $$
declare s jsonb := public.bj_act('redpath', 'hit'); -- 21: stands automatically, dealer plays, all paid
begin
  perform pg_temp.assert(s->>'phase' = 'open' and not (s->>'dealer_hidden')::boolean, 'round over: ' || s::text);
  perform pg_temp.assert((s->>'dealer_value')::int = 17 and jsonb_array_length(s->'dealer') = 2, 'dealer revealed, stands on 17');
  perform pg_temp.assert(s->'seats'->0->>'result' = 'win' and (s->'seats'->0->>'payout')::int = 20, 'P1 wins 19 v 17');
  perform pg_temp.assert(s->'seats'->1->>'result' = 'win' and (s->'seats'->1->>'payout')::int = 40, 'P2 wins 21 v 17');
  perform pg_temp.assert(pg_temp.bal(1) = 1010 and pg_temp.bal(2) = 1020, 'both paid');
  perform pg_temp.assert((select count(*) from public.bj_results) = 1, 'own results only');
end $$;

-- Round 2: only P1 bets; the window times out; P1's turn times out (auto-stand). P2 sits out.
-- P1: 10 9 (19). Dealer: 10 up, 7 hole.
reset role;
update public.bj_table_secrets set test_deck = pg_temp.deck(9, 35, 8, 6) where table_id = 'redpath';
set local role authenticated;
select pg_temp.as_user(1);
select pg_temp.assert(public.bj_bet('redpath', 10)->>'phase' = 'betting', 'window open, P2 still seated');
reset role;
update public.bj_tables set deadline = now() - interval '1 second' where id = 'redpath';
set local role authenticated;
select pg_temp.as_user(2);
do $$
declare s jsonb := public.bj_sync('redpath');
begin
  perform pg_temp.assert(s->>'phase' = 'playing' and (s->>'turn_seat')::int = 1, 'deadline deals: ' || s::text);
  perform pg_temp.assert(s->'seats'->1->>'status' = 'out', 'P2 sits this round out');
end $$;
reset role;
update public.bj_tables set deadline = now() - interval '1 second' where id = 'redpath';
set local role authenticated;
do $$
declare s jsonb := public.bj_sync('redpath'); -- P2's sync applies P1's timeout
begin
  perform pg_temp.assert(s->>'phase' = 'open', 'timeout stands and settles: ' || s::text);
  perform pg_temp.assert(s->'seats'->0->>'result' = 'win', 'P1 stood on 19 and won');
  perform pg_temp.assert(s->'seats'->1->>'result' is null, 'P2 not in the round');
end $$;

-- Round 3: double down. P1: 5 6 (11) doubles into a 10 (21). P2: 10 8 (18) stands.
-- Dealer: 10 up, 4 hole (14), draws a 2 (16) then an ace (17).
reset role;
update public.bj_table_secrets set test_deck = pg_temp.deck(4, 22, 35, 5, 7, 3, 9, 1) where table_id = 'redpath';
set local role authenticated;
select pg_temp.as_user(1);
select public.bj_bet('redpath', 20);
select pg_temp.as_user(2);
select public.bj_bet('redpath', 5);
select pg_temp.as_user(1);
do $$
declare s jsonb := public.bj_act('redpath', 'double');
begin
  perform pg_temp.assert((s->'seats'->0->>'bet')::int = 40 and (s->'seats'->0->>'doubled')::boolean and (s->'seats'->0->>'value')::int = 21, 'doubled into 21: ' || s::text);
  perform pg_temp.assert(pg_temp.bal(1) = 1020 - 40, 'both bets taken');
  perform pg_temp.assert((s->>'turn_seat')::int = 2, 'turn passes after a double');
end $$;
select pg_temp.as_user(2);
do $$
declare s jsonb := public.bj_act('redpath', 'stand');
begin
  perform pg_temp.assert((s->>'dealer_value')::int = 17 and jsonb_array_length(s->'dealer') = 4, 'dealer drew to 17: ' || s::text);
  perform pg_temp.assert(pg_temp.bal(1) = 1020 - 40 + 80, 'double paid on the full bet');
  perform pg_temp.assert(s->'seats'->1->>'result' = 'win' and (s->'seats'->1->>'payout')::int = 10, 'P2 18 v 17');
end $$;

-- One seat per student: moving tables between hands, not mid-hand.
select pg_temp.as_user(1);
select pg_temp.assert(public.bj_join('leacock')->>'my_seat' = '1', 'moved to leacock');
select pg_temp.assert((select (t->>'players')::int from jsonb_array_elements(public.bj_list_tables()) t where t->>'id' = 'redpath') = 1, 'left redpath');
reset role;
update public.bj_table_secrets set test_deck = pg_temp.deck(9, 35, 8, 6) where table_id = 'leacock';
set local role authenticated;
select pg_temp.assert(public.bj_bet('leacock', 10)->>'phase' = 'playing', 'alone at a table: deals at once');
select pg_temp.expect_error($q$select public.bj_join('redpath')$q$, 'P0001'); -- mid-hand
select pg_temp.assert(public.bj_act('leacock', 'stand')->>'phase' = 'open', 'hand over');

-- Leaving before the deal refunds the bet; an empty betting window closes without a deal.
select pg_temp.as_user(3);
select public.bj_join('redpath');
select pg_temp.as_user(2);
do $$
declare before integer := pg_temp.bal(2);
begin
  perform pg_temp.assert(public.bj_bet('redpath', 15)->>'phase' = 'betting', 'P3 still seated, window open');
  perform public.bj_leave('redpath');
  perform pg_temp.assert(pg_temp.bal(2) = before, 'bet refunded');
end $$;
reset role;
update public.bj_tables set deadline = now() - interval '1 second' where id = 'redpath';
set local role authenticated;
select pg_temp.as_user(3);
select pg_temp.assert(public.bj_sync('redpath')->>'phase' = 'open', 'no bets left: back to open');

-- Five seats; quiet seats are dropped between hands.
reset role;
insert into auth.users (id) select ('00000000-0000-4000-8000-00000000030' || n)::uuid from generate_series(4, 8) as n;
set local role authenticated;
do $$
begin
  for n in 4..7 loop
    perform pg_temp.as_user(n);
    perform public.bj_join('redpath');
  end loop;
  perform pg_temp.as_user(8);
  perform pg_temp.expect_error($q$select public.bj_join('redpath')$q$, 'P0001');
end $$;
reset role;
update public.bj_seats set last_seen = now() - interval '5 minutes' where user_id = '00000000-0000-4000-8000-000000000303';
set local role authenticated;
select pg_temp.as_user(4);
select pg_temp.assert(jsonb_array_length(public.bj_sync('redpath')->'seats') = 4, 'quiet seat dropped');
select pg_temp.as_user(8);
select pg_temp.assert(public.bj_join('redpath')->>'my_seat' is not null, 'freed seat taken');

-- Guests get nothing.
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.bj_list_tables()$q$, '42501');
select pg_temp.expect_error($q$select * from public.bj_tables$q$, '42501');
rollback;
