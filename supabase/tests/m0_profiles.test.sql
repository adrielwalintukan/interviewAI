begin;

select plan(16);

-- Schema
select has_table('public', 'profiles', 'profiles exists');
select enum_has_labels('public', 'user_role', array['admin', 'pengajar', 'pelajar'], 'user_role labels');
select enum_has_labels('public', 'user_status', array['active', 'pending', 'disabled'], 'user_status labels');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS enabled on profiles'
);

-- Fixtures: synthetic local Auth users only (never the hosted project).
set local role postgres;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'siswa@test.local', '{}',
   '{"display_name": "Siswa A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'guru@test.local', '{}',
   '{"display_name": "Guru B", "role": "pengajar"}'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'nakal@test.local', '{}',
   '{"role": "admin"}'),
  ('00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated',
   repeat('x', 100) || '@test.local', '{}', '{}');

-- Signup trigger
select results_eq(
  $$ select role::text, status::text, display_name from public.profiles
     where id = '00000000-0000-0000-0000-00000000000a' $$,
  $$ values ('pelajar', 'active', 'Siswa A') $$,
  'default signup is an active pelajar'
);
select results_eq(
  $$ select role::text, status::text from public.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  $$ values ('pengajar', 'pending') $$,
  'requesting pengajar lands as pending'
);
select results_eq(
  $$ select role::text, status::text, display_name from public.profiles
     where id = '00000000-0000-0000-0000-00000000000c' $$,
  $$ values ('pelajar', 'active', 'nakal') $$,
  'admin cannot be self-assigned; display name falls back to email local part'
);
select is(
  (select char_length(display_name) from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  80,
  'long email local part is truncated to 80 chars'
);

-- RLS as pelajar A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid) $$,
  'pelajar sees only own profile'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Siswa A Baru' where id = '00000000-0000-0000-0000-00000000000a' $$,
  'pelajar can rename self'
);
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null,
  'pelajar cannot change own role'
);
select throws_ok(
  $$ update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null,
  'pelajar cannot change own status'
);
select is_empty(
  $$ update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b' returning id $$,
  'pelajar cannot rename someone else'
);
select ok(not public.is_admin(), 'pelajar is not admin');

-- Admin reads everything
set local role postgres;
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}', true);

select ok(public.is_admin(), 'admin is recognised');
select is((select count(*)::int from public.profiles), 4, 'admin sees all profiles');

select * from finish();
rollback;
