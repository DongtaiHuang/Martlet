-- McGill Martlet minimal schema + RLS.
-- Run once in Supabase SQL Editor on a fresh project.
-- Development only until full testing and moderation controls are added.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Martlet Student'
    check (char_length(display_name) between 2 and 30),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  category text not null check (category in ('coffee','study','food','sports','gaming','other')),
  location_name text not null check (char_length(trim(location_name)) between 3 and 100),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  starts_at timestamptz not null,
  status text not null default 'open' check (status in ('open','cancelled')),
  created_at timestamptz not null default now()
);
create table public.meetup_pecks (
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id,user_id)
);
create table public.meetup_flaps (
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id,user_id)
);

create index meetups_upcoming_idx on public.meetups (starts_at) where status='open';
create index meetup_pecks_user_idx on public.meetup_pecks(user_id);
create index meetup_flaps_user_idx on public.meetup_flaps(user_id);

alter table public.profiles enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_pecks enable row level security;
alter table public.meetup_flaps enable row level security;

create policy "Read profiles" on public.profiles for select to authenticated using (true);
create policy "Edit own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Read meetups" on public.meetups for select to authenticated using (true);
create policy "Create own meetups" on public.meetups for insert to authenticated
  with check (host_id = (select auth.uid()) and status='open' and starts_at > now());
create policy "Update own meetups" on public.meetups for update to authenticated
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));

create policy "Read pecks" on public.meetup_pecks for select to authenticated using (true);
create policy "Join active meetups" on public.meetup_pecks for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.meetups m where m.id=meetup_id and m.status='open'
      and m.starts_at > now() and m.host_id<>(select auth.uid())
  ));
create policy "Leave own pecks" on public.meetup_pecks for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Read flaps" on public.meetup_flaps for select to authenticated using (true);
create policy "Flap active meetups" on public.meetup_flaps for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.meetups m where m.id=meetup_id and m.status='open'
      and m.starts_at > now()
  ));
create policy "Remove own flaps" on public.meetup_flaps for delete to authenticated
  using (user_id = (select auth.uid()));
