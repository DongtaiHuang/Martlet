-- Martlet Coin (MLT): a simulated coin for a trading sim (issue #148, ADR 0036).
-- NOT a cryptocurrency: no blockchain, no wallets, no real money. MLT is bought and sold with
-- Martlet points, which are play money (ADR 0033): they can't be bought, cashed out or exchanged.
--
-- One shared price, generated on the server one minute at a time, the first time anyone asks after
-- the minute passes. Each minute's move is a random walk (0.4% volatility) that drifts back toward
-- 10 points, nudged up by campus activity (meetups created in the last hour) and by the previous
-- minute's net buying (selling pushes it down). Prices are stored, so everyone sees the same chart.
-- Trades fill at the current price with a 0.5% spread, in one locking function.
begin;

create table public.mlt_prices (
  t timestamptz primary key,            -- the minute
  price numeric(12, 4) not null check (price > 0)
);

create table public.mlt_holdings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins numeric(18, 6) not null default 0 check (coins >= 0),
  spent integer not null default 0 check (spent >= 0),       -- points paid for coins
  received integer not null default 0 check (received >= 0) -- points received from sales
);

create table public.mlt_trades (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  side text not null check (side in ('buy', 'sell')),
  coins numeric(18, 6) not null check (coins > 0),
  points integer not null check (points >= 0),
  price numeric(12, 4) not null,        -- the fill price, spread included
  created_at timestamptz not null default clock_timestamp()
);
create index mlt_trades_time_idx on public.mlt_trades (created_at);
create index mlt_trades_user_idx on public.mlt_trades (user_id, created_at desc);

alter table public.mlt_prices enable row level security;
alter table public.mlt_holdings enable row level security;
alter table public.mlt_trades enable row level security;
revoke all on public.mlt_prices, public.mlt_holdings, public.mlt_trades from public, anon, authenticated;
grant select on public.mlt_prices, public.mlt_holdings, public.mlt_trades to authenticated;
create policy "Read coin prices" on public.mlt_prices for select to authenticated using (true);
create policy "Read own coin holdings" on public.mlt_holdings for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own coin trades" on public.mlt_trades for select to authenticated using (user_id = (select auth.uid()));

-- Price engine ------------------------------------------------------------------------------
-- Fills in every minute up to now and returns the current price. Long gaps restart from 7 days ago.
create function public.mlt_tick() returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := date_trunc('minute', now());
  v_t timestamptz; v_last numeric; v_price double precision; v_activity integer; v_flow double precision; v_z double precision;
begin
  perform pg_advisory_xact_lock(hashtext('martlet-coin'));
  select t, price into v_t, v_last from public.mlt_prices order by t desc limit 1;
  if v_t is null then
    insert into public.mlt_prices (t, price) values (v_now, 10);
    return 10;
  end if;
  if v_t >= v_now then return v_last; end if;
  v_price := v_last;
  if v_t < v_now - interval '7 days' then v_t := v_now - interval '7 days'; end if;

  v_activity := least(20, (select count(*) from public.meetups where created_at > now() - interval '1 hour'))::integer;
  while v_t < v_now loop
    v_t := v_t + interval '1 minute';
    -- Net points traded in the minute before (buys positive, sales negative).
    select coalesce(sum(case when side = 'buy' then points else -points end), 0) into v_flow
    from public.mlt_trades where created_at >= v_t - interval '1 minute' and created_at < v_t;
    v_z := sqrt(-2 * ln(greatest(random(), 1e-12))) * cos(2 * pi() * random());  -- standard normal
    v_price := v_price * exp(
      -0.002 * ln(v_price / 10)          -- drift back toward 10
      + 0.00003 * v_activity             -- busy campus, rising coin
      + 0.001 * v_flow / 100             -- buying pressure: +0.1% per 100 points net
      + 0.004 * v_z);                    -- noise
    v_price := least(1000, greatest(0.5, v_price));
    insert into public.mlt_prices (t, price) values (v_t, round(v_price::numeric, 4));
  end loop;
  return round(v_price::numeric, 4);
end $$;

-- Current price and the last 24 hours.
create function public.mlt_quote() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_price numeric := public.mlt_tick(); v_open numeric;
begin
  select price into v_open from public.mlt_prices where t >= now() - interval '24 hours' order by t limit 1;
  return jsonb_build_object(
    'price', v_price,
    'open_24h', coalesce(v_open, v_price),
    'high_24h', (select max(price) from public.mlt_prices where t >= now() - interval '24 hours'),
    'low_24h', (select min(price) from public.mlt_prices where t >= now() - interval '24 hours'),
    'volume_24h', (select coalesce(sum(points), 0) from public.mlt_trades where created_at >= now() - interval '24 hours'),
    'traders_24h', (select count(distinct user_id) from public.mlt_trades where created_at >= now() - interval '24 hours'),
    'at', date_trunc('minute', now())
  );
end $$;

-- Chart points: 1h = every minute, 1d = every 5 minutes, 7d = every hour.
create function public.mlt_history(p_range text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_since interval; v_step integer;
begin
  perform public.mlt_tick();
  case p_range
    when '1h' then v_since := interval '1 hour'; v_step := 1;
    when '1d' then v_since := interval '1 day'; v_step := 5;
    when '7d' then v_since := interval '7 days'; v_step := 60;
    else raise exception 'range must be 1h, 1d or 7d' using errcode = '22023';
  end case;
  return coalesce((
    select jsonb_agg(jsonb_build_object('t', t, 'p', price) order by t)
    from public.mlt_prices
    where t >= now() - v_since
      and ((extract(epoch from t)::bigint / 60) % v_step = 0 or t = (select max(t) from public.mlt_prices))
  ), '[]'::jsonb);
end $$;

-- Trading ----------------------------------------------------------------------------------
-- Buy: p_amount is points (1–500, whole). Sell: p_amount is coins (up to what you hold).
-- Buys fill at price + 0.5%, sales at price − 0.5%, paid in whole points rounded down.
create function public.mlt_trade(p_side text, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public.market_require_user();
  v_price numeric; v_fill numeric; v_balance integer; v_held numeric; v_coins numeric; v_points integer;
begin
  if p_side not in ('buy', 'sell') or p_amount is null or not (p_amount > 0) then
    raise exception 'invalid trade' using errcode = '22023';
  end if;
  if (select count(*) from public.mlt_trades where user_id = v_user and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'trading too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  v_price := public.mlt_tick();

  perform public.market_wallet();
  select balance into v_balance from public.market_wallets where user_id = v_user for update;
  insert into public.mlt_holdings (user_id) values (v_user) on conflict do nothing;
  select coins into v_held from public.mlt_holdings where user_id = v_user for update;

  if p_side = 'buy' then
    if p_amount <> trunc(p_amount) or p_amount > 500 then
      raise exception 'buy with 1 to 500 whole points' using errcode = '22023';
    end if;
    v_points := p_amount::integer;
    if v_points > v_balance then raise exception 'not enough points' using errcode = 'P0001', hint = 'balance'; end if;
    v_fill := round(v_price * 1.005, 4);
    v_coins := trunc(v_points / v_fill, 6);
    update public.market_wallets set balance = balance - v_points where user_id = v_user returning balance into v_balance;
    update public.mlt_holdings set coins = coins + v_coins, spent = spent + v_points where user_id = v_user returning coins into v_held;
  else
    -- Selling (almost) everything sells exactly what you hold.
    v_coins := case when p_amount >= v_held - 0.000001 then v_held else p_amount end;
    if v_coins <= 0 or p_amount > v_held + 0.000001 then
      raise exception 'not enough coins' using errcode = 'P0001', hint = 'coins';
    end if;
    v_fill := round(v_price * 0.995, 4);
    v_points := floor(v_coins * v_fill)::integer;
    update public.market_wallets set balance = balance + v_points where user_id = v_user returning balance into v_balance;
    update public.mlt_holdings set coins = coins - v_coins, received = received + v_points where user_id = v_user returning coins into v_held;
  end if;

  insert into public.mlt_trades (user_id, side, coins, points, price) values (v_user, p_side, v_coins, v_points, v_fill);
  return jsonb_build_object('side', p_side, 'coins', v_coins, 'points', v_points, 'price', v_price, 'fill', v_fill, 'balance', v_balance, 'held', v_held);
end $$;

-- Your coins, what they'd sell for now, and your profit (sales + current value − cost).
create function public.mlt_portfolio() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_price numeric := public.mlt_tick(); h public.mlt_holdings%rowtype; v_value integer;
begin
  select * into h from public.mlt_holdings where user_id = v_user;
  v_value := floor(coalesce(h.coins, 0) * round(v_price * 0.995, 4))::integer;
  return jsonb_build_object(
    'coins', coalesce(h.coins, 0), 'spent', coalesce(h.spent, 0), 'received', coalesce(h.received, 0),
    'value', v_value, 'profit', coalesce(h.received, 0) + v_value - coalesce(h.spent, 0),
    'balance', public.market_wallet(),
    'trades', coalesce((select jsonb_agg(jsonb_build_object('side', side, 'coins', coins, 'points', points, 'price', price, 'at', created_at) order by created_at desc)
                        from (select * from public.mlt_trades where user_id = v_user order by created_at desc limit 10) t), '[]'::jsonb)
  );
end $$;

-- Best traders by profit (sales + current value − cost). Display names only.
create function public.mlt_leaderboard(p_limit integer default 10) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_fill numeric := round(public.mlt_tick() * 0.995, 4);
begin
  return (
    with scores as (
      select h.user_id, (h.received + floor(h.coins * v_fill) - h.spent)::integer as profit
      from public.mlt_holdings h where h.spent > 0
    ), ranked as (
      select s.*, coalesce(p.display_name, 'Martlet Student') as name, rank() over (order by s.profit desc) as rank
      from scores s left join public.profiles p on p.id = s.user_id
    )
    select jsonb_build_object(
      'top', coalesce((select jsonb_agg(jsonb_build_object('rank', rank, 'name', name, 'profit', profit, 'me', user_id = (select auth.uid())) order by rank, name)
                       from (select * from ranked order by rank, name limit least(greatest(p_limit, 1), 50)) t), '[]'::jsonb),
      'me', (select jsonb_build_object('rank', rank, 'profit', profit) from ranked where user_id = (select auth.uid()))
    )
  );
end $$;

revoke execute on function public.mlt_tick(), public.mlt_quote(), public.mlt_history(text), public.mlt_trade(text, numeric),
  public.mlt_portfolio(), public.mlt_leaderboard(integer) from public, anon, authenticated;
grant execute on function public.mlt_quote(), public.mlt_history(text), public.mlt_trade(text, numeric),
  public.mlt_portfolio(), public.mlt_leaderboard(integer) to authenticated;

commit;
