-- More landmarks (migration 032). Run on a disposable migrated database. Fixtures roll back.
begin;

insert into auth.users (id) values ('9b000000-0000-4000-8000-000000000001'), ('9b000000-0000-4000-8000-000000000002');

-- A fixture landmark stands in for the live-only "Montréal Biosphère" duplicate. S2 unlocked it
-- before it was hidden.
insert into public.landmarks (id, name, latitude, longitude, radius_m, challenge_prompt)
values ('test-duplicate', 'Test duplicate', 45.5, -73.5, 100, 'Take a test photo.');
set local role authenticated;
select set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000002', true);
insert into public.landmark_unlocks (user_id, landmark_id, caption) values (auth.uid(), 'test-duplicate', 'Before');
reset role;
update public.landmarks set hidden = true where id = 'test-duplicate';

set local role authenticated;
select set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000001', true);
do $$ begin
  -- The twelve new landmarks are there.
  if (select count(*) from public.landmarks where id in (
    'roddick-gates', 'arts-building', 'three-bares', 'mclennan-library', 'mount-royal-cross', 'beaver-lake',
    'chinatown-gates', 'habitat-67', 'mile-end-bagels', 'place-des-arts', 'botanical-garden', 'lachine-canal'
  ) and not hidden) <> 12 then raise exception 'Expected 12 new visible landmarks'; end if;
  -- Expo 67 stays visible (the "67" achievement depends on it).
  if (select hidden from public.landmarks where id = 'expo-67') then raise exception 'Expo 67 hidden'; end if;
  -- New landmarks take unlocks; a hidden one doesn't.
  insert into public.landmark_unlocks (user_id, landmark_id, caption) values (auth.uid(), 'three-bares', 'Fully clothed');
  begin
    insert into public.landmark_unlocks (user_id, landmark_id, caption) values (auth.uid(), 'test-duplicate', 'Too late');
    raise exception 'Unlocked a hidden landmark';
  exception when insufficient_privilege then null; end;
end $$;

-- An unlock made before hiding survives and can still be edited by its owner.
select set_config('request.jwt.claim.sub', '9b000000-0000-4000-8000-000000000002', true);
do $$ begin
  update public.landmark_unlocks set caption = 'Still mine' where user_id = auth.uid() and landmark_id = 'test-duplicate';
  if (select caption from public.landmark_unlocks where user_id = auth.uid() and landmark_id = 'test-duplicate') <> 'Still mine' then
    raise exception 'Existing unlock on a hidden landmark was lost or locked';
  end if;
end $$;

rollback;
