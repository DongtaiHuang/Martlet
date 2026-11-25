-- Martlet Coin (migration 021). Run only on a disposable database with all migrations applied.
-- Prices are random, so checks compare against the stored price rather than fixed numbers.
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
  select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000040' || n, true);
$$;
-- Owner rights: read any wallet and the latest price.
create function pg_temp.bal(n integer) returns integer language sql security definer as $$
  select balance from public.market_wallets where user_id = ('00000000-0000-4000-8000-00000000040' || n)::uuid;
$$;
create function pg_temp.price() returns numeric language sql security definer as $$
  select price from public.mlt_prices order by t desc limit 1;
$$;

insert into auth.users (id) values ('00000000-0000-4000-8000-000000000401'), ('00000000-0000-4000-8000-000000000402');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000401', true);

-- Price engine: starts at 10, fills every missed minute up to now, once.
delete from public.mlt_prices;
select pg_temp.assert(public.mlt_tick() = 10, 'first price is 10');
delete from public.mlt_prices;
insert into public.mlt_prices (t, price) values (date_trunc('minute', now()) - interval '10 minutes', 10);
select public.mlt_tick();
select pg_temp.assert((select count(*) from public.mlt_prices) = 11, 'ten missed minutes filled');
select pg_temp.assert((select max(t) from public.mlt_prices) = date_trunc('minute', now()), 'up to the current minute');
select pg_temp.assert((select bool_and(price between 0.5 and 1000) from public.mlt_prices), 'prices in bounds');
select public.mlt_tick();
select pg_temp.assert((select count(*) from public.mlt_prices) = 11, 'no duplicate minutes');
-- A month-long gap restarts from 7 days ago instead of generating a month of minutes.
delete from public.mlt_prices;
insert into public.mlt_prices (t, price) values (date_trunc('minute', now()) - interval '30 days', 12);
select public.mlt_tick();
select pg_temp.assert((select count(*) from public.mlt_prices) between 7 * 1440 and 7 * 1440 + 2, 'gap capped at 7 days');

set local role authenticated;
select pg_temp.as_user(1);

-- Players can't run the engine or write prices.
select pg_temp.expect_error($q$select public.mlt_tick()$q$, '42501');
select pg_temp.expect_error($q$insert into public.mlt_prices (t, price) values (now() + interval '1 hour', 999)$q$, '42501');
select pg_temp.expect_error($q$update public.mlt_holdings set coins = 1000$q$, '42501');

-- Quote and history.
do $$
declare q jsonb := public.mlt_quote();
begin
  perform pg_temp.assert((q->>'price')::numeric = pg_temp.price(), 'quote is the latest price');
  perform pg_temp.assert((q->>'low_24h')::numeric <= (q->>'price')::numeric and (q->>'price')::numeric <= (q->>'high_24h')::numeric, 'price within the 24h range');
  perform pg_temp.assert(jsonb_array_length(public.mlt_history('1h')) between 60 and 62, '1h: every minute');
  perform pg_temp.assert(jsonb_array_length(public.mlt_history('1d')) between 288 and 290, '1d: every 5 minutes');
  perform pg_temp.assert(jsonb_array_length(public.mlt_history('7d')) between 168 and 170, '7d: every hour');
end $$;
select pg_temp.expect_error($q$select public.mlt_history('1y')$q$, '22023');

-- Buying: whole points, 1–500, spread of 0.5%.
select pg_temp.expect_error($q$select public.mlt_trade('buy', 501)$q$, '22023');
select pg_temp.expect_error($q$select public.mlt_trade('buy', 2.5)$q$, '22023');
select pg_temp.expect_error($q$select public.mlt_trade('hold', 10)$q$, '22023');
select pg_temp.expect_error($q$select public.mlt_trade('buy', -5)$q$, '22023');
select pg_temp.expect_error($q$select public.mlt_trade('sell', 1)$q$, 'P0001'); -- nothing to sell
do $$
declare r jsonb := public.mlt_trade('buy', 100); p numeric := pg_temp.price();
begin
  perform pg_temp.assert(pg_temp.bal(1) = 900 and (r->>'balance')::int = 900, 'points taken');
  perform pg_temp.assert((r->>'fill')::numeric = round(p * 1.005, 4), 'buy fills 0.5% above: ' || r::text);
  perform pg_temp.assert((r->>'coins')::numeric = trunc(100 / round(p * 1.005, 4), 6), 'coins for 100 points');
  perform pg_temp.assert((select coins from public.mlt_holdings) = (r->>'coins')::numeric, 'holding recorded');
end $$;

-- Selling: up to what you hold, paid in whole points 0.5% below.
do $$
declare held numeric := (select coins from public.mlt_holdings); p numeric := pg_temp.price(); r jsonb;
begin
  perform pg_temp.expect_error(format('select public.mlt_trade(%L, %s)', 'sell', held + 1), 'P0001');
  r := public.mlt_trade('sell', held / 2);
  perform pg_temp.assert((r->>'points')::int = floor((held / 2) * round(p * 0.995, 4)), 'sale pays rounded down: ' || r::text);
  perform pg_temp.assert(pg_temp.bal(1) = 900 + (r->>'points')::int, 'points back');
  r := public.mlt_trade('sell', (select coins from public.mlt_holdings));  -- everything left
  perform pg_temp.assert((select coins from public.mlt_holdings) = 0, 'sold out');
  perform pg_temp.assert(pg_temp.bal(1) < 1000, 'a round trip costs the spread');
end $$;

-- Portfolio maths: profit = received + value − spent.
select public.mlt_trade('buy', 50);
do $$
declare f jsonb := public.mlt_portfolio();
begin
  perform pg_temp.assert((f->>'profit')::int = (f->>'received')::int + (f->>'value')::int - (f->>'spent')::int, 'profit maths: ' || f::text);
  perform pg_temp.assert((f->>'spent')::int = 150 and jsonb_array_length(f->'trades') = 4, 'spent and trade list');
end $$;

-- Privacy: others see prices, not your holdings or trades.
select pg_temp.as_user(2);
do $$
begin
  perform pg_temp.assert((select count(*) from public.mlt_holdings) = 0, 'no one else''s holdings');
  perform pg_temp.assert((select count(*) from public.mlt_trades) = 0, 'no one else''s trades');
  perform pg_temp.assert((select count(*) from public.mlt_prices) > 0, 'prices are public to members');
  perform pg_temp.assert((public.mlt_portfolio()->>'coins')::numeric = 0, 'empty portfolio');
end $$;
select pg_temp.expect_error($q$select public.mlt_trade('buy', 5000)$q$, '22023');

-- Leaderboard: names only, the caller flagged.
select public.mlt_trade('buy', 10);
do $$
declare lb jsonb := public.mlt_leaderboard(10);
begin
  perform pg_temp.assert(jsonb_array_length(lb->'top') = 2, 'two traders: ' || lb::text);
  perform pg_temp.assert(lb->'me' is not null and lb::text not like '%00000000-%', 'my rank, no ids');
end $$;

-- Rate limit: 20 trades a minute.
do $$
begin
  for i in 1..19 loop perform public.mlt_trade('buy', 1); end loop;
  perform pg_temp.expect_error($q$select public.mlt_trade('buy', 1)$q$, 'P0001');
end $$;

-- Guests get nothing.
reset role;
set local role anon;
select pg_temp.expect_error($q$select public.mlt_quote()$q$, '42501');
select pg_temp.expect_error($q$select * from public.mlt_prices$q$, '42501');

rollback;
