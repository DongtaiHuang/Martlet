-- Dashboard landmarks (migration 033). Run on a disposable migrated database. Read-only checks.
begin;
do $$ begin
  if (select count(*) from public.landmarks where id in (
    'atwater-market', 'jean-talon-market', 'kondiaronk-belvedere', 'montreal-museum-fine-arts',
    'notre-dame-basilica', 'olympic-stadium', 'montreal-biosphere'
  )) <> 7 then raise exception 'Expected the 7 dashboard landmarks'; end if;
  if not (select hidden from public.landmarks where id = 'montreal-biosphere') then raise exception 'The duplicate Biosphère should be hidden'; end if;
  if (select hidden from public.landmarks where id = 'expo-67') then raise exception 'Expo 67 should stay visible'; end if;
end $$;
rollback;
