-- Blocking (ADR 0051): a student can block another. Blocked pairs can't message each other
-- (marketplace threads, creator requests), and the blocker stops seeing the other's table chat,
-- board posts, comments, listings and creator profile. Students block "the author of this item",
-- so user ids never need to reach the browser. Run after 026, 028 and 029. Safe to re-run.
begin;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select on public.user_blocks to authenticated;
drop policy if exists "Read own blocks" on public.user_blocks;
create policy "Read own blocks" on public.user_blocks for select to authenticated using (blocker_id = (select auth.uid()));

/** True when either student has blocked the other. */
create or replace function public.blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a));
$$;

/** The author of an item, for blocking by item (the same types as reports). */
create or replace function public.content_author(p_type text, p_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'post' then (select author_id from public.board_posts where id = p_id)
    when 'comment' then (select author_id from public.board_comments where id = p_id)
    when 'photo' then (select uploader_id from public.meetup_photos where id = p_id)
    when 'listing' then (select seller_id from public.listings where id = p_id)
    when 'listing_message' then (select sender_id from public.listing_messages where id = p_id)
    when 'table_chat' then (select user_id from public.bj_chat_messages where id = p_id)
    when 'creator' then (select user_id from public.creator_profiles where user_id = p_id)
    when 'creator_message' then (select sender_id from public.creator_messages where id = p_id)
  end;
$$;

-- Block the author of an item. Returns 'blocked', 'already', 'self' or 'missing'. 500 at most.
create or replace function public.block_author(p_type text, p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_target uuid := public.content_author(p_type, p_id);
begin
  if v_target is null then return 'missing'; end if;
  if v_target = v_user then return 'self'; end if;
  if (select count(*) from public.user_blocks where blocker_id = v_user) >= 500 then
    raise exception 'too many blocks' using errcode = 'P0001', hint = 'block-limit';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_user, v_target) on conflict do nothing;
  return case when found then 'blocked' else 'already' end;
end $$;

create or replace function public.unblock_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  delete from public.user_blocks where blocker_id = v_user and blocked_id = p_user;
end $$;

/** The people you've blocked, newest first, with display names (for settings). */
create or replace function public.my_blocks() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', b.blocked_id, 'name', coalesce(p.display_name, 'Martlet Student'), 'created_at', b.created_at) order by b.created_at desc), '[]'::jsonb)
  from public.user_blocks b left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid());
$$;

-- Messaging refuses blocked pairs ----------------------------------------------------------------

-- 026's send_listing_message, plus the block check.
create or replace function public.send_listing_message(p_listing uuid, p_buyer uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public.board_require_user();
  v_listing public.listings%rowtype;
  v_recipient uuid;
  v_id uuid;
begin
  select * into v_listing from public.listings where id = p_listing;
  if not found or v_listing.status not in ('active', 'reserved') or v_listing.expires_at <= now() then
    raise exception 'listing not available' using errcode = 'P0002';
  end if;
  if v_user = v_listing.seller_id then
    if p_buyer is null or p_buyer = v_user or not exists (
      select 1 from public.listing_messages where listing_id = p_listing and buyer_id = p_buyer and sender_id = p_buyer
    ) then
      raise exception 'no such conversation' using errcode = 'P0002';
    end if;
    v_recipient := p_buyer;
  else
    if p_buyer is not null and p_buyer <> v_user then raise exception 'not your conversation' using errcode = '42501'; end if;
    p_buyer := v_user;
    v_recipient := v_listing.seller_id;
  end if;
  if public.blocked_between(v_user, v_recipient) then raise exception 'blocked' using errcode = '42501', hint = 'blocked'; end if;
  if (select count(*) from public.listing_messages where sender_id = v_user and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'messaging too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  insert into public.listing_messages (listing_id, buyer_id, sender_id, body)
  values (p_listing, p_buyer, v_user, btrim(p_body)) returning id into v_id;

  delete from public.notifications where user_id = v_recipient and kind = 'listing_message' and listing_id = p_listing;
  insert into public.notifications (user_id, kind, listing_id, title, body, href)
  values (
    v_recipient, 'listing_message', p_listing,
    left('New message about “' || v_listing.title || '”', 200),
    left(btrim(p_body), 140),
    '/marketplace/' || p_listing || case when v_recipient = v_listing.seller_id then '?buyer=' || p_buyer else '' end
  )
  on conflict do nothing;
  return v_id;
end $$;

-- 029's send_creator_request, plus the block check.
create or replace function public.send_creator_request(
  p_creator uuid, p_discipline text, p_budget_cents integer, p_needed_by date, p_body text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_id uuid;
begin
  if p_creator = v_user then raise exception 'not your own profile' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.creator_profiles where user_id = p_creator and status = 'visible' and open_for_requests
  ) then
    raise exception 'creator not taking requests' using errcode = 'P0002';
  end if;
  if public.blocked_between(v_user, p_creator) then raise exception 'blocked' using errcode = '42501', hint = 'blocked'; end if;
  if p_needed_by is not null and p_needed_by < current_date then
    raise exception 'date in the past' using errcode = '22023', hint = 'past-date';
  end if;
  if (select count(*) from public.creator_requests where client_id = v_user and created_at > now() - interval '1 day') >= 5 then
    raise exception 'requesting too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  if (select count(*) from public.creator_requests
      where client_id = v_user and creator_id = p_creator and status in ('open', 'accepted')) >= 2 then
    raise exception 'too many open requests' using errcode = 'P0001', hint = 'open-limit';
  end if;
  insert into public.creator_requests (creator_id, client_id, discipline, budget_cents, needed_by)
  values (p_creator, v_user, p_discipline, p_budget_cents, p_needed_by)
  returning id into v_id;
  insert into public.creator_messages (request_id, sender_id, body) values (v_id, v_user, btrim(p_body));
  perform public.creator_notify(p_creator, v_id, 'New request on your creator profile', p_body);
  return v_id;
end $$;

-- 029's send_creator_message, plus the block check.
create or replace function public.send_creator_message(p_request uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_req public.creator_requests%rowtype; v_id uuid;
begin
  select * into v_req from public.creator_requests where id = p_request;
  if not found or v_user not in (v_req.creator_id, v_req.client_id) then
    raise exception 'no such request' using errcode = 'P0002';
  end if;
  if v_req.status not in ('open', 'accepted') then raise exception 'request closed' using errcode = 'P0002'; end if;
  if public.blocked_between(v_req.creator_id, v_req.client_id) then raise exception 'blocked' using errcode = '42501', hint = 'blocked'; end if;
  if (select count(*) from public.creator_messages where sender_id = v_user and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'messaging too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  insert into public.creator_messages (request_id, sender_id, body) values (p_request, v_user, btrim(p_body)) returning id into v_id;
  update public.creator_requests set updated_at = now() where id = p_request;
  perform public.creator_notify(
    case when v_user = v_req.creator_id then v_req.client_id else v_req.creator_id end,
    p_request, 'New message about your request', p_body
  );
  return v_id;
end $$;

-- 028's bj_chat_recent, without lines from people you've blocked (or who blocked you).
create or replace function public.bj_chat_recent() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_table text;
begin
  select table_id into v_table from public.bj_seats where user_id = v_user;
  if v_table is null then return null; end if;
  update public.bj_seats set last_seen = now() where user_id = v_user;
  return jsonb_build_object(
    'table_id', v_table,
    'table_name', (select name from public.bj_tables where id = v_table),
    'messages', coalesce((
      select jsonb_agg(m order by m.at) from (
        select c.id, coalesce(p.display_name, 'Martlet Student') as name, c.body, c.user_id = v_user as mine, c.created_at as at
        from public.bj_chat_messages c left join public.profiles p on p.id = c.user_id
        where c.table_id = v_table and c.status = 'visible' and c.created_at > now() - interval '1 day'
          and not public.blocked_between(v_user, c.user_id)
        order by c.created_at desc limit 50
      ) m), '[]'::jsonb)
  );
end $$;

revoke execute on function public.blocked_between(uuid, uuid), public.content_author(text, uuid) from public, anon, authenticated;
revoke execute on function public.block_author(text, uuid), public.unblock_user(uuid), public.my_blocks() from public, anon;
grant execute on function public.block_author(text, uuid), public.unblock_user(uuid), public.my_blocks() to authenticated;

commit;
