begin;

select plan(8);

-- Fixtures: synthetic local Auth users only (never the hosted project). No role metadata, like a Google sign-up.
set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000001801', 'authenticated', 'authenticated', 'baru@test.local', '{}', '{}'),
  ('00000000-0000-0000-0000-000000001802', 'authenticated', 'authenticated', 'lama@test.local', '{}', '{}'),
  ('00000000-0000-0000-0000-000000001803', 'authenticated', 'authenticated', 'massal@test.local', '{}', '{}'),
  ('00000000-0000-0000-0000-000000001804', 'authenticated', 'authenticated', 'guru@test.local', '{}', '{"role": "pengajar"}');
update public.profiles set created_at = now() - interval '1 day' where id = '00000000-0000-0000-0000-000000001804';
update public.profiles set created_at = now() - interval '11 minutes' where id = '00000000-0000-0000-0000-000000001802';
update public.profiles set must_change_password = true where id = '00000000-0000-0000-0000-000000001803';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001801","role":"authenticated"}', true);
select is(public.request_teacher_role(), true, 'a brand-new pelajar can ask to be a teacher');
select results_eq(
  $$ select role::text, status::text from public.profiles where id = '00000000-0000-0000-0000-000000001801' $$,
  $$ values ('pengajar', 'pending') $$,
  'the switch lands as pending, never active'
);
select is(public.request_teacher_role(), true, 'asking again keeps the pending teacher (nothing to switch)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001802","role":"authenticated"}', true);
select is(public.request_teacher_role(), false, 'an account older than 10 minutes stays pelajar');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001803","role":"authenticated"}', true);
select is(public.request_teacher_role(), false, 'a bulk-created account stays pelajar');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001804","role":"authenticated"}', true);
select is(public.request_teacher_role(), true, 'an existing teacher signing in again is not turned away');
select results_eq(
  $$ select role::text, status::text from public.profiles where id = '00000000-0000-0000-0000-000000001804' $$,
  $$ values ('pengajar', 'pending') $$,
  'and their status is left as it was'
);

set local role anon;
select throws_ok('select public.request_teacher_role()', '42501', null, 'anon cannot call it');

select * from finish();
rollback;
