-- Splitting pairs (migration 027), solo and at tables. Run only on a disposable database with all
-- migrations applied. Cards: rank = card % 13 (0 = ace, 1–8 = 2–9, 9 = 10, 10–12 = J Q K).
-- Solo deal order: player, dealer, player, dealer, then draws; a split deals hand 1 then hand 2.
-- A table with one player deals in the same order.
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
  select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000040' || n, true);
$$;
create function pg_temp.bal(n integer) returns integer language sql security definer as $$
  select balance from public.market_wallets where user_id = ('00000000-0000-4000-8000-00000000040' || n)::uuid;
$$;
create temp table hand (id uuid) on commit drop;
grant all on hand to authenticated;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000401'), ('00000000-0000-4000-8000-000000000402');
select pg_temp.as_user(1);

-- Rules helpers.
select pg_temp.assert(public.blackjack_is_pair(array[7, 20]::smallint[]), '8 8 is a pair');
select pg_temp.assert(not public.blackjack_is_pair(array[12, 11]::smallint[]), 'K Q is not a pair');
select pg_temp.assert(not public.blackjack_is_pair(array[7, 20, 3]::smallint[]), 'three cards is not a pair');
select pg_temp.assert(public.blackjack_outcome(array[0, 12]::smallint[], array[9, 6]::smallint[], false) = 'win', 'split 21 pays as a win');
select pg_temp.assert(public.blackjack_outcome(array[0, 12]::smallint[], array[9, 6]::smallint[], true) = 'blackjack', 'natural 21');
set local role authenticated;
select pg_temp.expect_error($q$select public.blackjack_outcome('{1}', '{1}', true)$q$, '42501');
select pg_temp.expect_error($q$select public.blackjack_next_hand(gen_random_uuid())$q$, '42501');

-- Solo 1. 8 8 vs 10 7. Split (second bet), hand 1 = 8 3, hand 2 = 8 10. Double hand 1 into a K (21),
-- stand on hand 2 (18). Dealer 17: both win.
reset role;
insert into hand select (public.blackjack_start(10, pg_temp.deck(7, 9, 20, 6, 2, 22, 12))->>'id')::uuid;
set local role authenticated;
do $$
declare s jsonb := public.blackjack_current()->'hand';
begin
  perform pg_temp.assert((s->>'can_split')::boolean and not (s->>'split')::boolean, 'pair can split: ' || s::text);
  s := public.blackjack_action((select id from hand), 'split');
  perform pg_temp.assert((s->>'split')::boolean and (s->>'active')::int = 1 and s->>'status' = 'playing', 'split, hand 1 first: ' || s::text);
  perform pg_temp.assert((s->>'player_value')::int = 11 and (s->>'split_value')::int = 18, 'each hand got a second card');
  perform pg_temp.assert(not (s->>'can_split')::boolean and (s->>'can_double')::boolean, 'no resplit, can double');
  perform pg_temp.assert(pg_temp.bal(1) = 980, 'second bet taken');
  perform pg_temp.assert(s::text not like '%deck%', 'deck not exposed');
end $$;
select pg_temp.expect_error(format('select public.blackjack_action(%L, %L)', (select id from hand), 'split'), '22023'); -- once
do $$
declare s jsonb := public.blackjack_action((select id from hand), 'double');
begin
  perform pg_temp.assert((s->>'active')::int = 2 and s->>'status' = 'playing', 'double moves to hand 2: ' || s::text);
  perform pg_temp.assert((s->>'bet')::int = 20 and (s->>'doubled')::boolean and (s->>'player_value')::int = 21, 'hand 1 doubled');
  perform pg_temp.assert(pg_temp.bal(1) = 970, 'double bet taken');
  s := public.blackjack_action((select id from hand), 'stand');
  perform pg_temp.assert(s->>'result' = 'win' and s->>'split_result' = 'win' and (s->>'payout')::int = 60, 'both hands paid: ' || s::text);
  perform pg_temp.assert((s->>'total_bet')::int = 30 and pg_temp.bal(1) = 1030, 'balance after split');
  perform pg_temp.assert((public.blackjack_current()->'today'->>'net')::int = 30, 'today counts both bets');
end $$;

-- Solo 2. Split aces get one card each and the hand ends: A K = 21 is a win (not blackjack), A 5 loses to 17.
reset role;
do $$
declare s jsonb := public.blackjack_start(10, pg_temp.deck(0, 9, 13, 6, 12, 4));
begin
  perform pg_temp.assert(s->>'status' = 'playing' and (s->>'can_split')::boolean, 'aces: ' || s::text);
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000401', true);
  s := public.blackjack_action((s->>'id')::uuid, 'split');
  perform pg_temp.assert(s->>'status' = 'done' and s->>'result' = 'win' and s->>'split_result' = 'lose', 'split aces settle: ' || s::text);
  perform pg_temp.assert((s->>'payout')::int = 20, '21 after a split pays 1:1');
end $$;

-- Solo 3. Hand 1 busts, play moves to hand 2; the dealer still draws for it (16 + K = bust).
truncate hand;
insert into hand select (public.blackjack_start(10, pg_temp.deck(7, 9, 20, 5, 4, 22, 12, 25))->>'id')::uuid;
set local role authenticated;
do $$
declare s jsonb := public.blackjack_action((select id from hand), 'split'); -- hand 1 = 8 5, hand 2 = 8 10
begin
  s := public.blackjack_action((select id from hand), 'hit'); -- 8 5 K = 23
  perform pg_temp.assert((s->>'active')::int = 2 and s->>'status' = 'playing' and (s->>'can_double')::boolean, 'bust moves to hand 2: ' || s::text);
  s := public.blackjack_action((select id from hand), 'stand');
  perform pg_temp.assert(s->>'result' = 'bust' and s->>'split_result' = 'win' and (s->>'payout')::int = 20, 'dealer busts: ' || s::text);
  perform pg_temp.assert(jsonb_array_length(s->'dealer') = 3, 'dealer drew for hand 2');
end $$;

-- Solo 4. Not a pair (K Q) can't split; not enough points can't split.
reset role;
truncate hand;
insert into hand select (public.blackjack_start(10, pg_temp.deck(12, 9, 11, 6))->>'id')::uuid;
set local role authenticated;
select pg_temp.assert(not (public.blackjack_current()->'hand'->>'can_split')::boolean, 'K Q: no split offered');
select pg_temp.expect_error(format('select public.blackjack_action(%L, %L)', (select id from hand), 'split'), '22023');
select public.blackjack_action((select id from hand), 'stand');
reset role;
truncate hand;
insert into hand select (public.blackjack_start(10, pg_temp.deck(7, 9, 20, 6))->>'id')::uuid;
update public.market_wallets set balance = 5 where user_id = '00000000-0000-4000-8000-000000000401';
set local role authenticated;
select pg_temp.expect_error(format('select public.blackjack_action(%L, %L)', (select id from hand), 'split'), 'P0001');
reset role;
update public.market_wallets set balance = 1000 where user_id = '00000000-0000-4000-8000-000000000401';
set local role authenticated;
select public.blackjack_action((select id from hand), 'stand');

-- Table 1. Alone at a table: split 8s, double hand 1 into 21, stand on hand 2, both win.
select pg_temp.as_user(1);
select public.bj_join('bronfman');
reset role;
update public.bj_table_secrets set test_deck = pg_temp.deck(7, 9, 20, 6, 2, 22, 12) where table_id = 'bronfman';
set local role authenticated;
do $$
declare s jsonb := public.bj_bet('bronfman', 10); before integer := pg_temp.bal(1);
begin
  perform pg_temp.assert(s->>'phase' = 'playing' and (s->>'turn_seat')::int = 1, 'dealt: ' || s::text);
  s := public.bj_act('bronfman', 'split');
  perform pg_temp.assert(jsonb_array_length(s->'seats'->0->'split_cards') = 2 and (s->'seats'->0->>'active')::int = 1, 'split at the table: ' || s::text);
  perform pg_temp.assert((s->'seats'->0->>'value')::int = 11 and (s->'seats'->0->>'split_value')::int = 18, 'second cards dealt');
  perform pg_temp.assert(pg_temp.bal(1) = before - 10, 'second bet taken');
  perform pg_temp.assert(s::text not like '%deck%', 'no deck in the state');
  s := public.bj_act('bronfman', 'double');
  perform pg_temp.assert(s->>'phase' = 'playing' and (s->>'turn_seat')::int = 1 and (s->'seats'->0->>'active')::int = 2, 'still your turn, hand 2: ' || s::text);
  s := public.bj_act('bronfman', 'stand');
  perform pg_temp.assert(s->>'phase' = 'open', 'round over: ' || s::text);
  perform pg_temp.assert(s->'seats'->0->>'result' = 'win' and s->'seats'->0->>'split_result' = 'win' and (s->'seats'->0->>'payout')::int = 60, 'both hands paid');
  perform pg_temp.assert(pg_temp.bal(1) = before - 20 + 60, 'split and double bets taken, both hands paid');
  perform pg_temp.assert((select bet from public.bj_results order by id desc limit 1) = 30, 'results count both bets');
end $$;

-- Table 2. Split aces end your turn at once.
reset role;
update public.bj_table_secrets set test_deck = pg_temp.deck(0, 9, 13, 6, 12, 4) where table_id = 'bronfman';
set local role authenticated;
select public.bj_bet('bronfman', 10);
do $$
declare s jsonb := public.bj_act('bronfman', 'split');
begin
  perform pg_temp.assert(s->>'phase' = 'open' and s->'seats'->0->>'result' = 'win' and s->'seats'->0->>'split_result' = 'lose', 'split aces: ' || s::text);
end $$;

-- Table 3. Two players. P1 splits 8s and stands on both hands; then it's P2's turn.
-- Deal order with 2 players: firsts, dealer up, seconds, dealer hole. P1 8 8, P2 10 9, dealer 10 7.
select pg_temp.as_user(2);
select public.bj_join('bronfman');
reset role;
update public.bj_table_secrets set test_deck = pg_temp.deck(7, 9, 22, 20, 8, 6, 2, 4) where table_id = 'bronfman';
set local role authenticated;
select pg_temp.as_user(1);
select public.bj_bet('bronfman', 10);
select pg_temp.as_user(2);
select public.bj_bet('bronfman', 10);
select pg_temp.expect_error($q$select public.bj_act('bronfman', 'split')$q$, 'P0001'); -- not P2's turn
select pg_temp.as_user(1);
select public.bj_act('bronfman', 'split');
select pg_temp.assert((public.bj_act('bronfman', 'stand')->>'turn_seat')::int = 1, 'hand 2 is still P1');
select pg_temp.assert((public.bj_act('bronfman', 'stand')->>'turn_seat')::int = 2, 'then P2');
select pg_temp.as_user(2);
do $$
declare s jsonb := public.bj_act('bronfman', 'stand');
begin
  perform pg_temp.assert(s->'seats'->0->>'result' = 'lose' and s->'seats'->0->>'split_result' = 'lose', 'P1 11 and 13 lose to 17: ' || s::text);
  perform pg_temp.assert(s->'seats'->1->>'result' = 'win' and s->'seats'->1->>'split_result' is null, 'P2 19 wins');
end $$;

-- A new round clears the split.
select pg_temp.as_user(1);
select pg_temp.assert(public.bj_bet('bronfman', 5)->'seats'->0->'split_cards' = 'null'::jsonb, 'split cleared for the next round');
rollback;
