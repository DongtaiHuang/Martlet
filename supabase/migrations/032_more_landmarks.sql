-- More landmarks (ADR 0049): four on campus and eight around Montréal, and a way to hide a
-- landmark without deleting anyone's unlock. Coordinates from OpenStreetMap. Run after 006, 012
-- and 015. Safe to re-run.
begin;

-- Hidden landmarks leave maps and lists, and take no new unlocks. Existing unlocks and their
-- photos stay (unlocks are permanent, ADR 0009).
alter table public.landmarks add column if not exists hidden boolean not null default false;

drop policy if exists "Create own unlock" on public.landmark_unlocks;
create policy "Create own unlock" on public.landmark_unlocks for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.landmarks l where l.id = landmark_id and not l.hidden)
  );

-- The same place twice: keep "Expo 67 Biosphère" (its "67" achievement depends on it).
update public.landmarks set hidden = true where id = 'montreal-biosphere';

insert into public.landmarks (id, name, latitude, longitude, radius_m, challenge_prompt, description) values
  -- McGill
  ('roddick-gates', 'Roddick Gates', 45.503889, -73.574885, 60,
   'Take a photo walking through the Roddick Gates, campus behind you.',
   'McGill''s main entrance on Sherbrooke Street, given in 1925 in memory of Sir Thomas Roddick.'),
  ('arts-building', 'Arts Building', 45.505233, -73.577635, 75,
   'Take a photo on the Arts Building steps with the cupola above you.',
   'McGill''s oldest building, begun in 1839. James McGill''s remains rest in front of it.'),
  ('three-bares', 'The Three Bares', 45.504729, -73.577008, 50,
   'Recreate the Three Bares pose by the fountain (fully clothed, please).',
   'Gertrude Vanderbilt Whitney''s 1914 fountain on lower campus, officially "The Friendly Gathering".'),
  ('mclennan-library', 'McLennan Library', 45.503288, -73.575968, 75,
   'Take a photo outside McLennan with your exam-season study stack.',
   'The humanities and social sciences library, joined to Redpath Library: the study heart of campus.'),
  -- Montréal
  ('mount-royal-cross', 'Mount Royal Cross', 45.508839, -73.587902, 100,
   'Take a photo with the Mount Royal Cross behind you.',
   'The lit cross on the summit, put up in 1924 and visible from all over campus.'),
  ('beaver-lake', 'Beaver Lake', 45.4987, -73.597424, 150,
   'Take a photo by Beaver Lake: skates in winter, a picnic in summer.',
   'Lac aux Castors, the pond on Mount Royal built in 1938 where the city skates every winter.'),
  ('chinatown-gates', 'Chinatown gates', 45.507525, -73.56046, 250,
   'Take a photo under one of Chinatown''s four paifang gates.',
   'Montréal''s Chinatown, framed by four traditional gates around De la Gauchetière Street.'),
  ('habitat-67', 'Habitat 67', 45.498957, -73.54352, 200,
   'Take a photo with Habitat 67''s stacked boxes behind you, from the public path.',
   'Moshe Safdie''s housing complex, built for Expo 67 from his McGill architecture thesis.'),
  ('mile-end-bagels', 'Mile End bagels', 45.5228, -73.5986, 300,
   'Take a photo with a bag of fresh bagels outside St-Viateur or Fairmount. No purchase needed.',
   'The two wood-fired bagel shops that settled the Montréal bagel debate (or started it).'),
  ('place-des-arts', 'Place des Arts', 45.508469, -73.566518, 120,
   'Take a photo on the Place des Arts esplanade, festival or not.',
   'The performing arts centre at the heart of the Quartier des Spectacles: Jazz Fest, Francos and more.'),
  ('botanical-garden', 'Botanical Garden', 45.555574, -73.554583, 300,
   'Take a photo at the Botanical Garden gates or by the Chinese Garden.',
   'Jardin botanique de Montréal, one of the world''s largest botanical gardens, next to Olympic Park.'),
  ('lachine-canal', 'Lachine Canal', 45.4934, -73.553691, 250,
   'Take a photo on the canal path by the Peel Basin, bike or no bike.',
   'The 1825 canal that built industrial Montréal, now a 14 km cycling and walking path.')
on conflict (id) do nothing;

commit;
