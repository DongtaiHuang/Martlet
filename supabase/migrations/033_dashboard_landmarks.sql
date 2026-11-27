-- Landmarks that were added in the Supabase dashboard (ADR 0049 follow-up), copied here so a
-- fresh database matches production. Inserts only missing rows, so on production it changes
-- nothing. Run after 032. Safe to re-run.
begin;

insert into public.landmarks (id, name, latitude, longitude, radius_m, challenge_prompt, description, hidden) values
  ('atwater-market', 'Atwater Market', 45.4789, -73.5767, 120,
   'From the canal-side walkway, take a photo with the market’s clock tower visible behind you.',
   'An Art Deco public market beside the Lachine Canal.', false),
  ('jean-talon-market', 'Jean-Talon Market', 45.53597, -73.61522, 120,
   'Take a photo by the market entrance and give a thumbs-up to your favourite seasonal produce.',
   'A public market in Little Italy known for its produce stands and food vendors.', false),
  ('kondiaronk-belvedere', 'Kondiaronk Belvedere', 45.50345, -73.58704, 120,
   'Frame the downtown skyline behind you from the Mount Royal lookout.',
   'A public Mount Royal lookout next to the chalet, overlooking downtown Montréal.', false),
  ('montreal-biosphere', 'Montréal Biosphère', 45.514092, -73.531389, 120,
   'Make a circle with your arms from a public path with the Biosphère dome in the frame.',
   'A Parc Jean-Drapeau environment museum inside the former United States pavilion from Expo 67.', true),
  ('montreal-museum-fine-arts', 'Montréal Museum of Fine Arts', 45.4987, -73.5801, 100,
   'Recreate a sculpture pose on the public sidewalk with a museum façade behind you.',
   'An art museum whose pavilions line Sherbrooke Street in downtown Montréal.', false),
  ('notre-dame-basilica', 'Notre-Dame Basilica', 45.5046, -73.5561, 100,
   'From Place d’Armes, take a photo with the basilica’s twin towers in the frame.',
   'A Gothic Revival basilica facing Place d’Armes in Old Montréal.', false),
  ('olympic-stadium', 'Olympic Stadium', 45.558, -73.552, 250,
   'Strike a victory pose on the Olympic Park esplanade with the stadium behind you.',
   'The landmark stadium built for Montréal’s 1976 Summer Olympics.', false)
on conflict (id) do nothing;

commit;
