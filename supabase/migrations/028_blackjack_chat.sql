-- Blackjack table chat (ADR 0041). Students seated at a blackjack table can text each other.
-- Messages are visible only to whoever is seated at that table (and moderators), last one day,
-- and can be reported like Board posts: a report hides the message until a moderator checks.
-- Live updates through Supabase Realtime (RLS applies to each subscriber). Safe to re-run.
begin;

create table if not exists public.bj_chat_messages (
  id uuid primary key default gen_random_uuid(),
  table_id text not null references public.bj_tables(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index if not exists bj_chat_table_idx on public.bj_chat_messages (table_id, created_at desc);
create index if not exists bj_chat_user_idx on public.bj_chat_messages (user_id, created_at desc);

alter table public.bj_chat_messages enable row level security;
revoke all on public.bj_chat_messages from public, anon, authenticated;
grant select on public.bj_chat_messages to authenticated;

-- bj_seats has no policies, so policies ask through this helper. It only says whether *you* sit there.
create or replace function public.bj_is_seated(p_table text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bj_seats where table_id = p_table and user_id = (select auth.uid()));
$$;
revoke execute on function public.bj_is_seated(text) from public, anon;
grant execute on function public.bj_is_seated(text) to authenticated;

drop policy if exists "Seated players read their table chat" on public.bj_chat_messages;
create policy "Seated players read their table chat" on public.bj_chat_messages for select to authenticated
  using (status = 'visible' and created_at > now() - interval '1 day' and public.bj_is_seated(table_id));
drop policy if exists "Moderators read table chat" on public.bj_chat_messages;
create policy "Moderators read table chat" on public.bj_chat_messages for select to authenticated
  using (public.is_moderator());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bj_chat_messages') then
    alter publication supabase_realtime add table public.bj_chat_messages;
  end if;
end $$;

-- Send a message to the table you're seated at. 1–200 characters, 10 a minute.
create or replace function public.bj_chat_send(p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.market_require_user(); v_table text;
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
begin
  if char_length(v_body) not between 1 and 200 then raise exception 'messages are 1 to 200 characters' using errcode = '22023'; end if;
  select table_id into v_table from public.bj_seats where user_id = v_user;
  if v_table is null then raise exception 'take a seat to chat' using errcode = 'P0001', hint = 'seat'; end if;
  if (select count(*) from public.bj_chat_messages where user_id = v_user and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'slow down' using errcode = 'P0001', hint = 'rate';
  end if;
  update public.bj_seats set last_seen = now() where user_id = v_user;
  insert into public.bj_chat_messages (table_id, user_id, body) values (v_table, v_user, v_body);
  -- Chat is short-lived. Hidden messages wait (up to 30 days) for a moderator.
  delete from public.bj_chat_messages
  where table_id = v_table
    and ((created_at < now() - interval '1 day' and status <> 'hidden') or created_at < now() - interval '30 days');
end $$;

-- The chat at the table you're seated at (last 50 messages of the day), or null when you aren't
-- seated. Reading it also counts as being at the table, so your seat is kept while you chat from
-- another blackjack page.
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
        order by c.created_at desc limit 50
      ) m), '[]'::jsonb)
  );
end $$;

revoke execute on function public.bj_chat_send(text), public.bj_chat_recent() from public, anon;
grant execute on function public.bj_chat_send(text), public.bj_chat_recent() to authenticated;

-- Reports: table chat joins the Board's reports (017, 025, 026) --------------------------------
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('post', 'comment', 'photo', 'listing', 'listing_message', 'table_chat'));

create or replace function public.report_content(p_type text, p_id uuid, p_reason text, p_note text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_open integer;
begin
  if p_type = 'post' and not exists (select 1 from public.board_posts where id = p_id and author_id <> v_user and status = 'visible') then return 'already'; end if;
  if p_type = 'comment' and not exists (select 1 from public.board_comments where id = p_id and author_id <> v_user and status = 'visible') then return 'already'; end if;
  if p_type = 'photo' and not exists (
    select 1 from public.meetup_photos where id = p_id and uploader_id <> v_user and status = 'visible' and public.can_view_meetup_photo(id)
  ) then return 'already'; end if;
  if p_type = 'listing' and not exists (
    select 1 from public.listings where id = p_id and seller_id <> v_user and status in ('active', 'reserved', 'sold') and expires_at > now()
  ) then return 'already'; end if;
  if p_type = 'listing_message' and not exists (
    select 1 from public.listing_messages m join public.listings l on l.id = m.listing_id
    where m.id = p_id and m.sender_id <> v_user and m.status = 'visible' and (m.buyer_id = v_user or l.seller_id = v_user)
  ) then return 'already'; end if;
  if p_type = 'table_chat' and not exists (
    select 1 from public.bj_chat_messages where id = p_id and user_id <> v_user and status = 'visible' and public.bj_is_seated(table_id)
  ) then return 'already'; end if;
  if p_type not in ('post', 'comment', 'photo', 'listing', 'listing_message', 'table_chat') then return 'already'; end if;
  insert into public.content_reports (target_type, target_id, reporter_id, reason, note)
  values (p_type, p_id, v_user, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (target_type, target_id, reporter_id) do nothing;
  if not found then return 'already'; end if;
  select count(*) into v_open from public.content_reports where target_type = p_type and target_id = p_id and resolved_at is null;
  -- A private message has one possible reporter, and a table has at most four others, so one
  -- report hides either.
  if v_open >= 3 or p_type in ('listing_message', 'table_chat') then
    if p_type = 'post' then update public.board_posts set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'comment' then update public.board_comments set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'photo' then update public.meetup_photos set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'listing' then update public.listings set status = 'hidden', updated_at = now() where id = p_id and status in ('active', 'reserved', 'sold');
    elsif p_type = 'listing_message' then update public.listing_messages set status = 'hidden' where id = p_id and status = 'visible';
    else update public.bj_chat_messages set status = 'hidden' where id = p_id and status = 'visible'; end if;
    return 'hidden';
  end if;
  return 'reported';
end $$;

create or replace function public.moderate_content(p_type text, p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_status text := case p_action when 'restore' then 'visible' when 'remove' then 'removed' else null end;
begin
  if not public.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_action not in ('restore', 'remove', 'dismiss') then raise exception 'bad action'; end if;
  if v_status is not null then
    if p_type = 'post' then update public.board_posts set status = v_status where id = p_id;
    elsif p_type = 'comment' then update public.board_comments set status = v_status where id = p_id;
    elsif p_type = 'photo' then update public.meetup_photos set status = v_status where id = p_id and status <> 'removed';
    elsif p_type = 'listing' then
      update public.listings set status = case v_status when 'visible' then 'active' else v_status end, updated_at = now()
      where id = p_id and status <> 'removed';
    elsif p_type = 'listing_message' then update public.listing_messages set status = v_status where id = p_id and status <> 'removed';
    elsif p_type = 'table_chat' then update public.bj_chat_messages set status = v_status where id = p_id and status <> 'removed'; end if;
  end if;
  update public.content_reports
  set resolved_at = now(), resolution = case p_action when 'restore' then 'restored' when 'remove' then 'removed' else 'dismissed' end
  where target_type = p_type and target_id = p_id and resolved_at is null;
end $$;

commit;
