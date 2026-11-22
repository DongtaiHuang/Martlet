-- Public meetup venues alongside approved campus locations.
begin;

create table public.public_meetup_venues (
  id text primary key,
  name text not null,
  address text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  unique (id, name, latitude, longitude)
);

alter table public.public_meetup_venues enable row level security;
revoke all on public.public_meetup_venues from public, anon, authenticated;
grant select on public.public_meetup_venues to authenticated;
create policy "Read public meetup venues" on public.public_meetup_venues
  for select to authenticated using (true);

insert into public.public_meetup_venues (id, name, address, latitude, longitude) values
  ('atwater-market', 'Atwater Market', '138 avenue Atwater, Montréal', 45.4789, -73.5767),
  ('jean-talon-market', 'Jean-Talon Market', '7070 avenue Henri-Julien, Montréal', 45.53597, -73.61522),
  ('montreal-biosphere', 'Montréal Biosphère', '160 chemin du Tour-de-l’Isle, Montréal', 45.514092, -73.531389);

-- A null venue ID identifies a campus meetup. The existing location fields are
-- NOT NULL. MATCH SIMPLE skips only the foreign key for the unused location type.
alter table public.meetups
  add column public_venue_id text,
  add column campus_location_name text generated always as (
    case when public_venue_id is null then location_name end
  ) stored,
  add column campus_latitude double precision generated always as (
    case when public_venue_id is null then latitude end
  ) stored,
  add column campus_longitude double precision generated always as (
    case when public_venue_id is null then longitude end
  ) stored,
  drop constraint meetups_campus_location_fkey,
  add constraint meetups_campus_location_fkey
    foreign key (campus_location_name, campus_latitude, campus_longitude)
    references public.campus_locations (name, latitude, longitude),
  add constraint meetups_public_venue_fkey
    foreign key (public_venue_id, location_name, latitude, longitude)
    references public.public_meetup_venues (id, name, latitude, longitude);

grant insert (public_venue_id) on public.meetups to authenticated;
commit;
