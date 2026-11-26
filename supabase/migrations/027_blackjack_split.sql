-- Splitting pairs in blackjack (ADR 0041), solo (migration 019) and at tables (migration 020).
-- PLAY MONEY ONLY: Martlet points have no cash value.
--
-- Rules: two first cards of the same rank (two 8s, two kings; a king and a queen don't count) can
-- be split once into two hands, for a second bet equal to the first. Each hand gets a second card
-- at once and is played in turn, hand 1 first. Doubling after a split is allowed. Split aces get
-- one card each and stand. A 21 on a split hand is not a blackjack: it pays 1:1.
-- Safe to re-run.
begin;

-- Shared rules -----------------------------------------------------------------------------
create or replace function public.blackjack_is_pair(p_cards smallint[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(p_cards) = 2 and p_cards[1] % 13 = p_cards[2] % 13, false);
$$;

-- One hand against the dealer's final cards. p_natural: a two-card 21 counts as blackjack
-- (false for split hands).
create or replace function public.blackjack_outcome(p_cards smallint[], p_dealer smallint[], p_natural boolean) returns text
language sql immutable set search_path = '' as $$
  select case
    when public.blackjack_value(p_cards) > 21 then 'bust'
    when p_natural and cardinality(p_cards) = 2 and public.blackjack_value(p_cards) = 21
         and not (cardinality(p_dealer) = 2 and public.blackjack_value(p_dealer) = 21) then 'blackjack'
    when public.blackjack_value(p_dealer) > 21 or public.blackjack_value(p_cards) > public.blackjack_value(p_dealer) then 'win'
    when public.blackjack_value(p_cards) = public.blackjack_value(p_dealer) then 'push'
    else 'lose'
  end;
$$;

create or replace function public.blackjack_pay(p_result text, p_bet integer) returns integer
language sql immutable set search_path = '' as $$
  select case p_result when 'blackjack' then floor(p_bet * 2.5)::integer when 'win' then p_bet * 2 when 'push' then p_bet else 0 end;
$$;

-- Solo hands -------------------------------------------------------------------------------
-- player/bet/doubled/result stay hand 1; split_* is hand 2 (split_cards is null until a split).
alter table public.blackjack_hands
  add column if not exists split_cards smallint[],
  add column if not exists split_bet integer not null default 0 check (split_bet between 0 and 200),
  add column if not exists split_doubled boolean not null default false,
  add column if not exists split_result text check (split_result in ('win', 'push', 'lose', 'bust')),
  add column if not exists active smallint not null default 1 check (active in (1, 2));

create or replace function public.blackjack_state(p_hand uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', h.id, 'bet', h.bet, 'status', h.status, 'result', h.result, 'payout', h.payout, 'doubled', h.doubled,
    'player', to_jsonb(h.player), 'player_value', public.blackjack_value(h.player),
    'dealer', case when h.status = 'playing' then to_jsonb(h.dealer[1:1]) else to_jsonb(h.dealer) end,
    'dealer_value', public.blackjack_value(case when h.status = 'playing' then h.dealer[1:1] else h.dealer end),
    'split', h.split_cards is not null,
    'split_cards', to_jsonb(h.split_cards), 'split_value', public.blackjack_value(coalesce(h.split_cards, '{}')),
    'split_bet', h.split_bet, 'split_doubled', h.split_doubled, 'split_result', h.split_result,
    'active', h.active, 'total_bet', h.bet + h.split_bet,
    'can_double', h.status = 'playing'
      and cardinality(case when h.active = 2 then h.split_cards else h.player end) = 2
      and not (case when h.active = 2 then h.split_doubled else h.doubled end),
    'can_split', h.status = 'playing' and h.split_cards is null and public.blackjack_is_pair(h.player),
    'balance', (select w.balance from public.market_wallets w where w.user_id = h.user_id)
  )
  from public.blackjack_hands h where h.id = p_hand;
$$;

-- Dealer plays out (unless every hand is bust or the only hand is a blackjack), then each hand is paid.
create or replace function public.blackjack_settle(p_hand uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.blackjack_hands%rowtype; v_split boolean; v_r1 text; v_r2 text; v_payout integer;
begin
  select * into h from public.blackjack_hands where id = p_hand and status = 'playing' for update;
  if not found then return; end if;
  v_split := h.split_cards is not null;
  if (public.blackjack_value(h.player) <= 21 and (v_split or not (cardinality(h.player) = 2 and public.blackjack_value(h.player) = 21)))
     or (v_split and public.blackjack_value(h.split_cards) <= 21) then
    -- Dealer stands on all 17s; a dealer blackjack doesn't draw.
    while public.blackjack_value(h.dealer) < 17 loop
      h.dealer := h.dealer || h.deck[1];
      h.deck := h.deck[2:];
    end loop;
  end if;
  v_r1 := public.blackjack_outcome(h.player, h.dealer, not v_split);
  v_payout := public.blackjack_pay(v_r1, h.bet);
  if v_split then
    v_r2 := public.blackjack_outcome(h.split_cards, h.dealer, false);
    v_payout := v_payout + public.blackjack_pay(v_r2, h.split_bet);
  end if;
  update public.blackjack_hands
  set dealer = h.dealer, deck = h.deck, status = 'done', result = v_r1, split_result = v_r2, payout = v_payout, finished_at = now()
  where id = p_hand;
  if v_payout > 0 then
    update public.market_wallets set balance = balance + v_payout where user_id = h.user_id;
  end if;
end $$;

-- The hand in play is finished: move to hand 2 after a split (unless it's already 21), or settle.
create or replace function public.blackjack_next_hand(p_hand uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.blackjack_hands%rowtype;
begin
  select * into h from public.blackjack_hands where id = p_hand for update;
  if h.split_cards is not null and h.active = 1 then
    update public.blackjack_hands set active = 2 where id = p_hand;
    if public.blackjack_value(h.split_cards) < 21 then return; end if;
  end if;
  perform public.blackjack_settle(p_hand);
end $$;

-- Hit, stand, double down or split the hand in play.
create or replace function public.blackjack_action(p_hand uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); h public.blackjack_hands%rowtype; v_balance integer;
  v_two boolean; v_cards smallint[]; v_bet integer;
begin
  select * into h from public.blackjack_hands where id = p_hand and user_id = v_user for update;
  if not found or h.status <> 'playing' then raise exception 'no hand in play' using errcode = 'P0002'; end if;
  v_two := h.active = 2;
  v_cards := case when v_two then h.split_cards else h.player end;
  v_bet := case when v_two then h.split_bet else h.bet end;

  if p_action = 'hit' then
    v_cards := v_cards || h.deck[1];
    update public.blackjack_hands
    set player = case when v_two then player else v_cards end,
        split_cards = case when v_two then v_cards else split_cards end,
        deck = deck[2:]
    where id = p_hand;
    if public.blackjack_value(v_cards) >= 21 then perform public.blackjack_next_hand(p_hand); end if;
  elsif p_action = 'stand' then
    perform public.blackjack_next_hand(p_hand);
  elsif p_action = 'double' then
    if cardinality(v_cards) <> 2 or (case when v_two then h.split_doubled else h.doubled end) then
      raise exception 'you can only double on your first two cards' using errcode = '22023';
    end if;
    select balance into v_balance from public.market_wallets where user_id = v_user for update;
    if v_balance < v_bet then raise exception 'not enough points to double' using errcode = 'P0001', hint = 'balance'; end if;
    update public.market_wallets set balance = balance - v_bet where user_id = v_user;
    v_cards := v_cards || h.deck[1];
    update public.blackjack_hands
    set player = case when v_two then player else v_cards end,
        split_cards = case when v_two then v_cards else split_cards end,
        deck = deck[2:],
        bet = case when v_two then bet else bet * 2 end,
        split_bet = case when v_two then split_bet * 2 else split_bet end,
        doubled = doubled or not v_two,
        split_doubled = split_doubled or v_two
    where id = p_hand;
    perform public.blackjack_next_hand(p_hand);
  elsif p_action = 'split' then
    if h.split_cards is not null or not public.blackjack_is_pair(h.player) then
      raise exception 'you can only split a pair, once' using errcode = '22023';
    end if;
    select balance into v_balance from public.market_wallets where user_id = v_user for update;
    if v_balance < h.bet then raise exception 'not enough points to split' using errcode = 'P0001', hint = 'balance'; end if;
    update public.market_wallets set balance = balance - h.bet where user_id = v_user;
    update public.blackjack_hands
    set player = array[h.player[1], h.deck[1]], split_cards = array[h.player[2], h.deck[2]], deck = h.deck[3:],
        split_bet = h.bet, active = 1
    where id = p_hand;
    if h.player[1] % 13 = 0 then
      perform public.blackjack_settle(p_hand);  -- split aces: one card each
    elsif public.blackjack_value(array[h.player[1], h.deck[1]]) = 21 then
      perform public.blackjack_next_hand(p_hand);
    end if;
  else
    raise exception 'invalid action' using errcode = '22023';
  end if;
  return public.blackjack_state(p_hand);
end $$;

-- Your hand in play (after a reload), or null, plus today's record (split bets included).
create or replace function public.blackjack_current() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'hand', (select public.blackjack_state(h.id) from public.blackjack_hands h where h.user_id = (select auth.uid()) and h.status = 'playing'),
    'today', (select jsonb_build_object(
        'hands', count(*),
        'net', coalesce(sum(h.payout - h.bet - h.split_bet) filter (where h.status = 'done'), 0)
      ) from public.blackjack_hands h where h.user_id = (select auth.uid()) and h.created_at > now() - interval '1 day')
  );
$$;

-- Tables -----------------------------------------------------------------------------------
-- cards/bet/doubled/result stay hand 1; split_* is hand 2. payout is the seat's total.
alter table public.bj_seats
  add column if not exists split_cards smallint[],
  add column if not exists split_bet integer not null default 0 check (split_bet between 0 and 200),
  add column if not exists split_doubled boolean not null default false,
  add column if not exists split_result text check (split_result in ('win', 'push', 'lose', 'bust')),
  add column if not exists active smallint not null default 1 check (active in (1, 2));

create or replace function public.bj_state(p_table text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id, 'name', t.name, 'phase', t.phase, 'round', t.round, 'version', t.version,
    'dealer', to_jsonb(t.dealer), 'dealer_value', public.blackjack_value(t.dealer), 'dealer_hidden', t.phase = 'playing',
    'turn_seat', t.turn_seat, 'deadline', t.deadline, 'now', now(),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seat', s.seat, 'name', coalesce(p.display_name, 'Martlet Student'), 'me', s.user_id = (select auth.uid()),
        'bet', s.bet, 'cards', to_jsonb(s.cards), 'value', public.blackjack_value(s.cards), 'status', s.status,
        'result', s.result, 'payout', s.payout, 'doubled', s.doubled,
        'split_cards', to_jsonb(s.split_cards), 'split_value', public.blackjack_value(coalesce(s.split_cards, '{}')),
        'split_bet', s.split_bet, 'split_doubled', s.split_doubled, 'split_result', s.split_result, 'active', s.active
      ) order by s.seat)
      from public.bj_seats s left join public.profiles p on p.id = s.user_id
      where s.table_id = t.id), '[]'::jsonb),
    'my_seat', (select s.seat from public.bj_seats s where s.table_id = t.id and s.user_id = (select auth.uid())),
    'balance', (select w.balance from public.market_wallets w where w.user_id = (select auth.uid()))
  )
  from public.bj_tables t where t.id = p_table;
$$;

-- Dealer plays out (if anyone is still standing), then every hand in the round is paid.
create or replace function public.bj_dealer_play(p_table text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_deck smallint[]; v_dealer smallint[]; s record; v_r1 text; v_r2 text; v_payout integer; v_round integer;
begin
  select deck, dealer into v_deck, v_dealer from public.bj_table_secrets where table_id = p_table;
  select round into v_round from public.bj_tables where id = p_table;
  if exists (select 1 from public.bj_seats where table_id = p_table and status in ('stood', 'playing')) then
    while public.blackjack_value(v_dealer) < 17 loop
      v_dealer := v_dealer || v_deck[1];
      v_deck := v_deck[2:];
    end loop;
  end if;

  for s in select * from public.bj_seats where table_id = p_table and status in ('playing', 'stood', 'bust', 'blackjack') loop
    v_r1 := public.blackjack_outcome(s.cards, v_dealer, s.split_cards is null);
    v_payout := public.blackjack_pay(v_r1, s.bet);
    v_r2 := null;
    if s.split_cards is not null then
      v_r2 := public.blackjack_outcome(s.split_cards, v_dealer, false);
      v_payout := v_payout + public.blackjack_pay(v_r2, s.split_bet);
    end if;
    update public.bj_seats
    set result = v_r1, split_result = v_r2, payout = v_payout, status = case when status = 'playing' then 'stood' else status end
    where table_id = p_table and seat = s.seat;
    if v_payout > 0 then
      update public.market_wallets set balance = balance + v_payout where user_id = s.user_id;
    end if;
    insert into public.bj_results (user_id, table_id, round, bet, payout, result)
    values (s.user_id, p_table, v_round, s.bet + s.split_bet, v_payout, case when s.split_cards is null then v_r1 else 'split' end);
  end loop;

  update public.bj_table_secrets set deck = v_deck, dealer = v_dealer where table_id = p_table;
  update public.bj_tables set phase = 'open', dealer = v_dealer, turn_seat = null, deadline = null where id = p_table;
end $$;

-- Bet for the next round (1–100 points). The first bet opens a 15 s window for everyone.
create or replace function public.bj_bet(p_table text, p_bet integer) returns jsonb
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
    update public.bj_seats
    set bet = 0, cards = '{}', status = 'seated', result = null, payout = 0, doubled = false,
        split_cards = null, split_bet = 0, split_doubled = false, split_result = null, active = 1
    where table_id = p_table;
    update public.bj_tables set phase = 'betting', dealer = '{}', deadline = now() + interval '15 seconds' where id = p_table;
  end if;
  update public.market_wallets set balance = balance - p_bet where user_id = v_user;
  update public.bj_seats set bet = p_bet, status = 'bet', last_seen = now() where table_id = p_table and user_id = v_user;
  perform public.bj_tick(p_table);  -- deals at once if everyone seated has bet
  perform public.bj_bump(p_table);
  return public.bj_state(p_table);
end $$;

-- Hit, stand, double or split on your turn. After a split, actions apply to the hand in play.
create or replace function public.bj_act(p_table text, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); t public.bj_tables%rowtype; s public.bj_seats%rowtype;
  v_deck smallint[]; v_cards smallint[]; v_balance integer; v_two boolean; v_bet integer;
  v_hand_done boolean := false; v_seat_done boolean := false;
begin
  if p_action is null or p_action not in ('hit', 'stand', 'double', 'split') then raise exception 'invalid action' using errcode = '22023'; end if;
  perform public.bj_lock(p_table);
  if public.bj_tick(p_table) then perform public.bj_bump(p_table); end if;
  select * into t from public.bj_tables where id = p_table;
  select * into s from public.bj_seats where table_id = p_table and user_id = v_user;
  if not found or t.phase <> 'playing' or t.turn_seat is distinct from s.seat or s.status <> 'playing' then
    raise exception 'it isn''t your turn' using errcode = 'P0001', hint = 'turn';
  end if;

  select deck into v_deck from public.bj_table_secrets where table_id = p_table;
  v_two := s.active = 2;
  v_cards := case when v_two then s.split_cards else s.cards end;
  v_bet := case when v_two then s.split_bet else s.bet end;

  if p_action = 'split' then
    if s.split_cards is not null or not public.blackjack_is_pair(s.cards) then
      raise exception 'you can only split a pair, once' using errcode = '22023';
    end if;
    select balance into v_balance from public.market_wallets where user_id = v_user for update;
    if v_balance < s.bet then raise exception 'not enough points to split' using errcode = 'P0001', hint = 'balance'; end if;
    update public.market_wallets set balance = balance - s.bet where user_id = v_user;
    update public.bj_seats
    set cards = array[s.cards[1], v_deck[1]], split_cards = array[s.cards[2], v_deck[2]], split_bet = s.bet, active = 1
    where table_id = p_table and seat = s.seat
    returning * into s;
    v_deck := v_deck[3:];
    v_seat_done := s.cards[1] % 13 = 0;  -- split aces: one card each
    v_hand_done := public.blackjack_value(s.cards) = 21;
  else
    if p_action = 'double' then
      if cardinality(v_cards) <> 2 or (case when v_two then s.split_doubled else s.doubled end) then
        raise exception 'you can only double on your first two cards' using errcode = '22023';
      end if;
      select balance into v_balance from public.market_wallets where user_id = v_user for update;
      if v_balance < v_bet then raise exception 'not enough points to double' using errcode = 'P0001', hint = 'balance'; end if;
      update public.market_wallets set balance = balance - v_bet where user_id = v_user;
    end if;
    if p_action in ('hit', 'double') then
      v_cards := v_cards || v_deck[1];
      v_deck := v_deck[2:];
    end if;
    update public.bj_seats
    set cards = case when v_two then cards else v_cards end,
        split_cards = case when v_two then v_cards else split_cards end,
        bet = case when p_action = 'double' and not v_two then bet * 2 else bet end,
        split_bet = case when p_action = 'double' and v_two then split_bet * 2 else split_bet end,
        doubled = doubled or (p_action = 'double' and not v_two),
        split_doubled = split_doubled or (p_action = 'double' and v_two)
    where table_id = p_table and seat = s.seat
    returning * into s;
    v_hand_done := p_action in ('stand', 'double') or public.blackjack_value(v_cards) >= 21;
  end if;
  update public.bj_table_secrets set deck = v_deck where table_id = p_table;

  -- Hand 1 finished after a split: play hand 2 (unless it's already 21).
  if v_hand_done and not v_seat_done then
    if s.split_cards is not null and s.active = 1 then
      update public.bj_seats set active = 2 where table_id = p_table and seat = s.seat;
      v_seat_done := public.blackjack_value(s.split_cards) >= 21;
    else
      v_seat_done := true;
    end if;
  end if;

  update public.bj_seats
  set last_seen = now(),
      status = case
        when not v_seat_done then 'playing'
        when public.blackjack_value(cards) > 21 and (split_cards is null or public.blackjack_value(split_cards) > 21) then 'bust'
        else 'stood' end
  where table_id = p_table and seat = s.seat;

  if v_seat_done then
    perform public.bj_advance(p_table);
  else
    update public.bj_tables set deadline = now() + interval '20 seconds' where id = p_table;  -- fresh timer
  end if;
  perform public.bj_bump(p_table);
  return public.bj_state(p_table);
end $$;

revoke execute on function public.blackjack_is_pair(smallint[]), public.blackjack_outcome(smallint[], smallint[], boolean),
  public.blackjack_pay(text, integer), public.blackjack_next_hand(uuid)
  from public, anon, authenticated;

commit;
