begin;

select plan(12);

-- Setup synthetic users (engineering-standard §6)
set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000aa1', 'authenticated', 'authenticated', 'guru1@test.local', '{}', '{"display_name":"Guru 1","role":"pengajar"}'),
  ('00000000-0000-0000-0000-000000000aa2', 'authenticated', 'authenticated', 'guru2@test.local', '{}', '{"display_name":"Guru 2","role":"pengajar"}'),
  ('00000000-0000-0000-0000-000000000bb1', 'authenticated', 'authenticated', 'siswa1@test.local', '{}', '{"display_name":"Siswa 1"}');

update public.profiles set status = 'active' where id in ('00000000-0000-0000-0000-000000000aa1', '00000000-0000-0000-0000-000000000aa2', '00000000-0000-0000-0000-000000000bb1');

insert into public.classes (id, owner_id, name, archived_at) values
  ('00000000-0000-0000-0000-000000000cc1', '00000000-0000-0000-0000-000000000aa1', 'Kelas Uji', null);

-- 1. Owner CANNOT directly update archived_at (grant revoked to prevent tampering with retention)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000aa1","role":"authenticated"}', true);

select throws_ok(
  $$ update public.classes set archived_at = now() - interval '2 years' where id = '00000000-0000-0000-0000-000000000cc1' $$,
  '42501',
  null,
  'owner cannot set past date directly on archived_at'
);

select throws_ok(
  $$ update public.classes set archived_at = now() where id = '00000000-0000-0000-0000-000000000cc1' $$,
  '42501',
  null,
  'owner cannot directly update archived_at at all'
);

-- Owner CAN still update the class name
select lives_ok(
  $$ update public.classes set name = 'Kelas Berganti Nama' where id = '00000000-0000-0000-0000-000000000cc1' $$,
  'owner can still update name column'
);

-- 2. Owner archives the class via RPC set_class_archived: binds strictly to server time (now())
select lives_ok(
  $$ select public.set_class_archived('00000000-0000-0000-0000-000000000cc1', true) $$,
  'owner can archive class via set_class_archived RPC'
);

set local role postgres;
select ok(
  (select archived_at > now() - interval '10 seconds' from public.classes where id = '00000000-0000-0000-0000-000000000cc1'),
  'archived_at is set to current server timestamp'
);

-- 3. Owner unarchives the class via RPC set_class_archived: sets archived_at back to null
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000aa1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.set_class_archived('00000000-0000-0000-0000-000000000cc1', false) $$,
  'owner can unarchive class via set_class_archived RPC'
);

set local role postgres;
select is(
  (select archived_at from public.classes where id = '00000000-0000-0000-0000-000000000cc1'),
  null,
  'archived_at is restored to null upon unarchive'
);

-- 4. Non-existent class ID is rejected with 42501 and existing classes are untouched
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000aa1","role":"authenticated"}', true);

select throws_ok(
  $$ select public.set_class_archived('99999999-9999-4999-a999-999999999999', true) $$,
  '42501',
  null,
  'non-existent class throws 42501'
);

set local role postgres;
select is(
  (select archived_at from public.classes where id = '00000000-0000-0000-0000-000000000cc1'),
  null,
  'existing class archived_at remains null after non-existent class call'
);

-- 5. Another teacher (non-owner) is rejected
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000aa2","role":"authenticated"}', true);

select throws_ok(
  $$ select public.set_class_archived('00000000-0000-0000-0000-000000000cc1', true) $$,
  '42501',
  null,
  'non-owner teacher cannot archive class'
);

-- 6. Student is rejected
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000bb1","role":"authenticated"}', true);

select throws_ok(
  $$ select public.set_class_archived('00000000-0000-0000-0000-000000000cc1', true) $$,
  '42501',
  null,
  'student cannot archive class'
);

-- 7. Anonymous caller is rejected
set local role anon;

select throws_ok(
  $$ select public.set_class_archived('00000000-0000-0000-0000-000000000cc1', true) $$,
  '42501',
  null,
  'anon cannot archive class'
);

select * from finish();
rollback;
