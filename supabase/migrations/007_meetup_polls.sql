begin;

create table public.meetup_polls (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null unique references public.meetups(id) on delete cascade,
  type text not null check (type in ('time', 'location', 'activity')),
  question text not null check (question = btrim(question) and char_length(question) between 5 and 120),
  closes_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (isfinite(closes_at) and closes_at > created_at)
);

create table public.meetup_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.meetup_polls(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  position integer not null check (position between 1 and 5),
  proposed_at timestamptz check (isfinite(proposed_at)),
  location_id text references public.campus_locations(id),
  check (proposed_at is null or location_id is null),
  unique (poll_id, position),
  unique (poll_id, id),
  unique (poll_id, proposed_at),
  unique (poll_id, location_id)
);

create unique index meetup_poll_activity_label_idx
  on public.meetup_poll_options (poll_id, lower(label))
  where proposed_at is null and location_id is null;

create table public.meetup_poll_votes (
  poll_id uuid not null,
  option_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  foreign key (poll_id, option_id) references public.meetup_poll_options(poll_id, id) on delete cascade
);
create index meetup_poll_votes_option_idx on public.meetup_poll_votes (poll_id, option_id);
create index meetup_poll_votes_user_idx on public.meetup_poll_votes (user_id);
create index meetup_poll_options_location_idx on public.meetup_poll_options (location_id);

alter table public.meetup_polls enable row level security;
alter table public.meetup_poll_options enable row level security;
alter table public.meetup_poll_votes enable row level security;
revoke all on public.meetup_polls, public.meetup_poll_options, public.meetup_poll_votes from public, anon, authenticated;
grant select on public.meetup_polls, public.meetup_poll_options to authenticated;

create policy "Read polls for visible meetups" on public.meetup_polls for select to authenticated
  using (exists (select 1 from public.meetups m where m.id = meetup_id));
create policy "Read options for visible polls" on public.meetup_poll_options for select to authenticated
  using (exists (select 1 from public.meetup_polls p where p.id = poll_id));

create function public.create_meetup_poll(
  p_meetup_id uuid, p_type text, p_question text, p_closes_at timestamptz, p_options text[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  meetup public.meetups%rowtype;
  poll_id uuid;
  clean_question text := regexp_replace(p_question, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  choice text;
  choice_label text;
  proposed timestamptz;
  campus_id text;
  ord integer := 0;
  checked_at timestamptz;
begin
  if viewer is null then raise exception 'Sign in to create a poll.' using errcode = '42501'; end if;
  select * into meetup from public.meetups where id = p_meetup_id for update;
  if not found then raise exception 'Meetup not found.' using errcode = 'P0002'; end if;
  if meetup.host_id <> viewer then raise exception 'Only the meetup host can create a poll.' using errcode = '42501'; end if;
  checked_at := clock_timestamp();
  if meetup.status <> 'open' or meetup.starts_at <= checked_at then
    raise exception 'Polls can only be created on upcoming open meetups.' using errcode = '22023';
  end if;
  if p_type is null or p_type not in ('time','location','activity')
    or coalesce(char_length(clean_question), 0) not between 5 and 120
    or coalesce(cardinality(p_options), 0) not between 2 and 5
    or p_closes_at is null or not isfinite(p_closes_at)
    or p_closes_at <= checked_at or p_closes_at > meetup.starts_at then
    raise exception 'Check the question, choices, and closing time.' using errcode = '22023';
  end if;
  if exists (select 1 from public.meetup_polls p where p.meetup_id = meetup.id) then
    raise exception 'This meetup already has a poll.' using errcode = '23505';
  end if;

  insert into public.meetup_polls (meetup_id, type, question, closes_at)
  values (meetup.id, p_type, clean_question, p_closes_at) returning id into poll_id;

  foreach choice in array p_options loop
    ord := ord + 1;
    proposed := null;
    campus_id := null;
    choice := regexp_replace(choice, '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if choice is null or char_length(choice) not between 1 and 80 then
      raise exception 'Enter a valid poll option.' using errcode = '22023';
    end if;
    choice_label := choice;
    if p_type = 'time' then
      if choice !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$' then
        raise exception 'Time choices must be UTC timestamps.' using errcode = '22023';
      end if;
      proposed := choice::timestamptz;
      if proposed <= checked_at then raise exception 'Time choices must be in the future.' using errcode = '22023'; end if;
      choice_label := to_char(proposed at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    elsif p_type = 'location' then
      select c.id, c.name into campus_id, choice_label from public.campus_locations c where c.id = choice;
      if not found then raise exception 'Choose an approved campus location.' using errcode = '22023'; end if;
    end if;
    insert into public.meetup_poll_options (poll_id, label, position, proposed_at, location_id)
    values (poll_id, choice_label, ord, proposed, campus_id);
  end loop;
  return poll_id;
end;
$$;

-- Acquire meetup first, then poll. This serializes mutations with cancellation and each other.
create function public.cast_meetup_poll_vote(p_poll_id uuid, p_option_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  meetup public.meetups%rowtype;
  poll public.meetup_polls%rowtype;
  checked_at timestamptz;
begin
  if viewer is null then raise exception 'Sign in to vote.' using errcode = '42501'; end if;
  select m.* into meetup from public.meetups m
    join public.meetup_polls p on p.meetup_id = m.id where p.id = p_poll_id for update of m;
  if not found then raise exception 'Poll not found.' using errcode = 'P0002'; end if;
  select * into strict poll from public.meetup_polls where id = p_poll_id for update;
  checked_at := clock_timestamp();
  if meetup.status <> 'open' or meetup.starts_at <= checked_at or poll.closed_at is not null or poll.closes_at <= checked_at then
    raise exception 'This poll is closed.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.meetup_poll_options o where o.poll_id = poll.id and o.id = p_option_id) then
    raise exception 'Choose an option from this poll.' using errcode = '22023';
  end if;
  insert into public.meetup_poll_votes (poll_id, option_id, user_id)
    values (poll.id, p_option_id, viewer)
    on conflict (poll_id, user_id) do update
      set option_id = excluded.option_id, updated_at = checked_at
      where meetup_poll_votes.option_id <> excluded.option_id;
  return meetup.id;
end;
$$;

create function public.close_meetup_poll(p_poll_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  meetup public.meetups%rowtype;
  checked_at timestamptz;
begin
  if viewer is null then raise exception 'Sign in to close a poll.' using errcode = '42501'; end if;
  select m.* into meetup from public.meetups m
    join public.meetup_polls p on p.meetup_id = m.id where p.id = p_poll_id for update of m;
  if not found then raise exception 'Poll not found.' using errcode = 'P0002'; end if;
  if meetup.host_id <> viewer then raise exception 'Only the meetup host can close this poll.' using errcode = '42501'; end if;
  checked_at := clock_timestamp();
  update public.meetup_polls set closed_at = checked_at
    where id = p_poll_id and closed_at is null and closes_at > checked_at
      and meetup.status = 'open' and meetup.starts_at > checked_at;
  return meetup.id;
end;
$$;

create function public.get_meetup_poll_results(p_meetup_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  viewer uuid := auth.uid();
  result jsonb;
begin
  if viewer is null then raise exception 'Sign in to view poll results.' using errcode = '42501'; end if;

  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'question', p.question, 'closesAt', p.closes_at,
    'isOpen', m.status = 'open' and m.starts_at > statement_timestamp()
      and p.closed_at is null and p.closes_at > statement_timestamp(),
    'isHost', m.host_id = viewer,
    'selectedOptionId', (select v.option_id from public.meetup_poll_votes v where v.poll_id = p.id and v.user_id = viewer),
    'options', (select jsonb_agg(jsonb_build_object(
      'id', o.id, 'label', o.label, 'proposedAt', o.proposed_at, 'votes',
      (select count(*) from public.meetup_poll_votes v where v.poll_id = p.id and v.option_id = o.id)
    ) order by o.position) from public.meetup_poll_options o where o.poll_id = p.id)
  ) into result
  from public.meetup_polls p join public.meetups m on m.id = p.meetup_id
  where p.meetup_id = p_meetup_id;
  return result;
end;
$$;

revoke all on function public.create_meetup_poll(uuid, text, text, timestamptz, text[]),
  public.cast_meetup_poll_vote(uuid, uuid), public.close_meetup_poll(uuid),
  public.get_meetup_poll_results(uuid) from public, anon, authenticated;
grant execute on function public.create_meetup_poll(uuid, text, text, timestamptz, text[]),
  public.cast_meetup_poll_vote(uuid, uuid), public.close_meetup_poll(uuid),
  public.get_meetup_poll_results(uuid) to authenticated;

commit;
