-- Create profiles for accounts that signed up before 001_mvp.sql installed the
-- on_auth_user_created trigger. Without a profile row those users can't host,
-- peck or flap (foreign keys to public.profiles). Safe to re-run.
insert into public.profiles (id)
select u.id
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
