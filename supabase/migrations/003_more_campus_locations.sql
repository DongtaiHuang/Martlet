-- Add more McGill downtown meetup places after 002_security_hardening.sql.
-- Coordinates represent building vicinity, not a precise room or live user location.
-- McGill Libraries building histories (digital.library.mcgill.ca/campus/items/)
-- supply the coordinates except McLennan Library and McConnell Engineering,
-- whose map pins use OpenStreetMap-derived Mapcarta coordinates.
-- This insert is idempotent, keeping the approved-location FK synchronized
-- with lib/locations.ts without rewriting historical migrations.

insert into public.campus_locations (id, name, latitude, longitude)
values
  ('leacock-building', 'Leacock Building', 45.50432553, -73.57786051),
  ('burnside-hall', 'Burnside Hall', 45.50463395, -73.57491447),
  ('trottier-building', 'Trottier Building', 45.50738884, -73.57882603),
  ('rutherford-physics', 'Rutherford Physics Building', 45.50717766, -73.57834928),
  ('university-centre', 'SSMU University Centre', 45.50355653, -73.57814397),
  ('otto-maass', 'Otto Maass Chemistry Building', 45.50476374, -73.57420108),
  ('bronfman-building', 'Bronfman Building', 45.50254452, -73.576608),
  ('stewart-biology', 'Stewart Biological Sciences Building', 45.50255891, -73.58087453),
  ('mclennan-library', 'McLennan Library', 45.50327, -73.57593),
  ('mcconnell-engineering', 'McConnell Engineering Building', 45.50598, -73.5761)
on conflict (id) do update set
  name = excluded.name,
  latitude = excluded.latitude,
  longitude = excluded.longitude;
