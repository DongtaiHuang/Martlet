-- Prediction market (migration 018). Run only on a disposable database with all migrations applied.
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
create function pg_temp.as_user(n integer) returns void language sql as $$
  select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000010' || n, true);
$$;

-- 1, 2: students. 3, 4: moderators.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000101'), ('00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000000103'), ('00000000-0000-4000-8000-000000000104');
update public.profiles set is_moderator = true
where id in ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104');

set local role authenticated;

-- Wallets start at 1000.
select pg_temp.as_user(1);
select pg_temp.assert(public.market_wallet() = 1000, 'starting balance');
select pg_temp.assert(public.market_wallet() = 1000, 'wallet is created once');

-- Proposals: validated, pending until a moderator approves, hidden from other students.
select pg_temp.expect_error($q$select public.create_market('Will it snow on convocation day?', '', now() + interval '10 minutes')$q$, '22023');
select pg_temp.expect_error($q$select public.create_market('Will it snow on convocation day?', '', now() + interval '1 year')$q$, '22023');
select pg_temp.expect_error($q$select public.create_market('Too short', '', now() + interval '2 days')$q$, '23514');
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids select 'a', public.create_market('Will Redpath stay open 24/7 during finals?', 'Resolves YES if the library website lists 24/7 hours.', now() + interval '3 days');
select pg_temp.assert((select status from public.markets where id = (select id from ids where name = 'a')) = 'pending', 'student proposal is pending');
select pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, 10)', (select id from ids where name = 'a'), 'yes', 'buy'), 'P0001');

select pg_temp.as_user(2);
select pg_temp.assert((select count(*) from public.markets where id = (select id from ids where name = 'a')) = 0, 'pending market hidden from others');
select pg_temp.expect_error(format('select public.review_market(%L, true)', (select id from ids where name = 'a')), '42501');
select pg_temp.expect_error($q$update public.markets set q_yes = 1000$q$, '42501');
select pg_temp.expect_error($q$insert into public.market_wallets (user_id, balance) values (auth.uid(), 999999)$q$, '42501');
select pg_temp.expect_error($q$update public.market_wallets set balance = 999999$q$, '42501');

select pg_temp.as_user(3);
select public.review_market((select id from ids where name = 'a'), true);
select pg_temp.expect_error(format('select public.review_market(%L, true)', (select id from ids where name = 'a')), 'P0002');

-- Trading.
select pg_temp.as_user(1);
do $$
declare v_market uuid := (select id from ids where name = 'a'); r jsonb; before double precision; after double precision;
begin
  select public.market_cost(liquidity, q_yes, q_no) into before from public.markets where id = v_market;
  r := public.trade_market(v_market, 'yes', 'buy', 100);
  select public.market_cost(liquidity, q_yes, q_no) into after from public.markets where id = v_market;
  perform pg_temp.assert((r->>'balance')::int = 900, 'buy takes the points');
  perform pg_temp.assert((r->>'probability')::float > 0.5, 'buying YES raises the price');
  perform pg_temp.assert(abs(after - before - 100) < 1e-6, 'LMSR charges exactly the points spent');
  perform pg_temp.assert((r->>'shares')::float between 100 and 200, 'shares for 100 points at >= 50%');
  perform pg_temp.assert(abs((select yes_shares from public.market_positions where market_id = v_market and user_id = auth.uid()) - (r->>'shares')::float) < 1e-9, 'position recorded');
end $$;
select pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, 501)', (select id from ids where name = 'a'), 'yes', 'buy'), '22023');
select pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, 2.5)', (select id from ids where name = 'a'), 'yes', 'buy'), '22023');
select pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, 10)', (select id from ids where name = 'a'), 'maybe', 'buy'), '22023');
select pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, -10)', (select id from ids where name = 'a'), 'yes', 'buy'), '22023');
select pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, 5)', (select id from ids where name = 'a'), 'no', 'sell'), 'P0001');

select pg_temp.as_user(2);
do $$
declare v_market uuid := (select id from ids where name = 'a'); r jsonb;
begin
  r := public.trade_market(v_market, 'no', 'buy', 300);
  perform pg_temp.assert((r->>'balance')::int = 700, 'second student buys NO');
  perform pg_temp.assert((r->>'probability')::float < 0.5, 'buying NO lowers the price');
  -- Others' wallets, positions and trades are private.
  perform pg_temp.assert((select count(*) from public.market_wallets) = 1, 'only own wallet');
  perform pg_temp.assert((select count(*) from public.market_positions) = 1, 'only own position');
  perform pg_temp.assert((select count(*) from public.market_trades) = 1, 'only own trades');
end $$;
-- Spend down to 200, then a 500-point buy is refused.
select public.trade_market((select id from ids where name = 'a'), 'yes', 'buy', 500);
select pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, 500)', (select id from ids where name = 'a'), 'yes', 'buy'), 'P0001');

-- Selling.
select pg_temp.as_user(1);
do $$
declare v_market uuid := (select id from ids where name = 'a'); held double precision; r jsonb;
begin
  select yes_shares into held from public.market_positions where market_id = v_market;
  perform pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, %s)', v_market, 'yes', 'sell', held + 1), 'P0001');
  r := public.trade_market(v_market, 'yes', 'sell', held / 2);
  perform pg_temp.assert((r->>'points')::int < 0 and (r->>'balance')::int = 900 - (r->>'points')::int, 'sale pays back points');
  perform pg_temp.assert(abs((select yes_shares from public.market_positions where market_id = v_market) - held / 2) < 1e-9, 'shares reduced');
end $$;

-- History: opening point at 50% plus one point per trade, no user ids.
do $$
declare h jsonb := public.get_market_history((select id from ids where name = 'a'));
begin
  perform pg_temp.assert(jsonb_array_length(h) = 1 + 4, 'history has the opening point and 4 trades: ' || h::text);
  perform pg_temp.assert((h->0->>'p')::float = 0.5, 'opens at 50%');
  perform pg_temp.assert(not (h::text like '%user%'), 'history has no user ids');
end $$;

-- Resolution: moderators only; not by a moderator with a position; pays 1 point per winning share.
select pg_temp.expect_error(format('select public.resolve_market(%L, %L)', (select id from ids where name = 'a'), 'yes'), '42501');
select pg_temp.as_user(3);
select pg_temp.expect_error(format('select public.resolve_market(%L, %L)', (select id from ids where name = 'a'), 'maybe'), '22023');
reset role;
create temp table balances_before on commit drop as select user_id, balance from public.market_wallets;
create temp table held_before on commit drop as select user_id, yes_shares, no_shares from public.market_positions where market_id = (select id from ids where name = 'a');
set local role authenticated;
select pg_temp.as_user(3);
select pg_temp.assert(public.resolve_market((select id from ids where name = 'a'), 'yes') = 2, 'two positions settled');
reset role;
select pg_temp.assert((select bool_and(w.balance = b.balance + floor(h.yes_shares)::int)
  from public.market_wallets w join balances_before b using (user_id) join held_before h using (user_id)), 'YES holders paid 1 point per share');
select pg_temp.assert((select status = 'resolved' and outcome = 'yes' from public.markets where id = (select id from ids where name = 'a')), 'market resolved');
set local role authenticated;
select pg_temp.expect_error(format('select public.resolve_market(%L, %L)', (select id from ids where name = 'a'), 'no'), 'P0002');
select pg_temp.as_user(1);
select pg_temp.expect_error(format('select public.trade_market(%L, %L, %L, 10)', (select id from ids where name = 'a'), 'yes', 'buy'), 'P0001');

-- A moderator's own market opens at once; holding a position blocks them from settling it;
-- cancelling refunds what was put in.
select pg_temp.as_user(3);
insert into ids select 'b', public.create_market('Will the Redbirds win the Saturday game?', '', now() + interval '2 days');
select pg_temp.assert((select status from public.markets where id = (select id from ids where name = 'b')) = 'open', 'moderator market opens directly');
select public.trade_market((select id from ids where name = 'b'), 'yes', 'buy', 50);
select pg_temp.expect_error(format('select public.resolve_market(%L, %L)', (select id from ids where name = 'b'), 'yes'), '42501');
select pg_temp.as_user(1);
select public.trade_market((select id from ids where name = 'b'), 'no', 'buy', 40);
reset role;
create temp table before_cancel on commit drop as select user_id, balance from public.market_wallets;
set local role authenticated;
select pg_temp.as_user(4);
select public.resolve_market((select id from ids where name = 'b'), 'cancelled');
reset role;
select pg_temp.assert((select bool_and(w.balance = b.balance + case p.user_id when '00000000-0000-4000-8000-000000000103' then 50 else 40 end)
  from public.market_wallets w join before_cancel b using (user_id) join public.market_positions p on p.user_id = w.user_id and p.market_id = (select id from ids where name = 'b')),
  'cancelled market refunds');

-- Leaderboard: settled markets only, display names, the caller flagged.
set local role authenticated;
select pg_temp.as_user(1);
do $$
declare lb jsonb := public.get_market_leaderboard(10);
begin
  perform pg_temp.assert(jsonb_array_length(lb->'top') >= 2, 'leaderboard lists traders');
  perform pg_temp.assert((lb->'me'->>'rank') is not null, 'caller has a rank');
  perform pg_temp.assert(not (lb::text like '%00000000-%'), 'no user ids on the leaderboard');
end $$;

-- Weekly top-up back to 1000, never above what you have.
reset role;
update public.market_wallets set balance = 5, refilled_at = now() - interval '8 days' where user_id = '00000000-0000-4000-8000-000000000102';
set local role authenticated;
select pg_temp.as_user(2);
select pg_temp.assert(public.market_wallet() = 1000, 'weekly top-up');
reset role;
update public.market_wallets set balance = 5, refilled_at = now() - interval '2 days' where user_id = '00000000-0000-4000-8000-000000000102';
set local role authenticated;
select pg_temp.assert(public.market_wallet() = 5, 'no top-up within the week');

-- Guests get nothing.
reset role;
set local role anon;
select pg_temp.expect_error($q$select * from public.markets$q$, '42501');
select pg_temp.expect_error($q$select public.market_wallet()$q$, '42501');

rollback;
