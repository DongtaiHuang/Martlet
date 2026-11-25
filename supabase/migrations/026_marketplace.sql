-- Student marketplace (issue #48, ADR 0040): listings only. Martlet never handles payments.
-- Students sell, give away, swap or ask for items; buyer and seller talk in a private thread on
-- the listing, then meet at an approved campus spot (ADR 0004). Listings last 30 days and can be
-- renewed. Listings and messages use the Board's reports and moderator queue.
-- Keep lib/marketplace-catalog.ts in sync. Run after 017, 024 and 025. Safe to re-run.
begin;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('sell', 'free', 'swap', 'wanted')),
  category text not null check (category in ('textbooks', 'electronics', 'furniture', 'clothing', 'kitchen', 'sports', 'other')),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  price_cents integer check (price_cents between 0 and 100000),
  condition text check (condition in ('new', 'like-new', 'good', 'fair')),
  course_code text references public.courses(code) on update cascade,
  meet_location_id text not null references public.campus_locations(id),
  photo_count smallint not null default 0 check (photo_count between 0 and 4),
  status text not null default 'active' check (status in ('active', 'reserved', 'sold', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  -- Only "sell" has a price; "wanted" may name a budget; free and swap have none.
  check (kind in ('sell', 'wanted') or price_cents is null),
  check (kind <> 'sell' or price_cents is not null),
  check (course_code is null or category = 'textbooks')
);
create index if not exists listings_browse_idx on public.listings (created_at desc) where status in ('active', 'reserved');
create index if not exists listings_seller_idx on public.listings (seller_id, created_at desc);

create table if not exists public.listing_messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  -- The thread: one per interested student. The seller replies into the buyer's thread.
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index if not exists listing_messages_thread_idx on public.listing_messages (listing_id, buyer_id, created_at);

alter table public.listings enable row level security;
alter table public.listing_messages enable row level security;
revoke all on public.listings, public.listing_messages from public, anon, authenticated;
grant select on public.listings, public.listing_messages to authenticated;

-- Reading -----------------------------------------------------------------------------------

-- Signed-in students see listings that are up and unexpired; sellers always see their own;
-- moderators see everything.
drop policy if exists "Read listings" on public.listings;
create policy "Read listings" on public.listings for select to authenticated
  using (
    (status in ('active', 'reserved', 'sold') and expires_at > now())
    or seller_id = (select auth.uid())
    or public.is_moderator()
  );

-- A thread is private to its buyer and the seller (plus moderators). Hidden messages stay
-- visible to their sender.
create or replace function public.is_listing_seller(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings where id = p_listing and seller_id = (select auth.uid()));
$$;

drop policy if exists "Read listing messages" on public.listing_messages;
create policy "Read listing messages" on public.listing_messages for select to authenticated
  using (
    public.is_moderator()
    or (
      (buyer_id = (select auth.uid()) or public.is_listing_seller(listing_id))
      and (status = 'visible' or sender_id = (select auth.uid()))
    )
  );

-- Writes ------------------------------------------------------------------------------------

-- Rate limits: 10 new listings a day and 20 open (active or reserved) at once.
create or replace function public.create_listing(
  p_kind text, p_category text, p_title text, p_description text, p_price_cents integer,
  p_condition text, p_course_code text, p_meet_location text, p_photo_count integer
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_id uuid;
begin
  if (select count(*) from public.listings where seller_id = v_user and created_at > now() - interval '1 day') >= 10 then
    raise exception 'listing too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  if (select count(*) from public.listings where seller_id = v_user and status in ('active', 'reserved') and expires_at > now()) >= 20 then
    raise exception 'too many open listings' using errcode = 'P0001', hint = 'open-limit';
  end if;
  insert into public.listings (seller_id, kind, category, title, description, price_cents, condition, course_code, meet_location_id, photo_count)
  values (v_user, p_kind, p_category, btrim(p_title), coalesce(btrim(p_description), ''), p_price_cents, nullif(p_condition, ''),
          nullif(p_course_code, ''), p_meet_location, coalesce(p_photo_count, 0))
  returning id into v_id;
  return v_id;
end $$;

-- Sellers mark a listing active, reserved or sold; hidden and removed ones stay as they are.
create or replace function public.set_listing_status(p_listing uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  if p_status not in ('active', 'reserved', 'sold') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.listings set status = p_status, updated_at = now()
  where id = p_listing and seller_id = v_user and status in ('active', 'reserved', 'sold');
end $$;

-- Renew for another 30 days, once it has a week or less left.
create or replace function public.renew_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  update public.listings set expires_at = now() + interval '30 days', updated_at = now()
  where id = p_listing and seller_id = v_user and status in ('active', 'reserved')
    and expires_at < now() + interval '7 days';
end $$;

create or replace function public.remove_my_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  update public.listings set status = 'removed', updated_at = now() where id = p_listing and seller_id = v_user;
end $$;

-- Buyers start (and continue) their thread; the seller replies into an existing thread.
-- 30 messages an hour. The other side gets one notification per listing, refreshed.
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

-- Notifications: a listing_message kind, one per (student, listing) ------------------------
alter table public.notifications add column if not exists listing_id uuid references public.listings(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('meetup_new', 'meetup_reminder', 'trend_like', 'meetup_updated', 'listing_message'));
alter table public.notifications drop constraint if exists notifications_listing_message_subject;
alter table public.notifications add constraint notifications_listing_message_subject
  check (kind <> 'listing_message' or listing_id is not null);
drop index if exists public.notifications_dedupe_idx;
create unique index notifications_dedupe_idx
  on public.notifications (
    user_id, kind,
    coalesce(meetup_id, '00000000-0000-4000-8000-000000000000'::uuid),
    coalesce(trend_entry_id, '00000000-0000-4000-8000-000000000000'::uuid),
    coalesce(listing_id, '00000000-0000-4000-8000-000000000000'::uuid)
  );

-- Reports and moderation: listings and messages join posts, comments and photos ------------
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('post', 'comment', 'photo', 'listing', 'listing_message'));

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
  if p_type not in ('post', 'comment', 'photo', 'listing', 'listing_message') then return 'already'; end if;
  insert into public.content_reports (target_type, target_id, reporter_id, reason, note)
  values (p_type, p_id, v_user, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (target_type, target_id, reporter_id) do nothing;
  if not found then return 'already'; end if;
  select count(*) into v_open from public.content_reports where target_type = p_type and target_id = p_id and resolved_at is null;
  -- A private message has one possible reporter, so one report hides it.
  if v_open >= 3 or p_type = 'listing_message' then
    if p_type = 'post' then update public.board_posts set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'comment' then update public.board_comments set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'photo' then update public.meetup_photos set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'listing' then update public.listings set status = 'hidden', updated_at = now() where id = p_id and status in ('active', 'reserved', 'sold');
    else update public.listing_messages set status = 'hidden' where id = p_id and status = 'visible'; end if;
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
    elsif p_type = 'listing_message' then update public.listing_messages set status = v_status where id = p_id and status <> 'removed'; end if;
  end if;
  update public.content_reports
  set resolved_at = now(), resolution = case p_action when 'restore' then 'restored' when 'remove' then 'removed' else 'dismissed' end
  where target_type = p_type and target_id = p_id and resolved_at is null;
end $$;

-- Photos ------------------------------------------------------------------------------------
-- Private bucket; "{listing-id}/{n}.jpg" with n from 0 to photo_count - 1. JPEG only (re-encoded
-- in the browser, so no EXIF/GPS), 5 MB. Readable while the listing is readable to you.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.listing_photo_listing_id(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select nullif(substring(object_name from '^([0-9a-f-]{36})/[0-3]\.jpg$'), '')::uuid;
$$;
create or replace function public.listing_photo_index(object_name text) returns integer
language sql immutable set search_path = '' as $$
  select nullif(substring(object_name from '^[0-9a-f-]{36}/([0-3])\.jpg$'), '')::integer;
$$;

-- A listing's files are dead once it's removed or deleted (by its seller, a moderator or cleanup).
create or replace function public.listing_live(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings where id = p_listing and status <> 'removed');
$$;

drop policy if exists "Upload own listing photo" on storage.objects;
create policy "Upload own listing photo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and exists (
      select 1 from public.listings l
      where l.id = public.listing_photo_listing_id(objects.name)
        and l.seller_id = (select auth.uid()) and l.status = 'active'
        and public.listing_photo_index(objects.name) < l.photo_count
        and l.created_at > now() - interval '10 minutes'
    )
  );
drop policy if exists "Read listing photos" on storage.objects;
create policy "Read listing photos" on storage.objects for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      exists (select 1 from public.listings l where l.id = public.listing_photo_listing_id(objects.name) and l.status <> 'removed')
      or (objects.owner_id = (select auth.uid())::text and not public.listing_live(public.listing_photo_listing_id(objects.name)))
    )
  );
drop policy if exists "Delete own dead listing photo" on storage.objects;
create policy "Delete own dead listing photo" on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and objects.owner_id = (select auth.uid())::text
    and not public.listing_live(public.listing_photo_listing_id(objects.name))
  );

-- The signed-in student's dead listing files, deleted by the app through the Storage API.
create or replace function public.my_listing_photo_files_to_purge() returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'listing-photos' and o.owner_id = (select auth.uid())::text
    and not public.listing_live(public.listing_photo_listing_id(o.name))
  limit 100;
$$;

-- Cleanup -----------------------------------------------------------------------------------
-- Removed listings go after 7 days, expired ones 30 days after expiring (time to renew).
create or replace function public.cleanup_marketplace(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  delete from public.listings
  where (status = 'removed' and updated_at < p_now - interval '7 days')
     or expires_at < p_now - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;
revoke all on function public.cleanup_marketplace(timestamptz) from public, anon, authenticated;

-- Grants ------------------------------------------------------------------------------------
revoke execute on function public.is_listing_seller(uuid),
  public.create_listing(text, text, text, text, integer, text, text, text, integer),
  public.set_listing_status(uuid, text), public.renew_listing(uuid), public.remove_my_listing(uuid),
  public.send_listing_message(uuid, uuid, text), public.listing_photo_listing_id(text), public.listing_photo_index(text),
  public.listing_live(uuid), public.my_listing_photo_files_to_purge()
  from public, anon;
grant execute on function public.is_listing_seller(uuid),
  public.create_listing(text, text, text, text, integer, text, text, text, integer),
  public.set_listing_status(uuid, text), public.renew_listing(uuid), public.remove_my_listing(uuid),
  public.send_listing_message(uuid, uuid, text), public.listing_photo_listing_id(text), public.listing_photo_index(text),
  public.listing_live(uuid), public.my_listing_photo_files_to_purge()
  to authenticated;

commit;

-- Run the cleanup hourly with pg_cron when it's enabled (see 024).
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'pg_cron is not enabled: enable it in Database → Extensions and re-run 024 and 026.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-marketplace';
  perform cron.schedule('cleanup-marketplace', '27 * * * *', 'select public.cleanup_marketplace()');
end $$;
