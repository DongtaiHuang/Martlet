-- Campus prediction market (issue #139, ADR 0033).
-- PLAY MONEY ONLY. Martlet points can't be bought, cashed out, transferred or exchanged for
-- anything of value. Every student starts with 1000 and is topped back up to 1000 once a week.
--
-- Yes/no questions about campus events. Prices come from an LMSR market maker (lib/market-math.ts
-- mirrors the math): a YES share pays 1 point if the market resolves YES, a NO share if NO.
-- Students propose markets; moderators (migration 017) approve, then resolve them.
-- Every write goes through a SECURITY DEFINER function that uses the session user, locks the
-- rows it changes and checks balances and holdings. Nobody can write these tables directly.
begin;

-- Tables -----------------------------------------------------------------------------------
create table public.market_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null check (balance >= 0),
  refilled_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  question text not null check (question = btrim(question) and char_length(question) between 10 and 140),
  -- How it resolves: the source and the exact condition.
  details text not null default '' check (char_length(details) <= 1000),
  closes_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'open', 'rejected', 'resolved', 'cancelled')),
  outcome text check (outcome in ('yes', 'no')),
  -- LMSR state: liquidity b and outstanding YES / NO shares.
  liquidity double precision not null default 300 check (liquidity between 10 and 10000),
  q_yes double precision not null default 0,
  q_no double precision not null default 0,
  volume integer not null default 0 check (volume >= 0),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  check ((status = 'resolved') = (outcome is not null))
);
create index markets_status_idx on public.markets (status, closes_at);
create index markets_creator_idx on public.markets (creator_id, created_at desc);

create table public.market_positions (
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  yes_shares double precision not null default 0 check (yes_shares >= 0),
  no_shares double precision not null default 0 check (no_shares >= 0),
  -- Points paid in minus points paid back by sales; refunded if the market is cancelled.
  net_spent integer not null default 0,
  payout integer,
  primary key (market_id, user_id)
);
create index market_positions_user_idx on public.market_positions (user_id);

-- Append-only trade log; the probability after each trade draws the price graph.
create table public.market_trades (
  id bigint generated always as identity primary key,
  market_id uuid not null references public.markets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  side text not null check (side in ('yes', 'no')),
  shares double precision not null check (shares <> 0),  -- positive bought, negative sold
  points integer not null,                               -- positive paid in, negative paid back
  probability double precision not null check (probability > 0 and probability < 1),
  created_at timestamptz not null default clock_timestamp()
);
create index market_trades_market_idx on public.market_trades (market_id, created_at);
create index market_trades_user_idx on public.market_trades (user_id, created_at desc);

alter table public.market_wallets enable row level security;
alter table public.markets enable row level security;
alter table public.market_positions enable row level security;
alter table public.market_trades enable row level security;
revoke all on public.market_wallets, public.markets, public.market_positions, public.market_trades from public, anon, authenticated;
grant select on public.market_wallets, public.markets, public.market_positions, public.market_trades to authenticated;

-- Live and finished markets for everyone signed in; your own proposals for you; all for moderators.
create policy "Read markets" on public.markets for select to authenticated
  using (status in ('open', 'resolved', 'cancelled') or creator_id = (select auth.uid()) or public.is_moderator());
-- Wallets, positions and trades: only your own. The price history is public through
-- get_market_history(), which leaves out who traded.
create policy "Read own wallet" on public.market_wallets for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own positions" on public.market_positions for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own trades" on public.market_trades for select to authenticated using (user_id = (select auth.uid()));

-- LMSR -------------------------------------------------------------------------------------
-- C(q) = b·ln(e^(yes/b) + e^(no/b)), written to avoid overflow.
create function public.market_cost(b double precision, yes double precision, no double precision)
returns double precision language sql immutable set search_path = '' as $$
  select greatest(yes, no) + b * ln(exp((yes - greatest(yes, no)) / b) + exp((no - greatest(yes, no)) / b));
$$;

create function public.market_probability(b double precision, yes double precision, no double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 1 / (1 + exp((no - yes) / b));
$$;

-- Wallets ----------------------------------------------------------------------------------
create function public.market_require_user() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'sign in required' using errcode = '42501'; end if;
  return (select auth.uid());
end $$;

-- The caller's balance: creates the wallet at 1000, and tops it back up to 1000 once a week.
create function public.market_wallet() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_balance integer;
begin
  insert into public.market_wallets (user_id, balance) values (v_user, 1000) on conflict (user_id) do nothing;
  update public.market_wallets
  set balance = greatest(balance, 1000), refilled_at = now()
  where user_id = v_user and refilled_at < now() - interval '7 days'
  returning balance into v_balance;
  if v_balance is null then select balance into v_balance from public.market_wallets where user_id = v_user; end if;
  return v_balance;
end $$;

-- Markets ----------------------------------------------------------------------------------
-- Students propose (3 a day); moderators approve. A moderator's own market opens at once.
create function public.create_market(p_question text, p_details text, p_closes_at timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_mod boolean := public.is_moderator(); v_id uuid;
begin
  if p_closes_at is null or p_closes_at < now() + interval '1 hour' or p_closes_at > now() + interval '180 days' then
    raise exception 'closing time must be between 1 hour and 180 days away' using errcode = '22023';
  end if;
  if not v_mod and (select count(*) from public.markets where creator_id = v_user and created_at > now() - interval '1 day') >= 3 then
    raise exception 'proposing too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  insert into public.markets (creator_id, question, details, closes_at, status, reviewed_at)
  values (v_user, btrim(p_question), btrim(coalesce(p_details, '')), p_closes_at,
          case when v_mod then 'open' else 'pending' end, case when v_mod then now() end)
  returning id into v_id;
  return v_id;
end $$;

create function public.review_market(p_market uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  update public.markets
  set status = case when p_approve then 'open' else 'rejected' end, reviewed_at = now()
  where id = p_market and status = 'pending' and (not p_approve or closes_at > now());
  if not found then raise exception 'no pending market to review' using errcode = 'P0002'; end if;
end $$;

-- Trading ----------------------------------------------------------------------------------
-- Buy: p_amount is points (1–500, whole). Sell: p_amount is shares (up to what you hold).
-- Sales pay back whole points, rounded down, so rounding can't be used to mint points.
-- Returns { shares, points, probability, balance }.
create function public.trade_market(p_market uuid, p_side text, p_action text, p_amount double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public.market_require_user();
  m public.markets%rowtype;
  v_balance integer;
  v_held double precision;
  v_shares double precision;
  v_points integer;
  v_target double precision;
  v_yes double precision;
  v_no double precision;
  v_prob double precision;
begin
  if p_side not in ('yes', 'no') or p_action not in ('buy', 'sell') or p_amount is null or not (p_amount > 0) then
    raise exception 'invalid trade' using errcode = '22023';
  end if;
  if (select count(*) from public.market_trades where user_id = v_user and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'trading too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;

  select * into m from public.markets where id = p_market for update;
  if not found or m.status <> 'open' or m.closes_at <= now() then
    raise exception 'market is not open for trading' using errcode = 'P0001', hint = 'closed';
  end if;

  perform public.market_wallet();
  select balance into v_balance from public.market_wallets where user_id = v_user for update;
  insert into public.market_positions (market_id, user_id) values (p_market, v_user) on conflict do nothing;
  select case when p_side = 'yes' then yes_shares else no_shares end into v_held
  from public.market_positions where market_id = p_market and user_id = v_user for update;

  v_yes := m.q_yes; v_no := m.q_no;
  if p_action = 'buy' then
    if p_amount <> trunc(p_amount) or p_amount > 500 then
      raise exception 'buy between 1 and 500 whole points' using errcode = '22023';
    end if;
    v_points := p_amount::integer;
    if v_points > v_balance then raise exception 'not enough points' using errcode = 'P0001', hint = 'balance'; end if;
    -- Solve C(q') = C(q) + points for the side bought.
    v_target := public.market_cost(m.liquidity, v_yes, v_no) + v_points;
    if p_side = 'yes' then
      v_shares := v_target + m.liquidity * ln(1 - exp((v_no - v_target) / m.liquidity)) - v_yes;
      v_yes := v_yes + v_shares;
    else
      v_shares := v_target + m.liquidity * ln(1 - exp((v_yes - v_target) / m.liquidity)) - v_no;
      v_no := v_no + v_shares;
    end if;
  else
    -- Selling (almost) everything sells exactly what you hold.
    v_shares := case when p_amount >= v_held - 1e-9 then v_held else p_amount end;
    if v_shares <= 0 or p_amount > v_held + 1e-9 then
      raise exception 'not enough shares' using errcode = 'P0001', hint = 'shares';
    end if;
    if p_side = 'yes' then v_yes := v_yes - v_shares; else v_no := v_no - v_shares; end if;
    v_points := -floor(public.market_cost(m.liquidity, m.q_yes, m.q_no) - public.market_cost(m.liquidity, v_yes, v_no))::integer;
    v_shares := -v_shares;
  end if;

  v_prob := public.market_probability(m.liquidity, v_yes, v_no);
  if not (v_prob > 0 and v_prob < 1) then
    raise exception 'trade too large for this market' using errcode = 'P0001', hint = 'limit';
  end if;

  update public.markets set q_yes = v_yes, q_no = v_no, volume = volume + abs(v_points) where id = p_market;
  update public.market_wallets set balance = balance - v_points where user_id = v_user returning balance into v_balance;
  update public.market_positions
  set yes_shares = case when p_side = 'yes' then greatest(0, yes_shares + v_shares) else yes_shares end,
      no_shares  = case when p_side = 'no'  then greatest(0, no_shares + v_shares)  else no_shares end,
      net_spent  = net_spent + v_points
  where market_id = p_market and user_id = v_user;
  insert into public.market_trades (market_id, user_id, side, shares, points, probability)
  values (p_market, v_user, p_side, v_shares, v_points, v_prob);

  return jsonb_build_object('shares', v_shares, 'points', v_points, 'probability', v_prob, 'balance', v_balance);
end $$;

-- Resolution -------------------------------------------------------------------------------
-- A moderator settles an open market: 'yes' or 'no' pays 1 point per winning share (rounded
-- down); 'cancelled' refunds what each student put in. A moderator who holds a position in the
-- market can't settle it. Returns the number of positions paid.
create function public.resolve_market(p_market uuid, p_outcome text) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_status text; v_count integer;
begin
  if not public.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_outcome not in ('yes', 'no', 'cancelled') then raise exception 'invalid outcome' using errcode = '22023'; end if;
  select status into v_status from public.markets where id = p_market for update;
  if v_status is distinct from 'open' then raise exception 'no open market to resolve' using errcode = 'P0002'; end if;
  if exists (select 1 from public.market_positions where market_id = p_market and user_id = v_user and (yes_shares > 0 or no_shares > 0 or net_spent <> 0)) then
    raise exception 'you have a position in this market; ask another moderator' using errcode = '42501', hint = 'conflict';
  end if;

  update public.market_positions
  set payout = case p_outcome
    when 'yes' then floor(yes_shares)::integer
    when 'no' then floor(no_shares)::integer
    else greatest(net_spent, 0) end
  where market_id = p_market;
  get diagnostics v_count = row_count;

  update public.market_wallets w set balance = w.balance + p.payout
  from public.market_positions p
  where p.market_id = p_market and p.user_id = w.user_id and p.payout > 0;

  update public.markets
  set status = case when p_outcome = 'cancelled' then 'cancelled' else 'resolved' end,
      outcome = case when p_outcome = 'cancelled' then null else p_outcome end,
      resolved_at = now()
  where id = p_market;
  return v_count;
end $$;

-- Reads ------------------------------------------------------------------------------------
-- Price history for the graph: [{t, p}] starting at 50% when the market opened. No user ids.
create function public.get_market_history(p_market uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when m.id is null then null else
    jsonb_build_array(jsonb_build_object('t', coalesce(m.reviewed_at, m.created_at), 'p', 0.5))
    || coalesce((select jsonb_agg(jsonb_build_object('t', t.created_at, 'p', round(t.probability::numeric, 4)) order by t.created_at, t.id)
                 from public.market_trades t where t.market_id = m.id), '[]'::jsonb)
  end
  from (select 1) one
  left join public.markets m on m.id = p_market
    and (m.status in ('open', 'resolved', 'cancelled') or m.creator_id = (select auth.uid()) or public.is_moderator());
$$;

-- Best forecasters: points won minus points spent on settled markets. LMSR rewards moving the
-- price toward the right answer, so this measures accuracy, not just volume. Display names only.
create function public.get_market_leaderboard(p_limit integer default 10) returns jsonb
language sql stable security definer set search_path = '' as $$
  with scores as (
    select p.user_id, sum(p.payout - p.net_spent)::integer as profit, count(*) as markets
    from public.market_positions p join public.markets m on m.id = p.market_id
    where m.status in ('resolved', 'cancelled') and p.payout is not null
    group by p.user_id
  ), ranked as (
    select s.*, coalesce(pr.display_name, 'Martlet Student') as name, rank() over (order by s.profit desc) as rank
    from scores s left join public.profiles pr on pr.id = s.user_id
  )
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', rank, 'name', name, 'profit', profit, 'markets', markets, 'me', user_id = (select auth.uid())) order by rank, name)
                     from (select * from ranked order by rank, name limit least(greatest(p_limit, 1), 50)) t), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', rank, 'profit', profit, 'markets', markets) from ranked where user_id = (select auth.uid()))
  );
$$;

revoke execute on function public.market_cost(double precision, double precision, double precision),
  public.market_probability(double precision, double precision, double precision),
  public.market_require_user(), public.market_wallet(), public.create_market(text, text, timestamptz),
  public.review_market(uuid, boolean), public.trade_market(uuid, text, text, double precision),
  public.resolve_market(uuid, text), public.get_market_history(uuid), public.get_market_leaderboard(integer)
  from public, anon;
grant execute on function public.market_cost(double precision, double precision, double precision),
  public.market_probability(double precision, double precision, double precision),
  public.market_require_user(), public.market_wallet(), public.create_market(text, text, timestamptz),
  public.review_market(uuid, boolean), public.trade_market(uuid, text, text, double precision),
  public.resolve_market(uuid, text), public.get_market_history(uuid), public.get_market_leaderboard(integer)
  to authenticated;

commit;
