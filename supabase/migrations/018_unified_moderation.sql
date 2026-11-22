-- Unified moderation for meetups and landmark photo unlocks.
-- Depends on 006_landmarks, 015_guest_browsing, and 017_community_board.
-- Keep board history; never delete meetups, photos, unlocks, or report evidence.
-- Review and run ONCE on the shared database before deploying the matching web code.
begin;

alter table public.meetups add column if not exists moderation_status text not null default 'visible'
  check (moderation_status in ('visible', 'hidden', 'removed'));
alter table public.landmark_unlocks add column if not exists moderation_status text not null default 'visible'
  check (moderation_status in ('visible', 'hidden', 'removed'));

-- Existing permissive read policies cannot be bypassed with another permissive policy.
-- Restrictive policies are ANDed with them. Hosts/owners may see their moderated records.
drop policy if exists "Moderation visibility for meetups" on public.meetups;
create policy "Moderation visibility for meetups" on public.meetups
  as restrictive for select to authenticated using
  (moderation_status = 'visible' or host_id = (select auth.uid()) or public.is_moderator());

drop policy if exists "Read unlocks of unlocked landmarks" on public.landmark_unlocks;
create policy "Read unlocks of unlocked landmarks" on public.landmark_unlocks
  for select to authenticated using
  (user_id = (select auth.uid()) or public.has_unlocked_landmark(landmark_id) or public.is_moderator());
drop policy if exists "Moderation visibility for landmark photos" on public.landmark_unlocks;
create policy "Moderation visibility for landmark photos" on public.landmark_unlocks
  as restrictive for select to authenticated using
  (moderation_status = 'visible' or user_id = (select auth.uid()) or public.is_moderator());

-- Do not allow Peck/Flap on moderated meetups, including direct Data API requests.
drop policy if exists "No reactions to moderated meetups" on public.meetup_pecks;
create policy "No reactions to moderated meetups" on public.meetup_pecks
  as restrictive for insert to authenticated with check
  (exists (select 1 from public.meetups m where m.id = meetup_id and m.moderation_status = 'visible'));
drop policy if exists "No flaps on moderated meetups" on public.meetup_flaps;
create policy "No flaps on moderated meetups" on public.meetup_flaps
  as restrictive for insert to authenticated with check
  (exists (select 1 from public.meetups m where m.id = meetup_id and m.moderation_status = 'visible'));

-- Existing signed URLs may remain usable until expiry. Limit future URLs in the app.
-- Storage SELECT is checked on issuing signed URLs. Never add public bucket access.
create or replace function public.can_read_landmark_photo(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.landmark_unlocks u
    where u.photo_path = p_path
      and (u.moderation_status = 'visible' or u.user_id = (select auth.uid()) or public.is_moderator())
      and (u.user_id = (select auth.uid()) or public.is_moderator()
           or public.has_unlocked_landmark(u.landmark_id))
  );
$$;
revoke execute on function public.can_read_landmark_photo(text) from public, anon;
grant execute on function public.can_read_landmark_photo(text) to authenticated;
drop policy if exists "Read photos of unlocked landmarks" on storage.objects;
create policy "Read photos of unlocked landmarks" on storage.objects for select to authenticated
  using (bucket_id = 'landmark-photos' and public.can_read_landmark_photo(objects.name));

-- Separate table keeps the existing board report IDs/history untouched.
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('meetup', 'landmark_photo')),
  target_id uuid not null,
  landmark_id text not null default '',
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'personal-info', 'other')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution in ('restored', 'removed', 'dismissed')),
  constraint community_report_target_shape check (
    (target_type = 'meetup' and landmark_id = '')
    or (target_type = 'landmark_photo' and landmark_id ~ '^[a-z0-9-]{2,40}$')
  ),
  unique (target_type, target_id, landmark_id, reporter_id)
);
create index community_reports_open_idx on public.community_reports(resolved_at, created_at);
alter table public.community_reports enable row level security;
revoke all on public.community_reports from public, anon, authenticated;
grant select on public.community_reports to authenticated;
create policy "Read own reports or moderator" on public.community_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_moderator());

-- Moderator decisions are never client-writable.
create table public.moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('post', 'comment', 'meetup', 'landmark_photo')),
  target_id uuid not null,
  landmark_id text not null default '',
  action text not null check (action in ('restore', 'remove', 'dismiss')),
  note text not null default '' check (char_length(note) <= 300),
  decided_at timestamptz not null default now()
);
create index moderation_decisions_time_idx on public.moderation_decisions(decided_at desc);
alter table public.moderation_decisions enable row level security;
revoke all on public.moderation_decisions from public, anon, authenticated;
grant select on public.moderation_decisions to authenticated;
create policy "Moderators read decisions" on public.moderation_decisions for select to authenticated
  using (public.is_moderator());

-- Report a visible item only if the caller can view it. One report per student per target.
-- Lock target rows to serialize the three-distinct-report auto-hide threshold.
create function public.report_community_content(
  p_type text, p_id uuid, p_landmark_id text, p_reason text, p_note text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_owner uuid;
  v_status text;
  v_count integer;
  v_rows integer;
  v_landmark text := coalesce(p_landmark_id, '');
begin
  if v_user is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_type not in ('meetup', 'landmark_photo') or p_id is null then
    raise exception 'invalid report target' using errcode = '22023';
  end if;
  if p_reason not in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'personal-info', 'other')
     or char_length(coalesce(p_note, '')) > 300 then
    raise exception 'invalid report' using errcode = '22023';
  end if;
  if p_type = 'meetup' then
    if v_landmark <> '' then raise exception 'invalid report target' using errcode = '22023'; end if;
    select host_id, moderation_status into v_owner, v_status
    from public.meetups where id = p_id for update;
  else
    if v_landmark !~ '^[a-z0-9-]{2,40}$' or not public.has_unlocked_landmark(v_landmark) then
      raise exception 'landmark not unlocked' using errcode = '42501';
    end if;
    select user_id, moderation_status into v_owner, v_status
    from public.landmark_unlocks where user_id = p_id and landmark_id = v_landmark for update;
  end if;
  if v_owner is null or v_owner = v_user or v_status <> 'visible' then return 'unavailable'; end if;
  if (select count(*) from public.community_reports
      where reporter_id = v_user and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too many reports' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  insert into public.community_reports(target_type,target_id,landmark_id,reporter_id,reason,note)
  values (p_type,p_id,v_landmark,v_user,p_reason,coalesce(p_note,''))
  on conflict (target_type,target_id,landmark_id,reporter_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return 'already'; end if;
  select count(*) into v_count from public.community_reports
  where target_type = p_type and target_id = p_id and landmark_id = v_landmark and resolved_at is null;
  if v_count >= 3 then
    if p_type = 'meetup' then
      update public.meetups set moderation_status = 'hidden' where id = p_id and moderation_status = 'visible';
    else
      update public.landmark_unlocks set moderation_status = 'hidden'
      where user_id = p_id and landmark_id = v_landmark and moderation_status = 'visible';
    end if;
    return 'hidden';
  end if;
  return 'reported';
end;
$$;

-- All three sections use one auditable moderator action. Existing board direct moderator RPC
-- execution is revoked below to prevent bypassing the decision audit.
create function public.moderate_community_content(
  p_type text, p_id uuid, p_landmark_id text, p_action text, p_note text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_mod uuid := (select auth.uid());
  v_landmark text := coalesce(p_landmark_id, '');
  v_count integer;
  v_existing text;
begin
  if v_mod is null or not public.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if p_type not in ('post','comment','meetup','landmark_photo') or p_id is null
     or p_action not in ('restore','remove','dismiss') or char_length(coalesce(p_note,'')) > 300 then
    raise exception 'bad moderation action' using errcode = '22023';
  end if;
  if p_type in ('post','comment') then
    if v_landmark <> '' then raise exception 'bad target' using errcode = '22023'; end if;
    if p_type = 'post' then
      select status into v_existing from public.board_posts where id=p_id for update;
    else
      select status into v_existing from public.board_comments where id=p_id for update;
    end if;
    select count(*) into v_count from public.content_reports
      where target_type=p_type and target_id=p_id and resolved_at is null;
    if v_existing is null or v_count=0 then raise exception 'no open reports' using errcode='P0002'; end if;
    if p_type='post' then
      update public.board_posts set status =
        case when p_action='remove' then 'removed' when p_action='restore' or (p_action='dismiss' and v_existing='hidden') then 'visible' else status end
      where id=p_id;
    else
      update public.board_comments set status =
        case when p_action='remove' then 'removed' when p_action='restore' or (p_action='dismiss' and v_existing='hidden') then 'visible' else status end
      where id=p_id;
    end if;
    update public.content_reports set resolved_at=now(), resolution =
      case when p_action='remove' then 'removed' when p_action='restore' then 'restored' else 'dismissed' end
    where target_type=p_type and target_id=p_id and resolved_at is null;
  else
    if p_type='meetup' then
      if v_landmark <> '' then raise exception 'bad target' using errcode='22023'; end if;
      select moderation_status into v_existing from public.meetups where id=p_id for update;
    else
      if v_landmark !~ '^[a-z0-9-]{2,40}$' then raise exception 'bad target' using errcode='22023'; end if;
      select moderation_status into v_existing from public.landmark_unlocks
      where user_id=p_id and landmark_id=v_landmark for update;
    end if;
    select count(*) into v_count from public.community_reports
      where target_type=p_type and target_id=p_id and landmark_id=v_landmark and resolved_at is null;
    if v_existing is null or v_count=0 then raise exception 'no open reports' using errcode='P0002'; end if;
    if p_type='meetup' then
      update public.meetups set moderation_status =
        case when p_action='remove' then 'removed' when p_action='restore' or (p_action='dismiss' and v_existing='hidden') then 'visible' else moderation_status end
      where id=p_id;
    else
      update public.landmark_unlocks set moderation_status =
        case when p_action='remove' then 'removed' when p_action='restore' or (p_action='dismiss' and v_existing='hidden') then 'visible' else moderation_status end
      where user_id=p_id and landmark_id=v_landmark;
    end if;
    update public.community_reports set resolved_at=now(), resolution =
      case when p_action='remove' then 'removed' when p_action='restore' then 'restored' else 'dismissed' end
    where target_type=p_type and target_id=p_id and landmark_id=v_landmark and resolved_at is null;
  end if;
  insert into public.moderation_decisions(moderator_id,target_type,target_id,landmark_id,action,note)
  values (v_mod,p_type,p_id,v_landmark,p_action,coalesce(p_note,''));
end;
$$;

revoke execute on function public.report_community_content(text,uuid,text,text,text),
  public.moderate_community_content(text,uuid,text,text,text) from public, anon;
grant execute on function public.report_community_content(text,uuid,text,text,text),
  public.moderate_community_content(text,uuid,text,text,text) to authenticated;
-- Prevent moderator actions that bypass the audit: the application now uses moderate_community_content.
revoke execute on function public.moderate_content(text,uuid,text) from authenticated;

-- Prevent the owner from changing a photo while it is under review or removed.
-- These restrictive storage policies run alongside existing owner-write policies.
drop policy if exists "No replacements of moderated landmark photos" on storage.objects;
create policy "No replacements of moderated landmark photos" on storage.objects
  as restrictive for update to authenticated using (
    bucket_id <> 'landmark-photos' or exists (
      select 1 from public.landmark_unlocks u
      where u.photo_path = objects.name and u.moderation_status = 'visible'
    )
  ) with check (
    bucket_id <> 'landmark-photos' or exists (
      select 1 from public.landmark_unlocks u
      where u.photo_path = objects.name and u.moderation_status = 'visible'
    )
  );

-- The guest RPC is SECURITY DEFINER and bypasses meetup RLS; explicitly filter moderated rows.
create or replace function public.guest_meetups(p_id uuid default null)
returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',m.id, 'host_id',m.host_id, 'title',m.title, 'description',m.description,
    'category',m.category, 'categories',m.categories,
    'location_name',case when m.location_type='custom' then 'Off-map spot (sign in for details)' else m.location_name end,
    'latitude',m.latitude, 'longitude',m.longitude, 'starts_at',m.starts_at, 'status',m.status,
    'created_at',m.created_at, 'course_code',m.course_code,
    'host',jsonb_build_object('display_name',coalesce(p.display_name,'Martlet Student')),
    'pecks',jsonb_build_array(jsonb_build_object('count',(select count(*) from public.meetup_pecks k where k.meetup_id=m.id))),
    'flaps',jsonb_build_array(jsonb_build_object('count',(select count(*) from public.meetup_flaps f where f.meetup_id=m.id)))
  )
  from public.meetups m left join public.profiles p on p.id=m.host_id
  where m.moderation_status = 'visible'
    and case when p_id is not null then m.id=p_id else m.status='open' and m.starts_at > now() end
  order by m.starts_at
  limit 100;
$$;
revoke execute on function public.guest_meetups(uuid) from public;
grant execute on function public.guest_meetups(uuid) to anon, authenticated;
commit;
