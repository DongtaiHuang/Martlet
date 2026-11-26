-- Creator directory (ADR 0042): student creators and tutors show a profile and a portfolio
-- (images and links), and other students send commission or service requests in private
-- threads. Martlet never handles money. Replaces the Campus Board's "Skill" posts for new
-- offers (old ones stay readable). Profiles and request messages use the Board's reports.
-- Keep lib/creator-catalog.ts in sync. Run after 026 and 028. Safe to re-run.
begin;

-- Shape helpers ----------------------------------------------------------------------------

create or replace function public.creator_link_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p ~ '^https://[^[:space:]<>"]{3,290}$';
$$;

create or replace function public.creator_links_ok(p text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(p), 0) <= 5
    and not exists (select 1 from unnest(p) as u(link) where not public.creator_link_ok(u.link));
$$;

-- Tables -----------------------------------------------------------------------------------

create table if not exists public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  headline text not null check (char_length(btrim(headline)) between 3 and 80),
  bio text not null default '' check (char_length(bio) <= 1500),
  disciplines text[] not null check (
    cardinality(disciplines) between 1 and 3
    and disciplines <@ array['music', 'coding', 'photography', 'art', 'design', 'video', 'writing', 'tutoring', 'other']::text[]
  ),
  rates text not null default '' check (char_length(rates) <= 200),
  links text[] not null default '{}' check (public.creator_links_ok(links)),
  open_for_requests boolean not null default true,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_profiles_browse_idx on public.creator_profiles (updated_at desc) where status = 'visible';

create table if not exists public.creator_works (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  caption text not null default '' check (char_length(caption) <= 300),
  link text check (link is null or public.creator_link_ok(link)),
  has_image boolean not null default false,
  created_at timestamptz not null default now(),
  -- A work is an image, a link (a track, a repo, a video) or both.
  check (has_image or link is not null)
);
create index if not exists creator_works_creator_idx on public.creator_works (creator_id, created_at);

create table if not exists public.creator_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(user_id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  discipline text not null check (discipline in ('music', 'coding', 'photography', 'art', 'design', 'video', 'writing', 'tutoring', 'other')),
  budget_cents integer check (budget_cents between 0 and 100000),
  needed_by date,
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creator_id <> client_id)
);
create index if not exists creator_requests_creator_idx on public.creator_requests (creator_id, updated_at desc);
create index if not exists creator_requests_client_idx on public.creator_requests (client_id, updated_at desc);

create table if not exists public.creator_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.creator_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index if not exists creator_messages_request_idx on public.creator_messages (request_id, created_at);
create index if not exists creator_messages_sender_idx on public.creator_messages (sender_id, created_at);

alter table public.creator_profiles enable row level security;
alter table public.creator_works enable row level security;
alter table public.creator_requests enable row level security;
alter table public.creator_messages enable row level security;
revoke all on public.creator_profiles, public.creator_works, public.creator_requests, public.creator_messages from public, anon, authenticated;
grant select on public.creator_profiles, public.creator_works, public.creator_requests, public.creator_messages to authenticated;

-- Reading ----------------------------------------------------------------------------------

-- A creator's profile and works are readable by signed-in students while the profile is
-- visible; owners always see their own; moderators see everything.
create or replace function public.creator_readable(p_creator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.creator_profiles
    where user_id = p_creator
      and (status = 'visible' or user_id = (select auth.uid()) or public.is_moderator())
  );
$$;

drop policy if exists "Read creator profiles" on public.creator_profiles;
create policy "Read creator profiles" on public.creator_profiles for select to authenticated
  using (status = 'visible' or user_id = (select auth.uid()) or public.is_moderator());

drop policy if exists "Read creator works" on public.creator_works;
create policy "Read creator works" on public.creator_works for select to authenticated
  using (public.creator_readable(creator_id));

-- A request and its thread are private to the client and the creator (plus moderators).
-- Hidden messages stay visible to their sender.
create or replace function public.is_creator_request_party(p_request uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.creator_requests
    where id = p_request and (select auth.uid()) in (creator_id, client_id)
  );
$$;

drop policy if exists "Read creator requests" on public.creator_requests;
create policy "Read creator requests" on public.creator_requests for select to authenticated
  using ((select auth.uid()) in (creator_id, client_id) or public.is_moderator());

drop policy if exists "Read creator messages" on public.creator_messages;
create policy "Read creator messages" on public.creator_messages for select to authenticated
  using (
    public.is_moderator()
    or (public.is_creator_request_party(request_id) and (status = 'visible' or sender_id = (select auth.uid())))
  );

-- Notifications: a creator_request kind, one per (student, request) ------------------------
alter table public.notifications add column if not exists creator_request_id uuid references public.creator_requests(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('meetup_new', 'meetup_reminder', 'trend_like', 'meetup_updated', 'listing_message', 'creator_request'));
alter table public.notifications drop constraint if exists notifications_creator_request_subject;
alter table public.notifications add constraint notifications_creator_request_subject
  check (kind <> 'creator_request' or creator_request_id is not null);
drop index if exists public.notifications_dedupe_idx;
create unique index notifications_dedupe_idx
  on public.notifications (
    user_id, kind,
    coalesce(meetup_id, '00000000-0000-4000-8000-000000000000'::uuid),
    coalesce(trend_entry_id, '00000000-0000-4000-8000-000000000000'::uuid),
    coalesce(listing_id, '00000000-0000-4000-8000-000000000000'::uuid),
    coalesce(creator_request_id, '00000000-0000-4000-8000-000000000000'::uuid)
  );

-- One refreshed notification per request for the recipient.
create or replace function public.creator_notify(p_user uuid, p_request uuid, p_title text, p_body text) returns void
language sql security definer set search_path = '' as $$
  delete from public.notifications where user_id = p_user and kind = 'creator_request' and creator_request_id = p_request;
  insert into public.notifications (user_id, kind, creator_request_id, title, body, href)
  values (p_user, 'creator_request', p_request, left(p_title, 200), left(btrim(p_body), 140), '/creators/requests/' || p_request)
  on conflict do nothing;
$$;
revoke all on function public.creator_notify(uuid, uuid, text, text) from public, anon, authenticated;

-- Profile writes ---------------------------------------------------------------------------

-- Create or update your profile. A hidden profile stays hidden; a removed one can't be edited.
create or replace function public.save_creator_profile(
  p_headline text, p_bio text, p_disciplines text[], p_rates text, p_links text[], p_open boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  if exists (select 1 from public.creator_profiles where user_id = v_user and status = 'removed') then
    raise exception 'profile removed' using errcode = '42501', hint = 'removed';
  end if;
  insert into public.creator_profiles (user_id, headline, bio, disciplines, rates, links, open_for_requests)
  values (v_user, btrim(p_headline), coalesce(btrim(p_bio), ''), p_disciplines, coalesce(btrim(p_rates), ''),
          coalesce(p_links, '{}'), coalesce(p_open, true))
  on conflict (user_id) do update set
    headline = excluded.headline, bio = excluded.bio, disciplines = excluded.disciplines, rates = excluded.rates,
    links = excluded.links, open_for_requests = excluded.open_for_requests, updated_at = now();
end $$;

-- Deleting a profile deletes its works and its requests (both sides' threads).
create or replace function public.delete_my_creator_profile() returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  delete from public.creator_profiles where user_id = v_user and status <> 'removed';
end $$;

-- Up to 8 works, 20 new ones a day. Image files are uploaded right after (see Storage).
create or replace function public.add_creator_work(p_title text, p_caption text, p_link text, p_has_image boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_id uuid;
begin
  if not exists (select 1 from public.creator_profiles where user_id = v_user and status <> 'removed') then
    raise exception 'no creator profile' using errcode = 'P0002';
  end if;
  if (select count(*) from public.creator_works where creator_id = v_user) >= 8 then
    raise exception 'too many works' using errcode = 'P0001', hint = 'work-limit';
  end if;
  if (select count(*) from public.creator_works where creator_id = v_user and created_at > now() - interval '1 day') >= 20 then
    raise exception 'adding too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  insert into public.creator_works (creator_id, title, caption, link, has_image)
  values (v_user, btrim(p_title), coalesce(btrim(p_caption), ''), nullif(btrim(p_link), ''), coalesce(p_has_image, false))
  returning id into v_id;
  update public.creator_profiles set updated_at = now() where user_id = v_user;
  return v_id;
end $$;

create or replace function public.delete_creator_work(p_work uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  delete from public.creator_works where id = p_work and creator_id = v_user;
end $$;

-- Requests and messages ---------------------------------------------------------------------

-- A student asks a visible creator who is open for requests. 5 new requests a day, and at most
-- 2 open or accepted requests to the same creator. The first message describes the job.
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

-- Either side writes while the request is open or accepted. 30 messages an hour.
create or replace function public.send_creator_message(p_request uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_req public.creator_requests%rowtype; v_id uuid;
begin
  select * into v_req from public.creator_requests where id = p_request;
  if not found or v_user not in (v_req.creator_id, v_req.client_id) then
    raise exception 'no such request' using errcode = 'P0002';
  end if;
  if v_req.status not in ('open', 'accepted') then raise exception 'request closed' using errcode = 'P0002'; end if;
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

-- The creator accepts or declines an open request and closes an accepted one (done).
-- The client can close (withdraw) an open or accepted request.
create or replace function public.set_creator_request_status(p_request uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_req public.creator_requests%rowtype; v_ok boolean;
begin
  select * into v_req from public.creator_requests where id = p_request;
  if not found or v_user not in (v_req.creator_id, v_req.client_id) then
    raise exception 'no such request' using errcode = 'P0002';
  end if;
  v_ok := case
    when v_user = v_req.creator_id then
      (v_req.status = 'open' and p_status in ('accepted', 'declined')) or (v_req.status = 'accepted' and p_status = 'closed')
    else v_req.status in ('open', 'accepted') and p_status = 'closed'
  end;
  if not coalesce(v_ok, false) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.creator_requests set status = p_status, updated_at = now() where id = p_request;
  perform public.creator_notify(
    case when v_user = v_req.creator_id then v_req.client_id else v_req.creator_id end,
    p_request,
    case p_status when 'accepted' then 'Your request was accepted' when 'declined' then 'Your request was declined'
                  else 'A request was closed' end,
    ''
  );
end $$;

-- Reports and moderation: creator profiles and request messages join the queue -------------
alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('post', 'comment', 'photo', 'listing', 'listing_message', 'table_chat', 'creator', 'creator_message'));

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
  if p_type = 'creator' and not exists (
    select 1 from public.creator_profiles where user_id = p_id and user_id <> v_user and status = 'visible'
  ) then return 'already'; end if;
  if p_type = 'creator_message' and not exists (
    select 1 from public.creator_messages m join public.creator_requests r on r.id = m.request_id
    where m.id = p_id and m.sender_id <> v_user and m.status = 'visible' and v_user in (r.creator_id, r.client_id)
  ) then return 'already'; end if;
  if p_type not in ('post', 'comment', 'photo', 'listing', 'listing_message', 'table_chat', 'creator', 'creator_message') then return 'already'; end if;
  insert into public.content_reports (target_type, target_id, reporter_id, reason, note)
  values (p_type, p_id, v_user, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (target_type, target_id, reporter_id) do nothing;
  if not found then return 'already'; end if;
  select count(*) into v_open from public.content_reports where target_type = p_type and target_id = p_id and resolved_at is null;
  -- A private message has one possible reporter, and a table has at most four others, so one
  -- report hides either.
  if v_open >= 3 or p_type in ('listing_message', 'table_chat', 'creator_message') then
    if p_type = 'post' then update public.board_posts set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'comment' then update public.board_comments set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'photo' then update public.meetup_photos set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'listing' then update public.listings set status = 'hidden', updated_at = now() where id = p_id and status in ('active', 'reserved', 'sold');
    elsif p_type = 'listing_message' then update public.listing_messages set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'table_chat' then update public.bj_chat_messages set status = 'hidden' where id = p_id and status = 'visible';
    elsif p_type = 'creator' then update public.creator_profiles set status = 'hidden' where user_id = p_id and status = 'visible';
    else update public.creator_messages set status = 'hidden' where id = p_id and status = 'visible'; end if;
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
    elsif p_type = 'table_chat' then update public.bj_chat_messages set status = v_status where id = p_id and status <> 'removed';
    elsif p_type = 'creator' then update public.creator_profiles set status = v_status, updated_at = now() where user_id = p_id and status <> 'removed';
    elsif p_type = 'creator_message' then update public.creator_messages set status = v_status where id = p_id and status <> 'removed'; end if;
  end if;
  update public.content_reports
  set resolved_at = now(), resolution = case p_action when 'restore' then 'restored' when 'remove' then 'removed' else 'dismissed' end
  where target_type = p_type and target_id = p_id and resolved_at is null;
end $$;

-- Portfolio images --------------------------------------------------------------------------
-- Private bucket; "{creator-id}/{work-id}.jpg". JPEG only (re-encoded in the browser, so no
-- EXIF/GPS), 5 MB. Readable while the profile is readable to you.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-works', 'creator-works', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.creator_work_file_id(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select nullif(substring(object_name from '^[0-9a-f-]{36}/([0-9a-f-]{36})\.jpg$'), '')::uuid;
$$;

-- A work's file is live while the work exists and its profile isn't removed.
create or replace function public.creator_work_live(p_work uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.creator_works w join public.creator_profiles p on p.user_id = w.creator_id
    where w.id = p_work and w.has_image and p.status <> 'removed'
  );
$$;

create or replace function public.creator_work_file_readable(p_work uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.creator_works w
    where w.id = p_work and w.has_image and public.creator_readable(w.creator_id)
  );
$$;

drop policy if exists "Upload own creator work" on storage.objects;
create policy "Upload own creator work" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'creator-works'
    and split_part(objects.name, '/', 1) = (select auth.uid())::text
    and exists (
      select 1 from public.creator_works w
      where w.id = public.creator_work_file_id(objects.name)
        and w.creator_id = (select auth.uid()) and w.has_image
        and w.created_at > now() - interval '10 minutes'
    )
  );
drop policy if exists "Read creator works" on storage.objects;
create policy "Read creator works" on storage.objects for select to authenticated
  using (
    bucket_id = 'creator-works'
    and (
      public.creator_work_file_readable(public.creator_work_file_id(objects.name))
      or (objects.owner_id = (select auth.uid())::text and not public.creator_work_live(public.creator_work_file_id(objects.name)))
    )
  );
drop policy if exists "Delete own dead creator work" on storage.objects;
create policy "Delete own dead creator work" on storage.objects for delete to authenticated
  using (
    bucket_id = 'creator-works'
    and objects.owner_id = (select auth.uid())::text
    and not public.creator_work_live(public.creator_work_file_id(objects.name))
  );

-- The signed-in student's dead portfolio files, deleted by the app through the Storage API.
create or replace function public.my_creator_work_files_to_purge() returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'creator-works' and o.owner_id = (select auth.uid())::text
    and not public.creator_work_live(public.creator_work_file_id(o.name))
  limit 100;
$$;

-- Cleanup -----------------------------------------------------------------------------------
-- Declined and closed requests go 30 days after their last change, any request after 180 days
-- of silence, and removed profiles after 30 days (their owners can then start over).
create or replace function public.cleanup_creators(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_requests integer; v_profiles integer;
begin
  delete from public.creator_requests
  where (status in ('declined', 'closed') and updated_at < p_now - interval '30 days')
     or updated_at < p_now - interval '180 days';
  get diagnostics v_requests = row_count;
  delete from public.creator_profiles where status = 'removed' and updated_at < p_now - interval '30 days';
  get diagnostics v_profiles = row_count;
  return v_requests + v_profiles;
end $$;
revoke all on function public.cleanup_creators(timestamptz) from public, anon, authenticated;

-- Grants ------------------------------------------------------------------------------------
revoke execute on function public.creator_readable(uuid), public.is_creator_request_party(uuid),
  public.save_creator_profile(text, text, text[], text, text[], boolean), public.delete_my_creator_profile(),
  public.add_creator_work(text, text, text, boolean), public.delete_creator_work(uuid),
  public.send_creator_request(uuid, text, integer, date, text), public.send_creator_message(uuid, text),
  public.set_creator_request_status(uuid, text), public.creator_work_file_id(text), public.creator_work_live(uuid),
  public.creator_work_file_readable(uuid), public.my_creator_work_files_to_purge()
  from public, anon;
grant execute on function public.creator_readable(uuid), public.is_creator_request_party(uuid),
  public.save_creator_profile(text, text, text[], text, text[], boolean), public.delete_my_creator_profile(),
  public.add_creator_work(text, text, text, boolean), public.delete_creator_work(uuid),
  public.send_creator_request(uuid, text, integer, date, text), public.send_creator_message(uuid, text),
  public.set_creator_request_status(uuid, text), public.creator_work_file_id(text), public.creator_work_live(uuid),
  public.creator_work_file_readable(uuid), public.my_creator_work_files_to_purge()
  to authenticated;

commit;

-- Run the cleanup daily with pg_cron when it's enabled (see 024).
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise warning 'pg_cron is not enabled: enable it in Database → Extensions and re-run 024 and 029.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-creators';
  perform cron.schedule('cleanup-creators', '41 4 * * *', 'select public.cleanup_creators()');
end $$;
