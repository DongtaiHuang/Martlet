-- Multiplayer blackjack tables (issue #146, ADR 0035). PLAY MONEY ONLY, same wallet and rules as
-- solo blackjack (migration 019, ADR 0034): points have no cash value.
--
-- Up to 5 students per table each play the dealer. A round: the first bet opens a 15 s betting
-- window (it closes early once everyone seated has bet), cards are dealt, players act in seat
-- order with a 20 s turn timer (timeout = stand), and the last action plays the dealer and pays.
--
-- Server authoritative: every move is a function below that locks the table row. The deck and the
-- dealer's hole card live in bj_table_secrets, which nobody can read. bj_tables holds only public
-- state and a version number; it's in the Realtime publication so browsers hear about changes and
-- refetch the table through bj_sync(). Deadlines are applied by the next sync or action after
-- they pass (under the lock), so no background job is needed.
-- Card encoding and hand values: see migration 019 (public.blackjack_value).
begin;

create table public.bj_tables (
  id text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name text not null,
  phase text not null default 'open' check (phase in ('open', 'betting', 'playing')),
  round integer not null default 0,
  dealer smallint[] not null default '{}',  -- visible dealer cards only: the up card while playing
  turn_seat smallint,
  deadline timestamptz,                      -- end of the betting window or of the current turn
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.bj_table_secrets (
  table_id text primary key references public.bj_tables(id) on delete cascade,
  deck smallint[] not null default '{}',
  dealer smallint[] not null default '{}',  -- the full dealer hand
  test_deck smallint[]                       -- next deck, for SQL tests only (owner-writable)
);

create table public.bj_seats (
  table_id text not null references public.bj_tables(id) on delete cascade,
  seat smallint not null check (seat between 1 and 5),
  user_id uuid not null unique references public.profiles(id) on delete cascade,  -- one seat per student
  bet integer not null default 0 check (bet between 0 and 200),
  cards smallint[] not null default '{}',
  -- seated: no bet yet · bet: waiting for the deal · playing: in the hand · stood/bust/blackjack:
  -- finished this round · out: sitting this round out
  status text not null default 'seated' check (status in ('seated', 'bet', 'playing', 'stood', 'bust', 'blackjack', 'out')),
  result text check (result in ('blackjack', 'win', 'push', 'lose', 'bust')),
  payout integer not null default 0 check (payout >= 0),
  doubled boolean not null default false,
  last_seen timestamptz not null default now(),
  primary key (table_id, seat)
);

create table public.bj_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  table_id text not null,
  round integer not null,
  bet integer not null,
  payout integer not null,
  result text not null,
  created_at timestamptz not null default now()
);
create index bj_results_user_idx on public.bj_results (user_id, created_at desc);

insert into public.bj_tables (id, name) values
  ('redpath', 'Redpath table'), ('leacock', 'Leacock table'), ('bronfman', 'Bronfman table')
on conflict (id) do nothing;
insert into public.bj_table_secrets (table_id) select id from public.bj_tables on conflict do nothing;

alter table public.bj_tables enable row level security;
alter table public.bj_table_secrets enable row level security;
alter table public.bj_seats enable row level security;
alter table public.bj_results enable row level security;
revoke all on public.bj_tables, public.bj_table_secrets, public.bj_seats, public.bj_results from public, anon, authenticated;
grant select on public.bj_tables, public.bj_results to authenticated;
create policy "Read tables" on public.bj_tables for select to authenticated using (true);
create policy "Read own table results" on public.bj_results for select to authenticated using (user_id = (select auth.uid()));
-- bj_table_secrets and bj_seats: no policies. Seats are read through bj_sync().

-- Realtime: browsers subscribe to changes on bj_tables (public columns only).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bj_tables') then
    alter publication supabase_realtime add table public.bj_tables;
  end if;
end $$;

-- Internal helpers (callers hold the table lock) ----------------------------------------------
create function public.bj_bump(p_table text) returns void
language sql security definer set search_path = '' as $$
  update public.bj_tables set version = version + 1, updated_at = now() where id = p_table;
$$;

-- The table as the caller may see it. The dealer's hole card and the deck are never included.
create function public.bj_state(p_table text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'phase', t.phase, 'round', t.round, 'version', t.version,
    'dealer', to_jsonb(t.dealer), 'dealer_value', public.blackjack_value(t.dealer), 'dealer_hidden', t.phase = 'playing',
    'turn_seat', t.turn_seat, 'deadline', t.deadline, 'now', now(),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', s.seat, 'name', coalesce(p.display_name, 'Martlet Student'), 'me', s.user_id = (select auth.uid()),
        'bet', s.bet, 'cards', to_jsonb(s.cards), 'value', public.blackjack_value(s.cards), 'status', s.status,
        'result', s.result, 'payout', s.payout, 'doubled', s.doubled) order by s.seat)
      from public.bj_seats s left join public.profiles p on p.id = s.user_id
      where s.table_id = t.id), '[]'::jsonb),
    'my_seat', (select s.seat from public.bj_seats s where s.table_id = t.id and s.user_id = (select auth.uid())),
    'balance', (select w.balance from public.market_wallets w where w.user_id = (select auth.uid()))
  )
  from public.bj_tables t where t.id = p_table;
$$;

-- Dealer plays out (if anyone is still standing), then every hand in the round is paid.
create function public.bj_dealer_play(p_table text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_deck smallint[]; v_dealer smallint[]; v_dv integer; v_pv integer; s record; v_result text; v_payout integer; v_round integer;
begin
  select deck, dealer into v_deck, v_dealer from public.bj_table_secrets where table_id = p_table;
  select round into v_round from public.bj_tables where id = p_table;
  if exists (select 1 from public.bj_seats where table_id = p_table and status in ('stood', 'playing')) then
    while public.blackjack_value(v_dealer) < 17 loop
      v_dealer := v_dealer || v_deck[1];
      v_deck := v_deck[2:];
    end loop;
  end if;
  v_dv := public.blackjack_value(v_dealer);

  for s in select * from public.bj_seats where table_id = p_table and status in ('playing', 'stood', 'bust', 'blackjack') loop
    v_pv := public.blackjack_value(s.cards);
    if v_pv > 21 then v_result := 'bust'; v_payout := 0;
    elsif cardinality(s.cards) = 2 and v_pv = 21 and not (cardinality(v_dealer) = 2 and v_dv = 21) then
      v_result := 'blackjack'; v_payout := floor(s.bet * 2.5)::integer;
    elsif v_dv > 21 or v_pv > v_dv then v_result := 'win'; v_payout := s.bet * 2;
    elsif v_pv = v_dv then v_result := 'push'; v_payout := s.bet;
    else v_result := 'lose'; v_payout := 0;
    end if;
    update public.bj_seats
    set result = v_result, payout = v_payout, status = case when status = 'playing' then 'stood' else status end
    where table_id = p_table and seat = s.seat;
    if v_payout > 0 then
      update public.market_wallets set balance = balance + v_payout where user_id = s.user_id;
    end if;
    insert into public.bj_results (user_id, table_id, round, bet, payout, result) values (s.user_id, p_table, v_round, s.bet, v_payout, v_result);
  end loop;

  update public.bj_table_secrets set deck = v_deck, dealer = v_dealer where table_id = p_table;
  update public.bj_tables set phase = 'open', dealer = v_dealer, turn_seat = null, deadline = null where id = p_table;
end $$;

-- Next player's turn, or the dealer if nobody is left to act.
create function public.bj_advance(p_table text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_next smallint;
begin
  select seat into v_next from public.bj_seats where table_id = p_table and status = 'playing' order by seat limit 1;
  if v_next is null then
    perform public.bj_dealer_play(p_table);
  else
    update public.bj_tables set turn_seat = v_next, deadline = now() + interval '20 seconds' where id = p_table;
  end if;
end $$;

-- Deal to everyone who bet: one card each in seat order, dealer up card, second cards, hole card.
create function public.bj_deal(p_table text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_deck smallint[]; v_seats smallint[]; k integer; i integer; v_cards smallint[]; v_dealer smallint[];
begin
  select coalesce(test_deck, (select array_agg(c::smallint order by gen_random_uuid()) from generate_series(0, 51) as c))
  into v_deck from public.bj_table_secrets where table_id = p_table;
  update public.bj_table_secrets set test_deck = null where table_id = p_table;

  select array_agg(seat order by seat) into v_seats from public.bj_seats where table_id = p_table and status = 'bet';
  k := coalesce(cardinality(v_seats), 0);
  if k = 0 then
    update public.bj_tables set phase = 'open', deadline = null where id = p_table;
    return;
  end if;
  for i in 1..k loop
    v_cards := array[v_deck[i], v_deck[k + 1 + i]];
    update public.bj_seats
    set cards = v_cards, status = case when public.blackjack_value(v_cards) = 21 then 'blackjack' else 'playing' end
    where table_id = p_table and seat = v_seats[i];
  end loop;
  update public.bj_seats set status = 'out' where table_id = p_table and status = 'seated';
  v_dealer := array[v_deck[k + 1], v_deck[2 * k + 2]];
  update public.bj_table_secrets set deck = v_deck[2 * k + 3:], dealer = v_dealer where table_id = p_table;
  update public.bj_tables set phase = 'playing', round = round + 1, dealer = v_dealer[1:1], turn_seat = null, deadline = null where id = p_table;
  -- The dealer peeks: a dealer blackjack ends the round at once.
  if public.blackjack_value(v_dealer) = 21 then perform public.bj_dealer_play(p_table);
  else perform public.bj_advance(p_table);
  end if;
end $$;

-- Applies whatever deadlines have passed and drops seats that went quiet between hands.
-- Returns true if the table changed.
create function public.bj_tick(p_table text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.bj_tables%rowtype; v_changed boolean := false; v_guard integer := 0;
begin
  select * into t from public.bj_tables where id = p_table;
  delete from public.bj_seats
  where table_id = p_table and last_seen < now() - interval '90 seconds'
    and (t.phase = 'open' or status in ('seated', 'out'));
  if found then v_changed := true; end if;

  if t.phase = 'betting' and (t.deadline <= now() or not exists (select 1 from public.bj_seats where table_id = p_table and status = 'seated')) then
    perform public.bj_deal(p_table);
    v_changed := true;
  end if;

  select * into t from public.bj_tables where id = p_table;
  while t.phase = 'playing' and t.turn_seat is not null and t.deadline <= now() and v_guard < 6 loop
    update public.bj_seats set status = 'stood' where table_id = p_table and seat = t.turn_seat and status = 'playing';
    perform public.bj_advance(p_table);
    v_changed := true;
    v_guard := v_guard + 1;
    select * into t from public.bj_tables where id = p_table;
  end loop;
  return v_changed;
end $$;

create function public.bj_lock(p_table text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.bj_tables where id = p_table for update;
  if not found then raise exception 'no such table' using errcode = 'P0002'; end if;
end $$;

-- Player functions -------------------------------------------------------------------------
create function public.bj_list_tables() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'name', t.name, 'phase', t.phase,
    'players', (select count(*) from public.bj_seats s where s.table_id = t.id),
    'mine', exists (select 1 from public.bj_seats s where s.table_id = t.id and s.user_id = (select auth.uid()))
  ) order by t.id), '[]'::jsonb)
  from public.bj_tables t;
$$;

-- Applies deadlines, marks you as present, and returns the table. Call it on every change event
-- and every few seconds while a deadline is running.
create function public.bj_sync(p_table text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user();
begin
  perform public.bj_lock(p_table);
  if public.bj_tick(p_table) then perform public.bj_bump(p_table); end if;
  update public.bj_seats set last_seen = now() where table_id = p_table and user_id = v_user;
  return public.bj_state(p_table);
end $$;

create function public.bj_join(p_table text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_other record; v_seat smallint; v_phase text;
begin
  perform public.market_wallet();
  select table_id, seat, status into v_other from public.bj_seats where user_id = v_user;
  if found and v_other.table_id = p_table then return public.bj_sync(p_table); end if;
  if found then
    if v_other.status in ('bet', 'playing') then
      raise exception 'finish your hand at the other table first' using errcode = 'P0001', hint = 'active';
    end if;
    perform public.bj_lock(v_other.table_id);
    delete from public.bj_seats where user_id = v_user;
    perform public.bj_bump(v_other.table_id);
  end if;

  perform public.bj_lock(p_table);
  perform public.bj_tick(p_table);
  select min(n)::smallint into v_seat from generate_series(1, 5) as n
  where n not in (select seat from public.bj_seats where table_id = p_table);
  if v_seat is null then raise exception 'this table is full' using errcode = 'P0001', hint = 'full'; end if;
  select phase into v_phase from public.bj_tables where id = p_table;
  insert into public.bj_seats (table_id, seat, user_id, status)
  values (p_table, v_seat, v_user, case when v_phase = 'playing' then 'out' else 'seated' end);
  perform public.bj_bump(p_table);
  return public.bj_state(p_table);
end $$;

create function public.bj_leave(p_table text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_status text; v_bet integer;
begin
  perform public.bj_lock(p_table);
  select status, bet into v_status, v_bet from public.bj_seats where table_id = p_table and user_id = v_user;
  if not found then return; end if;
  if v_status = 'playing' then raise exception 'finish your hand first' using errcode = 'P0001', hint = 'active'; end if;
  if v_status = 'bet' then  -- not dealt yet: refund
    update public.market_wallets set balance = balance + v_bet where user_id = v_user;
  end if;
  delete from public.bj_seats where table_id = p_table and user_id = v_user;
  perform public.bj_tick(p_table);
  perform public.bj_bump(p_table);
end $$;

-- Bet for the next round (1–100 points). The first bet opens a 15 s window for everyone.
create function public.bj_bet(p_table text, p_bet integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_phase text; v_status text; v_balance integer;
begin
  if p_bet is null or p_bet < 1 or p_bet > 100 then raise exception 'bet between 1 and 100 points' using errcode = '22023'; end if;
  perform public.market_wallet();
  perform public.bj_lock(p_table);
  perform public.bj_tick(p_table);
  select status into v_status from public.bj_seats where table_id = p_table and user_id = v_user;
  if not found then raise exception 'take a seat first' using errcode = 'P0001', hint = 'seat'; end if;
  select phase into v_phase from public.bj_tables where id = p_table;
  if v_phase = 'playing' then raise exception 'wait for the next round' using errcode = 'P0001', hint = 'round'; end if;
  if v_status = 'bet' then raise exception 'you already bet this round' using errcode = 'P0001', hint = 'already'; end if;
  if (select count(*) from public.bj_results where user_id = v_user and created_at > now() - interval '1 day') >= 100 then
    raise exception 'daily hand limit reached' using errcode = 'P0001', hint = 'daily-limit';
  end if;
  select balance into v_balance from public.market_wallets where user_id = v_user for update;
  if p_bet > v_balance then raise exception 'not enough points' using errcode = 'P0001', hint = 'balance'; end if;

  if v_phase = 'open' then  -- a new round: clear the last one and open the betting window
    update public.bj_seats set bet = 0, cards = '{}', status = 'seated', result = null, payout = 0, doubled = false where table_id = p_table;
    update public.bj_tables set phase = 'betting', dealer = '{}', deadline = now() + interval '15 seconds' where id = p_table;
  end if;
  update public.market_wallets set balance = balance - p_bet where user_id = v_user;
  update public.bj_seats set bet = p_bet, status = 'bet', last_seen = now() where table_id = p_table and user_id = v_user;
  perform public.bj_tick(p_table);  -- deals at once if everyone seated has bet
  perform public.bj_bump(p_table);
  return public.bj_state(p_table);
end $$;

-- Hit, stand or double on your turn.
create function public.bj_act(p_table text, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); t public.bj_tables%rowtype; s public.bj_seats%rowtype;
  v_deck smallint[]; v_cards smallint[]; v_balance integer; v_value integer;
begin
  if p_action not in ('hit', 'stand', 'double') then raise exception 'invalid action' using errcode = '22023'; end if;
  perform public.bj_lock(p_table);
  if public.bj_tick(p_table) then perform public.bj_bump(p_table); end if;
  select * into t from public.bj_tables where id = p_table;
  select * into s from public.bj_seats where table_id = p_table and user_id = v_user;
  if not found or t.phase <> 'playing' or t.turn_seat is distinct from s.seat or s.status <> 'playing' then
    raise exception 'it isn''t your turn' using errcode = 'P0001', hint = 'turn';
  end if;

  select deck into v_deck from public.bj_table_secrets where table_id = p_table;
  v_cards := s.cards;
  if p_action = 'double' then
    if cardinality(s.cards) <> 2 or s.doubled then raise exception 'you can only double on your first two cards' using errcode = '22023'; end if;
    select balance into v_balance from public.market_wallets where user_id = v_user for update;
    if v_balance < s.bet then raise exception 'not enough points to double' using errcode = 'P0001', hint = 'balance'; end if;
    update public.market_wallets set balance = balance - s.bet where user_id = v_user;
  end if;
  if p_action in ('hit', 'double') then
    v_cards := v_cards || v_deck[1];
    v_deck := v_deck[2:];
    update public.bj_table_secrets set deck = v_deck where table_id = p_table;
  end if;
  v_value := public.blackjack_value(v_cards);

  update public.bj_seats
  set cards = v_cards,
      bet = case when p_action = 'double' then bet * 2 else bet end,
      doubled = doubled or p_action = 'double',
      status = case when v_value > 21 then 'bust' when p_action in ('stand', 'double') or v_value = 21 then 'stood' else 'playing' end,
      last_seen = now()
  where table_id = p_table and seat = s.seat;

  if v_value > 21 or v_value = 21 or p_action in ('stand', 'double') then
    perform public.bj_advance(p_table);
  else
    update public.bj_tables set deadline = now() + interval '20 seconds' where id = p_table;  -- fresh timer after a hit
  end if;
  perform public.bj_bump(p_table);
  return public.bj_state(p_table);
end $$;

revoke execute on function public.bj_bump(text), public.bj_state(text), public.bj_dealer_play(text), public.bj_advance(text),
  public.bj_deal(text), public.bj_tick(text), public.bj_lock(text), public.bj_list_tables(), public.bj_sync(text),
  public.bj_join(text), public.bj_leave(text), public.bj_bet(text, integer), public.bj_act(text, text)
  from public, anon, authenticated;
grant execute on function public.bj_list_tables(), public.bj_sync(text), public.bj_join(text), public.bj_leave(text),
  public.bj_bet(text, integer), public.bj_act(text, text) to authenticated;

commit;
