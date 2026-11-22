-- Community board + moderation (ADR 0027; issues #45, #44, #48).
-- Post kinds: meme, tip, question (Q&A, with an accepted answer) and skill (skillshare or
-- freelance offer: a listing only, no payments, no buying or selling items).
-- Moderation: anyone signed in can report; 3 distinct reports auto-hide the content until a
-- moderator restores or removes it. Moderators are set by hand: profiles.is_moderator.
-- Writes go through SECURITY DEFINER functions (rate limits, session user ids); reads use RLS.
begin;

-- Moderator role ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_moderator boolean not null default false;
-- Users can't grant themselves the role: only display_name is updatable (migration 005).

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_moderator from public.profiles where id = (select auth.uid())), false);
$$;
revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- Content ----------------------------------------------------------------------------------
create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('meme', 'tip', 'question', 'skill')),
  title text not null check (title = btrim(title) and char_length(title) between 3 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  link text not null default '' check (link = '' or (link ~ '^https://[^\s]+$' and char_length(link) <= 300)),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  has_image boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  accepted_comment_id uuid,
  created_at timestamptz not null default now()
);
create index board_posts_feed_idx on public.board_posts (status, created_at desc);
create index board_posts_author_idx on public.board_posts (author_id, created_at desc);

create table public.board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.board_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (body = btrim(body) and char_length(body) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);
create index board_comments_post_idx on public.board_comments (post_id, created_at);
create index board_comments_author_idx on public.board_comments (author_id, created_at desc);
alter table public.board_posts add constraint board_posts_accepted_fk
  foreign key (accepted_comment_id) references public.board_comments(id) on delete set null;

create table public.board_votes (
  post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'personal-info', 'other')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution in ('restored', 'removed', 'dismissed')),
  unique (target_type, target_id, reporter_id)
);
create index content_reports_open_idx on public.content_reports (resolved_at, created_at);

alter table public.board_posts enable row level security;
alter table public.board_comments enable row level security;
alter table public.board_votes enable row level security;
alter table public.content_reports enable row level security;
revoke all on public.board_posts, public.board_comments, public.board_votes, public.content_reports from public, anon, authenticated;
grant select on public.board_posts, public.board_comments, public.board_votes to authenticated;
grant select on public.content_reports to authenticated;

-- Visible content for everyone signed in; your own (even hidden) for you; everything for moderators.
create policy "Read board posts" on public.board_posts for select to authenticated
  using (status = 'visible' or author_id = (select auth.uid()) or public.is_moderator());
create policy "Read board comments" on public.board_comments for select to authenticated
  using (status = 'visible' or author_id = (select auth.uid()) or public.is_moderator());
create policy "Read board votes" on public.board_votes for select to authenticated using (true);
create policy "Moderators read reports" on public.content_reports for select to authenticated
  using (public.is_moderator() or reporter_id = (select auth.uid()));

-- Writes -----------------------------------------------------------------------------------
create or replace function public.board_require_user() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'sign in required' using errcode = '42501'; end if;
  return (select auth.uid());
end $$;

-- Rate limit: 5 posts per hour per student.
create or replace function public.create_board_post(p_kind text, p_title text, p_body text, p_link text, p_tags text[], p_has_image boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_id uuid;
begin
  if (select count(*) from public.board_posts where author_id = v_user and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'posting too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  insert into public.board_posts (author_id, kind, title, body, link, tags, has_image)
  values (v_user, p_kind, btrim(p_title), coalesce(p_body, ''), coalesce(p_link, ''), coalesce(p_tags, '{}'), coalesce(p_has_image, false))
  returning id into v_id;
  return v_id;
end $$;

-- Rate limit: 30 comments per hour per student. Only on visible posts.
create or replace function public.create_board_comment(p_post uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_id uuid;
begin
  if not exists (select 1 from public.board_posts where id = p_post and status = 'visible') then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.board_comments where author_id = v_user and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'commenting too fast' using errcode = 'P0001', hint = 'rate-limit';
  end if;
  insert into public.board_comments (post_id, author_id, body) values (p_post, v_user, btrim(p_body)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_board_vote(p_post uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  if p_on then
    if not exists (select 1 from public.board_posts where id = p_post and status = 'visible') then return; end if;
    insert into public.board_votes (post_id, user_id) values (p_post, v_user) on conflict do nothing;
  else
    delete from public.board_votes where post_id = p_post and user_id = v_user;
  end if;
end $$;

-- The question's author picks (or clears) the accepted answer.
create or replace function public.accept_board_answer(p_post uuid, p_comment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  update public.board_posts set accepted_comment_id = p_comment
  where id = p_post and author_id = v_user and kind = 'question'
    and (p_comment is null or exists (select 1 from public.board_comments c where c.id = p_comment and c.post_id = p_post and c.status = 'visible'));
end $$;

-- Authors can remove their own post or comment.
create or replace function public.remove_my_board_content(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user();
begin
  if p_type = 'post' then update public.board_posts set status = 'removed' where id = p_id and author_id = v_user;
  elsif p_type = 'comment' then update public.board_comments set status = 'removed' where id = p_id and author_id = v_user;
  end if;
end $$;

-- Report: one per person per item; 3 distinct open reports auto-hide it. Returns 'reported',
-- 'hidden' (this report hid it) or 'already'.
create or replace function public.report_content(p_type text, p_id uuid, p_reason text, p_note text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.board_require_user(); v_open integer;
begin
  if p_type = 'post' and not exists (select 1 from public.board_posts where id = p_id and author_id <> v_user and status = 'visible') then return 'already'; end if;
  if p_type = 'comment' and not exists (select 1 from public.board_comments where id = p_id and author_id <> v_user and status = 'visible') then return 'already'; end if;
  insert into public.content_reports (target_type, target_id, reporter_id, reason, note)
  values (p_type, p_id, v_user, p_reason, left(coalesce(p_note, ''), 300))
  on conflict (target_type, target_id, reporter_id) do nothing;
  if not found then return 'already'; end if;
  select count(*) into v_open from public.content_reports where target_type = p_type and target_id = p_id and resolved_at is null;
  if v_open >= 3 then
    if p_type = 'post' then update public.board_posts set status = 'hidden' where id = p_id and status = 'visible';
    else update public.board_comments set status = 'hidden' where id = p_id and status = 'visible'; end if;
    return 'hidden';
  end if;
  return 'reported';
end $$;

-- Moderator decision: restore (visible), remove, or dismiss the reports. Resolves open reports.
create or replace function public.moderate_content(p_type text, p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_status text := case p_action when 'restore' then 'visible' when 'remove' then 'removed' else null end;
begin
  if not public.is_moderator() then raise exception 'moderators only' using errcode = '42501'; end if;
  if p_action not in ('restore', 'remove', 'dismiss') then raise exception 'bad action'; end if;
  if v_status is not null then
    if p_type = 'post' then update public.board_posts set status = v_status where id = p_id;
    else update public.board_comments set status = v_status where id = p_id; end if;
  end if;
  update public.content_reports
  set resolved_at = now(), resolution = case p_action when 'restore' then 'restored' when 'remove' then 'removed' else 'dismissed' end
  where target_type = p_type and target_id = p_id and resolved_at is null;
end $$;

revoke execute on function public.board_require_user(), public.create_board_post(text, text, text, text, text[], boolean),
  public.create_board_comment(uuid, text), public.set_board_vote(uuid, boolean), public.accept_board_answer(uuid, uuid),
  public.remove_my_board_content(text, uuid), public.report_content(text, uuid, text, text), public.moderate_content(text, uuid, text)
  from public, anon;
grant execute on function public.create_board_post(text, text, text, text, text[], boolean),
  public.create_board_comment(uuid, text), public.set_board_vote(uuid, boolean), public.accept_board_answer(uuid, uuid),
  public.remove_my_board_content(text, uuid), public.report_content(text, uuid, text, text), public.moderate_content(text, uuid, text)
  to authenticated;
grant execute on function public.board_require_user() to authenticated;

-- Images (memes) ---------------------------------------------------------------------------
-- Private bucket; "{uid}/{post-id}.jpg". Upload only for your own post; read while the post is
-- readable to you (RLS on board_posts applies inside the EXISTS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('board-images', 'board-images', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.board_image_post_id(object_name text) returns uuid
language sql immutable set search_path = '' as $$
  select nullif(substring(object_name from '^[0-9a-f-]{36}/([0-9a-f-]{36})\.jpg$'), '')::uuid;
$$;

drop policy if exists "Upload own board image" on storage.objects;
create policy "Upload own board image" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'board-images'
    and split_part(objects.name, '/', 1) = (select auth.uid())::text
    and exists (select 1 from public.board_posts p where p.id = public.board_image_post_id(objects.name) and p.author_id = (select auth.uid()))
  );
drop policy if exists "Read board images" on storage.objects;
create policy "Read board images" on storage.objects for select to authenticated
  using (
    bucket_id = 'board-images'
    and exists (select 1 from public.board_posts p where p.id = public.board_image_post_id(objects.name))
  );

commit;
