-- Run after 006_landmarks.sql and 010_achievements.sql. Safe to re-run.
begin;

insert into public.landmarks (id, name, latitude, longitude, radius_m, challenge_prompt, description)
values (
  'expo-67', 'Expo 67 Biosphère', 45.514092, -73.531389, 100,
  'Take a photo doing the 67 hand gesture with the Biosphère dome behind you.',
  'The geodesic dome at Parc Jean-Drapeau was the United States pavilion at Expo 67.'
)
on conflict (id) do update set
  name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude,
  radius_m = excluded.radius_m, challenge_prompt = excluded.challenge_prompt,
  description = excluded.description;

-- Keep the existing owner-only policy and add a photo requirement for this badge.
drop policy if exists "Require Expo 67 photo for badge" on public.user_achievements;
create policy "Require Expo 67 photo for badge" on public.user_achievements
  as restrictive for insert to authenticated
  with check (
    achievement_id <> 'expo-67'
    or exists (
      select 1 from storage.objects
      where bucket_id = 'landmark-photos'
        and name = (select auth.uid())::text || '/expo-67.jpg'
    )
  );

commit;
