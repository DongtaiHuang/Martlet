-- Blackjack with Martlet points (ADR 0034). PLAY MONEY ONLY, like the prediction market
-- (migration 018, ADR 0033): points have no cash value and can't be bought or cashed out.
--
-- The server deals. Each hand gets a freshly shuffled 52-card deck stored with the hand; the
-- deck and the dealer's hole card never leave the database until the hand is over. Nobody can
-- read or write the table directly: everything goes through the functions below, which take the
-- player from the session and move points in the same transaction.
--
-- Rules: one deck, dealer stands on all 17s, dealer peeks for blackjack, blackjack pays 3:2
-- (rounded down), double down on the first two cards, no splits or insurance. Bets 1–100 points,
-- one hand at a time, 100 hands a day.
-- Cards are 0–51: rank = card % 13 (0 = ace, 1–8 = 2–9, 9 = 10, 10–12 = J Q K), suit = card / 13.
begin;

create table public.blackjack_hands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bet integer not null check (bet between 1 and 200),  -- up to 100, doubled to 200
  deck smallint[] not null,
  player smallint[] not null,
  dealer smallint[] not null,
  status text not null default 'playing' check (status in ('playing', 'done')),
  result text check (result in ('blackjack', 'win', 'push', 'lose', 'bust')),
  payout integer not null default 0 check (payout >= 0),
  doubled boolean not null default false,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((status = 'done') = (result is not null))
);
create unique index blackjack_one_active_hand on public.blackjack_hands (user_id) where status = 'playing';
create index blackjack_hands_user_idx on public.blackjack_hands (user_id, created_at desc);

alter table public.blackjack_hands enable row level security;
revoke all on public.blackjack_hands from public, anon, authenticated;
-- No policies: the deck and hole card stay secret.

-- Best total for a set of cards; aces count 11 unless that busts.
create function public.blackjack_value(cards smallint[]) returns integer
language sql immutable set search_path = '' as $$
  with v as (
    select coalesce(sum(case when c % 13 = 0 then 11 when c % 13 <= 8 then c % 13 + 1 else 10 end), 0)::integer as total,
           count(*) filter (where c % 13 = 0)::integer as aces
    from unnest(cards) as c
  )
  select case when total <= 21 then total else total - 10 * least(aces, ceil((total - 21) / 10.0)::integer) end from v;
$$;

-- What the player may see: the dealer's hole card is hidden while the hand is in play.
create function public.blackjack_state(p_hand uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', h.id, 'bet', h.bet, 'status', h.status, 'result', h.result, 'payout', h.payout, 'doubled', h.doubled,
    'player', to_jsonb(h.player), 'player_value', public.blackjack_value(h.player),
    'dealer', case when h.status = 'playing' then to_jsonb(h.dealer[1:1]) else to_jsonb(h.dealer) end,
    'dealer_value', public.blackjack_value(case when h.status = 'playing' then h.dealer[1:1] else h.dealer end),
    'can_double', h.status = 'playing' and cardinality(h.player) = 2 and not h.doubled,
    'balance', (select w.balance from public.market_wallets w where w.user_id = h.user_id)
  )
  from public.blackjack_hands h where h.id = p_hand;
$$;

-- Dealer plays out (unless the player bust or has blackjack), then the hand is paid.
create function public.blackjack_settle(p_hand uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.blackjack_hands%rowtype; pv integer; dv integer; v_result text; v_payout integer;
begin
  select * into h from public.blackjack_hands where id = p_hand and status = 'playing' for update;
  if not found then return; end if;
  pv := public.blackjack_value(h.player);
  if pv > 21 then
    v_result := 'bust'; v_payout := 0;
  elsif cardinality(h.player) = 2 and pv = 21 and not (public.blackjack_value(h.dealer) = 21) then
    v_result := 'blackjack'; v_payout := floor(h.bet * 2.5)::integer;
  else
    -- Dealer stands on all 17s; a dealer blackjack doesn't draw.
    while public.blackjack_value(h.dealer) < 17 loop
      h.dealer := h.dealer || h.deck[1];
      h.deck := h.deck[2:];
    end loop;
    dv := public.blackjack_value(h.dealer);
    if dv > 21 or pv > dv then v_result := 'win'; v_payout := h.bet * 2;
    elsif pv = dv then v_result := 'push'; v_payout := h.bet;
    else v_result := 'lose'; v_payout := 0;
    end if;
  end if;
  update public.blackjack_hands
  set dealer = h.dealer, deck = h.deck, status = 'done', result = v_result, payout = v_payout, finished_at = now()
  where id = p_hand;
  if v_payout > 0 then
    update public.market_wallets set balance = balance + v_payout where user_id = h.user_id;
  end if;
end $$;

-- Starts a hand from a given deck order. Internal: blackjack_deal() passes a shuffled deck;
-- SQL tests pass a fixed one. Not callable by players.
create function public.blackjack_start(p_bet integer, p_deck smallint[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_balance integer; v_id uuid;
begin
  if p_bet is null or p_bet < 1 or p_bet > 100 then
    raise exception 'bet between 1 and 100 points' using errcode = '22023';
  end if;
  if cardinality(p_deck) <> 52 then raise exception 'bad deck' using errcode = '22023'; end if;
  if exists (select 1 from public.blackjack_hands where user_id = v_user and status = 'playing') then
    raise exception 'finish your current hand first' using errcode = 'P0001', hint = 'active';
  end if;
  if (select count(*) from public.blackjack_hands where user_id = v_user and created_at > now() - interval '1 day') >= 100 then
    raise exception 'daily hand limit reached' using errcode = 'P0001', hint = 'daily-limit';
  end if;

  perform public.market_wallet();
  select balance into v_balance from public.market_wallets where user_id = v_user for update;
  if p_bet > v_balance then raise exception 'not enough points' using errcode = 'P0001', hint = 'balance'; end if;
  update public.market_wallets set balance = balance - p_bet where user_id = v_user;

  insert into public.blackjack_hands (user_id, bet, deck, player, dealer)
  values (v_user, p_bet, p_deck[5:], array[p_deck[1], p_deck[3]], array[p_deck[2], p_deck[4]])
  returning id into v_id;
  -- Either side has blackjack: the dealer peeks and the hand ends at once.
  if public.blackjack_value(array[p_deck[1], p_deck[3]]) = 21 or public.blackjack_value(array[p_deck[2], p_deck[4]]) = 21 then
    perform public.blackjack_settle(v_id);
  end if;
  return public.blackjack_state(v_id);
end $$;

-- Deal a new hand with a freshly shuffled deck (gen_random_uuid uses a strong random source).
create function public.blackjack_deal(p_bet integer) returns jsonb
language sql security definer set search_path = '' as $$
  select public.blackjack_start(p_bet, (select array_agg(c::smallint order by gen_random_uuid()) from generate_series(0, 51) as c));
$$;

-- Hit, stand or double down on your hand in play.
create function public.blackjack_action(p_hand uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); h public.blackjack_hands%rowtype; v_balance integer;
begin
  select * into h from public.blackjack_hands where id = p_hand and user_id = v_user for update;
  if not found or h.status <> 'playing' then raise exception 'no hand in play' using errcode = 'P0002'; end if;

  if p_action = 'hit' then
    update public.blackjack_hands set player = player || deck[1], deck = deck[2:] where id = p_hand
    returning * into h;
    if public.blackjack_value(h.player) >= 21 then perform public.blackjack_settle(p_hand); end if;
  elsif p_action = 'stand' then
    perform public.blackjack_settle(p_hand);
  elsif p_action = 'double' then
    if cardinality(h.player) <> 2 or h.doubled then raise exception 'you can only double on your first two cards' using errcode = '22023'; end if;
    select balance into v_balance from public.market_wallets where user_id = v_user for update;
    if v_balance < h.bet then raise exception 'not enough points to double' using errcode = 'P0001', hint = 'balance'; end if;
    update public.market_wallets set balance = balance - h.bet where user_id = v_user;
    update public.blackjack_hands set player = player || deck[1], deck = deck[2:], bet = bet * 2, doubled = true where id = p_hand;
    perform public.blackjack_settle(p_hand);
  else
    raise exception 'invalid action' using errcode = '22023';
  end if;
  return public.blackjack_state(p_hand);
end $$;

-- Your hand in play (after a reload), or null, plus today's record.
create function public.blackjack_current() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'hand', (select public.blackjack_state(h.id) from public.blackjack_hands h where h.user_id = (select auth.uid()) and h.status = 'playing'),
    'today', (select jsonb_build_object(
        'hands', count(*),
        'net', coalesce(sum(h.payout - h.bet) filter (where h.status = 'done'), 0)
      ) from public.blackjack_hands h where h.user_id = (select auth.uid()) and h.created_at > now() - interval '1 day')
  );
$$;

revoke execute on function public.blackjack_value(smallint[]), public.blackjack_state(uuid), public.blackjack_settle(uuid),
  public.blackjack_start(integer, smallint[]), public.blackjack_deal(integer), public.blackjack_action(uuid, text),
  public.blackjack_current()
  from public, anon, authenticated;
grant execute on function public.blackjack_deal(integer), public.blackjack_action(uuid, text), public.blackjack_current() to authenticated;

commit;
