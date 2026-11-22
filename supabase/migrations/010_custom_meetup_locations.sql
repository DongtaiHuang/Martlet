begin;

-- Catalog meetups retain both foreign keys from 008. A custom location has no map point.
alter table public.meetups
  add column location_type text not null default 'catalog',
  alter column latitude drop not null,
  alter column longitude drop not null,
  drop constraint meetups_location_name_check,
  add constraint meetups_location_shape_check check (
    (
      location_type = 'catalog'
      and latitude is not null and longitude is not null
      and char_length(trim(location_name)) between 3 and 100
    ) or (
      location_type = 'custom'
      and latitude is null and longitude is null and public_venue_id is null
      and char_length(location_name) between 3 and 160
      and location_name !~ '^[[:space:]]|[[:space:]]$'
    )
  );

grant insert (location_type) on public.meetups to authenticated;

commit;
