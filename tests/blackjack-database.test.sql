-- Blackjack (migration 019). Run only on a disposable database with all migrations applied.
-- Cards: rank = card % 13 (0 = ace, 1–8 = 2–9, 9 = 10, 10–12 = J Q K). Decks are fixed here so
-- every outcome is known; deal order is player, dealer, player, dealer, then draws.
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
-- A full 52-card deck that starts with the given cards (the rest in order, skipping those).
create function pg_temp.deck(variadic first integer[]) returns smallint[] language sql as $$
  select (select array_agg(c::smallint order by o) from unnest(first) with ordinality as f(c, o))
      || (select array_agg(c::smallint order by c) from generate_series(0, 51) as c where c <> all (first));
$$;
create function pg_temp.balance() returns integer language sql as $$
  select balance from public.market_wallets where user_id = '00000000-0000-4000-8000-000000000201';
$$;
create temp table hand (id uuid) on commit drop;
grant all on hand to authenticated;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000201'), ('00000000-0000-4000-8000-000000000202');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000201', true);

-- Hand values: soft and hard aces.
select pg_temp.assert(public.blackjack_value(array[0, 12]::smallint[]) = 21, 'A K = 21');
select pg_temp.assert(public.blackjack_value(array[0, 0]::smallint[]) = 12, 'A A = 12');
select pg_temp.assert(public.blackjack_value(array[0, 0, 12]::smallint[]) = 12, 'A A K = 12');
select pg_temp.assert(public.blackjack_value(array[0, 5, 9]::smallint[]) = 17, 'A 6 10 = 17');
select pg_temp.assert(public.blackjack_value(array[9, 10, 11]::smallint[]) = 30, '10 J Q = 30');

-- Players can't use the internal functions or the table.
set local role authenticated;
select pg_temp.expect_error($q$select public.blackjack_start(10, pg_temp.deck(9))$q$, '42501');
select pg_temp.expect_error($q$select public.blackjack_settle(gen_random_uuid())$q$, '42501');
select pg_temp.expect_error($q$select * from public.blackjack_hands$q$, '42501');
select pg_temp.expect_error($q$update public.blackjack_hands set payout = 999$q$, '42501');
select pg_temp.expect_error($q$select public.blackjack_deal(0)$q$, '22023');
select pg_temp.expect_error($q$select public.blackjack_deal(101)$q$, '22023');

-- 1. Stand on 19 vs dealer 17: win, paid 2x. The hole card is hidden until the end.
reset role;
insert into hand select (public.blackjack_start(10, pg_temp.deck(9, 22, 8, 6))->>'id')::uuid; -- P 10 9, D 10 7
select pg_temp.assert(pg_temp.balance() = 990, 'bet taken');
set local role authenticated;
do $$
declare s jsonb := public.blackjack_current()->'hand';
begin
  perform pg_temp.assert(jsonb_array_length(s->'dealer') = 1, 'hole card hidden: ' || s::text);
  perform pg_temp.assert((s->>'player_value')::int = 19 and (s->>'can_double')::boolean, 'player 19, can double');
  perform pg_temp.assert(s::text not like '%deck%', 'deck not exposed');
end $$;
select pg_temp.expect_error($q$select public.blackjack_deal(5)$q$, 'P0001'); -- one hand at a time
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000202', true);
select pg_temp.expect_error(format('select public.blackjack_action(%L, %L)', (select id from hand), 'stand'), 'P0002'); -- not yours
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000201', true);
select pg_temp.expect_error(format('select public.blackjack_action(%L, %L)', (select id from hand), 'split'), '22023');
do $$
declare s jsonb := public.blackjack_action((select id from hand), 'stand');
begin
  perform pg_temp.assert(s->>'result' = 'win' and (s->>'payout')::int = 20, 'win pays 2x: ' || s::text);
  perform pg_temp.assert(jsonb_array_length(s->'dealer') = 2 and (s->>'dealer_value')::int = 17, 'dealer revealed');
  perform pg_temp.assert((s->>'balance')::int = 1010, 'balance after win');
end $$;
select pg_temp.expect_error(format('select public.blackjack_action(%L, %L)', (select id from hand), 'hit'), 'P0002'); -- hand over

-- 2. Natural blackjack pays 3:2 at once (rounded down).
reset role;
truncate hand;
do $$
declare s jsonb := public.blackjack_start(15, pg_temp.deck(0, 9, 12, 5)); -- P A K, D 10 6
begin
  perform pg_temp.assert(s->>'status' = 'done' and s->>'result' = 'blackjack' and (s->>'payout')::int = 37, 'blackjack 3:2: ' || s::text);
  perform pg_temp.assert(pg_temp.balance() = 1010 - 15 + 37, 'blackjack paid');
end $$;

-- 3. Dealer blackjack beats a 20 at once; both blackjack is a push.
do $$
declare s jsonb;
begin
  s := public.blackjack_start(10, pg_temp.deck(9, 0, 22, 12)); -- P 10 10, D A K
  perform pg_temp.assert(s->>'result' = 'lose' and s->>'status' = 'done', 'dealer blackjack: ' || s::text);
  s := public.blackjack_start(10, pg_temp.deck(0, 13, 12, 25)); -- P A K, D A K
  perform pg_temp.assert(s->>'result' = 'push' and (s->>'payout')::int = 10, 'both blackjack push: ' || s::text);
end $$;

-- 4. Hit and bust: dealer doesn't draw, nothing paid.
insert into hand select (public.blackjack_start(10, pg_temp.deck(9, 22, 5, 6, 35))->>'id')::uuid; -- P 10 6, D 10 7, next 10
set local role authenticated;
do $$
declare before integer := pg_temp.balance(); s jsonb := public.blackjack_action((select id from hand), 'hit');
begin
  perform pg_temp.assert(s->>'result' = 'bust' and (s->>'payout')::int = 0, 'bust: ' || s::text);
  perform pg_temp.assert(jsonb_array_length(s->'dealer') = 2, 'dealer stands pat on a bust');
  perform pg_temp.assert(pg_temp.balance() = before, 'no payout on bust');
end $$;

-- 5. Double down on 11: second bet taken, one card (10), then the dealer draws 14 -> 16 -> 17 (2, then an ace as 1).
reset role;
truncate hand;
insert into hand select (public.blackjack_start(20, pg_temp.deck(4, 22, 5, 3, 9, 1))->>'id')::uuid; -- P 5 6, D 10 4
set local role authenticated;
do $$
declare before integer := pg_temp.balance(); s jsonb := public.blackjack_action((select id from hand), 'double');
begin
  perform pg_temp.assert(s->>'result' = 'win' and (s->>'bet')::int = 40 and (s->>'payout')::int = 80, 'double win: ' || s::text);
  perform pg_temp.assert((s->>'player_value')::int = 21 and (s->>'dealer_value')::int = 17 and jsonb_array_length(s->'dealer') = 4, 'dealer drew to 17');
  perform pg_temp.assert(pg_temp.balance() = before - 20 + 80, 'double settles both bets');
end $$;
select pg_temp.expect_error(format('select public.blackjack_action(%L, %L)', (select id from hand), 'double'), 'P0002');

-- 6. Push on equal totals returns the bet.
reset role;
do $$
declare id uuid := (public.blackjack_start(10, pg_temp.deck(9, 22, 7, 20))->>'id')::uuid; -- P 10 8, D 10 8
begin
  perform pg_temp.assert(public.blackjack_action(id, 'stand')->>'result' = 'push', 'push');
end $$;

-- 7. Not enough points; today's record.
update public.market_wallets set balance = 3 where user_id = '00000000-0000-4000-8000-000000000201';
set local role authenticated;
select pg_temp.expect_error($q$select public.blackjack_deal(5)$q$, 'P0001');
do $$
declare t jsonb := public.blackjack_current();
begin
  perform pg_temp.assert(t->'hand' = 'null'::jsonb, 'no hand in play');
  perform pg_temp.assert((t->'today'->>'hands')::int = 7, 'today counts hands: ' || t::text);
end $$;

-- A real shuffled deal works and deals 4 distinct cards.
reset role;
update public.market_wallets set balance = 100 where user_id = '00000000-0000-4000-8000-000000000201';
set local role authenticated;
do $$
declare s jsonb := public.blackjack_deal(1);
begin
  perform pg_temp.assert(jsonb_array_length(s->'player') = 2, 'shuffled deal');
end $$;

-- Guests get nothing.
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.blackjack_deal(1)$q$, '42501');

rollback;
