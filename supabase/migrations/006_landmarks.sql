-- ADR 0009 phase 1: landmarks, photo unlocks, and the private photo bucket.
-- Run after 001-005 in the Supabase SQL Editor. Safe to re-run.
--
-- Rules enforced here (not just in the UI):
--  - Landmarks are curated: users can read them, never write them.
--  - One unlock per user per landmark. Users can create and MODIFY their own unlock
--    (caption; the photo is replaced in Storage) but can NEVER delete it.
--  - A landmark's photos are visible only to people who have unlocked that landmark.
--  - Photos live at landmark-photos/{user_id}/{landmark_id}.jpg; users may only write their
--    own path for a landmark they've unlocked, and there is no delete, so an unlock's photo
--    can't be removed via Storage (replacing it is allowed).
-- Grants are explicit because new Supabase projects don't auto-grant (see 005).

-- Landmarks ---------------------------------------------------------------------

create table if not exists public.landmarks (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null unique check (char_length(name) between 2 and 80),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null check (radius_m between 25 and 2000),
  challenge_prompt text not null check (char_length(challenge_prompt) between 5 and 200),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);
alter table public.landmarks enable row level security;
drop policy if exists "Read landmarks" on public.landmarks;
create policy "Read landmarks" on public.landmarks for select to authenticated using (true);
revoke all on public.landmarks from anon, authenticated;
grant select on public.landmarks to authenticated;

-- Initial landmarks (ADR 0009). Coordinates are approximate and must be checked on the
-- map; radius_m is for the phase-3 check-in. Mirror changes in lib/mock-landmarks.ts.
insert into public.landmarks (id, name, latitude, longitude, radius_m, challenge_prompt, description) values
  ('saint-joseph-oratory', 'Saint Joseph''s Oratory', 45.4922, -73.6175, 250,
   'Take a photo at the top of the Oratory steps with the city behind you.',
   'Montreal''s largest church, on the slope of Mount Royal.'),
  ('old-port', 'Old Port', 45.5072, -73.5531, 800,
   'Take a photo on the waterfront with the Clock Tower or the Ferris wheel behind you.',
   'The historic port along the St. Lawrence in Old Montreal.'),
  ('redpath-museum', 'Redpath Museum', 45.50446675, -73.57738453, 75,
   'Strike your best dinosaur pose in front of the Redpath Museum.',
   'McGill''s natural history museum, one of the oldest museum buildings in Canada.'),
  ('leacock-building', 'Leacock Building', 45.50432553, -73.57786051, 75,
   'Take a group photo at the Leacock Building entrance with your study crew.',
   'Home of many Arts classes on lower campus.'),
  ('rutherford-observatory', 'Rutherford Observatory', 45.50717766, -73.57834928, 75,
   'Take a photo from the street pointing up at the observatory dome on the Rutherford Physics Building.',
   'The rooftop observatory dome on the Rutherford Physics Building.'),
  ('la-banquise', 'La Banquise', 45.5254, -73.5749, 75,
   'Take a photo outside La Banquise. No purchase needed (poutine optional).',
   'The 24-hour poutine institution on Rue Rachel in the Plateau.')
on conflict (id) do update set
  name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude,
  radius_m = excluded.radius_m, challenge_prompt = excluded.challenge_prompt,
  description = excluded.description;

-- Unlocks -----------------------------------------------------------------------

create table if not exists public.landmark_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  landmark_id text not null references public.landmarks(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 200),
  -- Derived, so a client can never point an unlock at someone else's photo.
  photo_path text generated always as (user_id::text || '/' || landmark_id || '.jpg') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, landmark_id)
);
create index if not exists landmark_unlocks_landmark_idx on public.landmark_unlocks (landmark_id, created_at desc);
alter table public.landmark_unlocks enable row level security;

-- updated_at changes on every modification (caption edit or photo replacement), which the
-- UI also uses to cache-bust the photo.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists landmark_unlocks_touch on public.landmark_unlocks;
create trigger landmark_unlocks_touch before update on public.landmark_unlocks
  for each row execute function public.touch_updated_at();

-- security definer avoids RLS recursion when landmark_unlocks policies ask
-- "has the current user unlocked this landmark?".
create or replace function public.has_unlocked_landmark(p_landmark_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.landmark_unlocks
    where landmark_id = p_landmark_id and user_id = (select auth.uid())
  );
$$;
revoke execute on function public.has_unlocked_landmark(text) from public, anon;
grant execute on function public.has_unlocked_landmark(text) to authenticated;

-- Per-landmark counts for locked previews ("12 people unlocked this") without exposing rows.
create or replace function public.landmark_unlock_counts()
returns table (landmark_id text, unlock_count bigint)
language sql stable security definer set search_path = '' as $$
  select landmark_id, count(*) from public.landmark_unlocks group by landmark_id;
$$;
revoke execute on function public.landmark_unlock_counts() from public, anon;
grant execute on function public.landmark_unlock_counts() to authenticated;

drop policy if exists "Read unlocks of unlocked landmarks" on public.landmark_unlocks;
create policy "Read unlocks of unlocked landmarks" on public.landmark_unlocks for select to authenticated
  using (user_id = (select auth.uid()) or public.has_unlocked_landmark(landmark_id));

drop policy if exists "Create own unlock" on public.landmark_unlocks;
create policy "Create own unlock" on public.landmark_unlocks for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Modify own unlock" on public.landmark_unlocks;
create policy "Modify own unlock" on public.landmark_unlocks for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Deliberately no DELETE policy and no DELETE grant: unlocks are permanent (ADR 0009).
revoke all on public.landmark_unlocks from anon, authenticated;
grant select on public.landmark_unlocks to authenticated;
grant insert (user_id, landmark_id, caption) on public.landmark_unlocks to authenticated;
grant update (caption) on public.landmark_unlocks to authenticated;

-- Photo storage -------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landmark-photos', 'landmark-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- "{uuid}/{landmark-id}.jpg" -> "landmark-id", anything else -> null.
create or replace function public.landmark_photo_landmark_id(object_name text) returns text
language sql immutable set search_path = '' as $$
  select substring(object_name from '^[0-9a-f-]{36}/([a-z0-9-]{2,40})\.jpg$');
$$;

drop policy if exists "Upload own landmark photo" on storage.objects;
create policy "Upload own landmark photo" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'landmark-photos'
    and split_part(objects.name, '/', 1) = (select auth.uid())::text
    -- Only for a landmark the user has unlocked: the unlock row is created first, so photos
    -- never exist without an unlock, and a photo can't be moved off its unlock to another landmark.
    and public.has_unlocked_landmark(public.landmark_photo_landmark_id(objects.name))
  );

drop policy if exists "Replace own landmark photo" on storage.objects;
create policy "Replace own landmark photo" on storage.objects for update to authenticated
  using (bucket_id = 'landmark-photos' and split_part(objects.name, '/', 1) = (select auth.uid())::text)
  with check (
    bucket_id = 'landmark-photos'
    and split_part(objects.name, '/', 1) = (select auth.uid())::text
    -- Only for a landmark the user has unlocked: the unlock row is created first, so photos
    -- never exist without an unlock, and a photo can't be moved off its unlock to another landmark.
    and public.has_unlocked_landmark(public.landmark_photo_landmark_id(objects.name))
  );

drop policy if exists "Read photos of unlocked landmarks" on storage.objects;
create policy "Read photos of unlocked landmarks" on storage.objects for select to authenticated
  using (
    bucket_id = 'landmark-photos'
    and (
      split_part(objects.name, '/', 1) = (select auth.uid())::text
      or public.has_unlocked_landmark(public.landmark_photo_landmark_id(objects.name))
    )
  );
-- Deliberately no DELETE policy on landmark-photos.
