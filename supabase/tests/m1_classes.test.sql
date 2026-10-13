begin;

select plan(22);

select has_table('public', 'classes', 'classes exists');
select has_table('public', 'class_members', 'class_members exists');
select ok((select relrowsecurity from pg_class where oid = 'public.classes'::regclass), 'RLS on classes');
select ok((select relrowsecurity from pg_class where oid = 'public.class_members'::regclass), 'RLS on class_members');

-- Fixtures: synthetic local users only.
set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'guru1@test.local', '{}', '{"display_name":"Guru 1","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'guru2@test.local', '{}', '{"display_name":"Guru 2","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'authenticated', 'authenticated', 'siswa1@test.local', '{}', '{"display_name":"Siswa 1"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'siswa2@test.local', '{}', '{"display_name":"Siswa 2"}');
-- guru1 approved, guru2 stays pending.
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000a1';

-- Pending teacher cannot create a class
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.classes (owner_id, name) values ('00000000-0000-0000-0000-0000000000a2', 'Kelas Pending') $$,
  '42501', null, 'pending pengajar cannot create class'
);

-- Active teacher creates a class; join code is generated
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.classes (owner_id, name) values ('00000000-0000-0000-0000-0000000000a1', 'RPL XI-1') $$,
  'active pengajar creates class'
);
select matches(
  (select join_code from public.classes where name = 'RPL XI-1'),
  '^[A-HJ-NP-Z2-9]{6}$',
  'join code is 6 unambiguous chars'
);
-- Pin id + code so later steps can reference them without reading the table.
set local role postgres;
update public.classes set id = '00000000-0000-0000-0000-0000000000c1', join_code = 'ABCD23' where name = 'RPL XI-1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.classes (owner_id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Palsu') $$,
  '42501', null, 'cannot create class for someone else'
);
select throws_ok(
  $$ update public.classes set join_code = 'AAAAAA' where name = 'RPL XI-1' $$,
  '42501', null, 'owner cannot set join code directly'
);

-- Pelajar cannot create class, cannot see a class before joining
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.classes (owner_id, name) values ('00000000-0000-0000-0000-0000000000b1', 'Kelasku') $$,
  '42501', null, 'pelajar cannot create class'
);
select is_empty($$ select id from public.classes $$, 'pelajar sees no class before joining');

-- Wrong code -> null; right code (lowercase + spaces) -> joins; joining twice is idempotent
select is(public.join_class('ZZZZZZ'), null, 'wrong code returns null');
select isnt(public.join_class(' abcd23 '), null, 'valid code (case/space-insensitive) joins');
select lives_ok($$ select public.join_class('ABCD23') $$, 'joining twice does not error');
select is((select count(*)::int from public.class_members), 1, 'membership is not duplicated');
select is((select count(*)::int from public.classes), 1, 'member now sees the class');

-- Another pelajar sees neither the class nor siswa1's membership
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is_empty($$ select class_id from public.class_members $$, 'other pelajar sees no memberships');
select throws_ok(
  $$ insert into public.class_members (class_id, user_id) values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2') $$,
  '42501', null, 'pelajar cannot insert membership directly'
);

-- Teacher sees roster + student profile; other teacher does not
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'Siswa 1', 'owner reads profile of own student'
);
select is_empty(
  $$ select id from public.profiles where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'owner cannot read profile of non-student'
);
select isnt(public.regenerate_join_code('00000000-0000-0000-0000-0000000000c1'), 'ABCD23', 'owner regenerates code');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select throws_ok(
  $$ select public.regenerate_join_code('00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'non-owner cannot regenerate code'
);

select * from finish();
rollback;
