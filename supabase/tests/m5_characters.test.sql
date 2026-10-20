begin;

-- US-A-03: characters are written only by the admin Server Action with the service role.
-- Signed-in users (admins included) have no write policy; inactive characters are hidden from non-admins.
select plan(7);

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000da1', 'authenticated', 'authenticated', 'kg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-000000000db1', 'authenticated', 'authenticated', 'ks@test.local', '{}', '{"display_name":"Siswa"}'),
  ('00000000-0000-0000-0000-000000000dad', 'authenticated', 'authenticated', 'ka@test.local', '{}', '{"display_name":"Admin"}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-000000000da1';
update public.profiles set role = 'admin', status = 'active' where id = '00000000-0000-0000-0000-000000000dad';
update public.characters set active = false where id = 'dimas';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000da1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.characters (id, name, occupation, age_range, gender, live_voice, portrait_hue) values ('x-guru', 'X', 'X', '30-an', 'male', 'Puck', 1) $$,
  '42501', null, 'teacher cannot add a character');
update public.characters set live_voice = 'Puck', active = true where id = 'ratna';
select is((select count(*)::int from public.characters where id = 'dimas'), 0, 'teacher does not see an inactive character');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000db1","role":"authenticated"}', true);
update public.characters set name = 'Diretas' where id = 'ratna';
select is((select count(*)::int from public.characters where id = 'dimas'), 0, 'learner does not see an inactive character');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000dad","role":"authenticated"}', true);
select is((select count(*)::int from public.characters where id = 'dimas'), 1, 'admin sees inactive characters');
select throws_ok(
  $$ insert into public.characters (id, name, occupation, age_range, gender, live_voice, portrait_hue) values ('x-admin', 'X', 'X', '30-an', 'male', 'Puck', 1) $$,
  '42501', null, 'even an admin cannot write directly: only the server action (service role) can');
update public.characters set active = true where id = 'dimas';

set local role postgres;
select results_eq(
  $$ select name, live_voice from public.characters where id = 'ratna' $$,
  $$ values ('Bu Ratna'::text, 'Aoede'::text) $$,
  'updates by teacher and learner changed nothing');
select is((select active from public.characters where id = 'dimas'), false, 'update by admin as a signed-in user changed nothing');

select * from finish();
rollback;
