begin;

-- Issue #49: assignments.client_level is set on insert by the class owner, defaults to 'normal',
-- is readable by class members, and cannot be changed afterwards.
select plan(8);

select has_column('public', 'assignments', 'client_level', 'assignments.client_level exists');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000e01', 'authenticated', 'authenticated', 'lg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-000000000e02', 'authenticated', 'authenticated', 'ls@test.local', '{}', '{"display_name":"Siswa"}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-000000000e01';
insert into public.classes (id, owner_id, name, join_code) values
  ('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000e01', 'Kelas Level', 'LEVELA');
insert into public.class_members (class_id, user_id) values
  ('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000e02');
insert into public.scenarios (id, author_id, title, draft) values
  ('00000000-0000-0000-0000-000000000ed1', '00000000-0000-0000-0000-000000000e01', 'Laundry', '{}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e01","role":"authenticated"}', true);
select lives_ok($$ select public.publish_scenario(
  '00000000-0000-0000-0000-000000000ed1',
  '{"title":"Laundry","language":"id","level":"smk","learnerRole":"Analis sistem","objective":"Gali kebutuhan","clientName":"Bu Ratna","clientOccupation":"Pemilik laundry","characterId":"ratna"}',
  '{"persona":{"name":"Bu Ratna"},"facts":[],"rubric":[]}'
) $$, 'teacher publishes the scenario');

select lives_ok(
  $$ insert into public.assignments (class_id, scenario_version_id, client_level)
     select '00000000-0000-0000-0000-000000000ec1', id, 'sulit'
     from public.scenario_versions where scenario_id = '00000000-0000-0000-0000-000000000ed1' $$,
  'owner assigns with a client level'
);
select lives_ok(
  $$ insert into public.assignments (class_id, scenario_version_id)
     select '00000000-0000-0000-0000-000000000ec1', id
     from public.scenario_versions where scenario_id = '00000000-0000-0000-0000-000000000ed1' $$,
  'owner assigns without a client level'
);
select throws_ok(
  $$ insert into public.assignments (class_id, scenario_version_id, client_level)
     select '00000000-0000-0000-0000-000000000ec1', id, 'ekstrem'
     from public.scenario_versions where scenario_id = '00000000-0000-0000-0000-000000000ed1' $$,
  '23514', null, 'unknown client level is rejected'
);
select throws_ok(
  $$ update public.assignments set client_level = 'mudah' where client_level = 'sulit' $$,
  '42501', null, 'owner cannot change the client level after creating the assignment'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000e02","role":"authenticated"}', true);
select results_eq(
  $$ select client_level from public.assignments order by client_level $$,
  $$ values ('normal'), ('sulit') $$,
  'member reads the level; the default is normal'
);

set local role postgres;
select is((select count(*)::int from public.assignments where client_level = 'mudah'), 0, 'level unchanged after the refused update');

select * from finish();
rollback;
