-- Disposable-database RLS regression tests for migration 018. All changes rolled back.
begin;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected SQLSTATE %, but statement succeeded', expected;
exception when others then
  if sqlstate <> expected then raise; end if;
end $$;

insert into auth.users(id) values
 ('18000000-0000-4000-8000-000000000001'),
 ('18000000-0000-4000-8000-000000000002'),
 ('18000000-0000-4000-8000-000000000003'),
 ('18000000-0000-4000-8000-000000000004'),
 ('18000000-0000-4000-8000-000000000005');
update public.profiles set is_moderator = true where id='18000000-0000-4000-8000-000000000005';
insert into public.meetups(id,host_id,title,category,categories,location_type,location_name,latitude,longitude,starts_at)
values ('18000000-0000-4000-8000-000000000011','18000000-0000-4000-8000-000000000001',
 'Moderation test meetup','coffee',array['coffee'],'custom','Public cafe',null,null,now()+interval '2 hours');

set local role authenticated;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000001',true);
insert into public.landmark_unlocks(user_id,landmark_id) values (auth.uid(),'redpath-museum');
do $$ begin
 if public.report_community_content('meetup','18000000-0000-4000-8000-000000000011','','spam','') <> 'unavailable' then
 raise exception 'Owner was allowed to self-report'; end if;
end $$;

select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error(
 $q$select public.moderate_community_content('meetup','18000000-0000-4000-8000-000000000011','','remove','')$q$,'42501');
select pg_temp.expect_error(
 $q$update public.meetups set moderation_status='removed' where id='18000000-0000-4000-8000-000000000011'$q$,'42501');
do $$ begin
 if public.report_community_content('meetup','18000000-0000-4000-8000-000000000011','','spam','first') <> 'reported' then raise exception 'First report failed'; end if;
 if public.report_community_content('meetup','18000000-0000-4000-8000-000000000011','','spam','duplicate') <> 'already' then raise exception 'Duplicate accepted'; end if;
end $$;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000003',true);
do $$ begin
 if public.report_community_content('meetup','18000000-0000-4000-8000-000000000011','','harassment','') <> 'reported' then raise exception 'Second report failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000004',true);
do $$ begin
 if public.report_community_content('meetup','18000000-0000-4000-8000-000000000011','','other','') <> 'hidden' then raise exception 'Three reports did not auto-hide'; end if;
 if exists (select 1 from public.meetups where id='18000000-0000-4000-8000-000000000011') then raise exception 'Hidden meetup visible to other member'; end if;
 if exists (select 1 from public.guest_meetups('18000000-0000-4000-8000-000000000011')) then raise exception 'Guest can read hidden meetup'; end if;
end $$;

select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000001',true);
do $$ begin
 if not exists (select 1 from public.meetups where id='18000000-0000-4000-8000-000000000011') then raise exception 'Owner cannot see moderated meetup'; end if;
end $$;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000005',true);
select public.moderate_community_content('meetup','18000000-0000-4000-8000-000000000011','','restore','Test approval');
do $$ begin
 if not exists (select 1 from public.meetups where id='18000000-0000-4000-8000-000000000011' and moderation_status='visible') then raise exception 'Restore failed'; end if;
 if not exists (select 1 from public.moderation_decisions where target_type='meetup' and action='restore') then raise exception 'Audit missing'; end if;
 if exists (select 1 from public.community_reports where target_type='meetup' and resolved_at is null) then raise exception 'Reports not resolved'; end if;
end $$;

-- Landmark-photo privacy: only students who unlocked that landmark may report.
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error(
 $q$select public.report_community_content('landmark_photo','18000000-0000-4000-8000-000000000001','redpath-museum','spam','')$q$,'42501');
insert into public.landmark_unlocks(user_id,landmark_id) values (auth.uid(),'redpath-museum');
select public.report_community_content('landmark_photo','18000000-0000-4000-8000-000000000001','redpath-museum','spam','');
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000003',true);
insert into public.landmark_unlocks(user_id,landmark_id) values (auth.uid(),'redpath-museum');
select public.report_community_content('landmark_photo','18000000-0000-4000-8000-000000000001','redpath-museum','harassment','');
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000004',true);
insert into public.landmark_unlocks(user_id,landmark_id) values (auth.uid(),'redpath-museum');
do $$ begin
 if public.report_community_content('landmark_photo','18000000-0000-4000-8000-000000000001','redpath-museum','other','') <> 'hidden' then raise exception 'Three photo reports did not hide'; end if;
 if exists (select 1 from public.landmark_unlocks where user_id='18000000-0000-4000-8000-000000000001' and landmark_id='redpath-museum') then raise exception 'Hidden photo metadata visible'; end if;
 if public.can_read_landmark_photo('18000000-0000-4000-8000-000000000001/redpath-museum.jpg') then raise exception 'Hidden photo can be signed'; end if;
end $$;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000005',true);
select public.moderate_community_content('landmark_photo','18000000-0000-4000-8000-000000000001','redpath-museum','remove','Test removal');
do $$ begin
 if not exists (select 1 from public.landmark_unlocks where user_id='18000000-0000-4000-8000-000000000001' and moderation_status='removed') then raise exception 'Soft removal failed'; end if;
 if not exists (select 1 from public.moderation_decisions where target_type='landmark_photo' and action='remove') then raise exception 'Photo audit missing'; end if;
end $$;
rollback;
