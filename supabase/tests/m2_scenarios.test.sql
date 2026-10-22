begin;

select plan(25);

select has_table('public', 'scenarios', 'scenarios exists');
select has_table('public', 'scenario_versions', 'scenario_versions exists');
select has_table('public', 'scenario_version_secrets', 'secrets exists');
select has_table('public', 'assignments', 'assignments exists');
select is((select count(*)::int from public.characters where active), 6, '6 preset characters');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002a1', 'authenticated', 'authenticated', 'g1@test.local', '{}', '{"display_name":"Guru 1","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000002a2', 'authenticated', 'authenticated', 'g2@test.local', '{}', '{"display_name":"Guru 2","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000002b1', 'authenticated', 'authenticated', 's1@test.local', '{}', '{"display_name":"Siswa 1"}'),
  ('00000000-0000-0000-0000-0000000002b2', 'authenticated', 'authenticated', 's2@test.local', '{}', '{"display_name":"Siswa 2"}');
update public.profiles set status = 'active' where id in ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000002a2');
insert into public.classes (id, owner_id, name, join_code) values
  ('00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002a1', 'Kelas G1', 'GURUSA');
insert into public.class_members (class_id, user_id) values
  ('00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002b1');

-- Teacher 1 creates a draft and publishes it
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a1","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.scenarios (author_id, title, draft) values ('00000000-0000-0000-0000-0000000002a1', 'Laundry', '{"facts":[{"content":"kurir 2"}]}') $$,
  'active teacher creates draft'
);
set local role postgres;
update public.scenarios set id = '00000000-0000-0000-0000-0000000002d1' where title = 'Laundry';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a1","role":"authenticated"}', true);

select throws_ok(
  $$ update public.scenarios set is_public = true where id = '00000000-0000-0000-0000-0000000002d1' $$,
  '23514', null, 'unpublished scenario cannot be public'
);

select lives_ok($$ select public.publish_scenario(
  '00000000-0000-0000-0000-0000000002d1',
  '{"title":"Laundry Antar-Jemput","language":"id","level":"smk","learnerRole":"Analis sistem","objective":"Gali kebutuhan","clientName":"Bu Ratna","clientOccupation":"Pemilik laundry","characterId":"ratna"}',
  '{"persona":{"name":"Bu Ratna"},"facts":[{"id":"F1","content":"Kurir hanya 2"}],"rubric":[{"criterion":"Teknik bertanya","weight":1}]}'
) $$, 'author publishes v1');
select lives_ok($$ select public.publish_scenario(
  '00000000-0000-0000-0000-0000000002d1',
  '{"title":"Laundry v2","language":"id","level":"smk","learnerRole":"Analis sistem","objective":"Gali kebutuhan","clientName":"Bu Ratna","clientOccupation":"Pemilik laundry","characterId":"ratna"}',
  '{"persona":{"name":"Bu Ratna"},"facts":[],"rubric":[]}'
) $$, 'author publishes v2');
select is(
  (select array_agg(version order by version) from public.scenario_versions where scenario_id = '00000000-0000-0000-0000-0000000002d1'),
  array[1, 2], 'versions are numbered 1, 2'
);
select is(
  (select v.version from public.scenarios s join public.scenario_versions v on v.id = s.current_version_id where s.id = '00000000-0000-0000-0000-0000000002d1'),
  2, 'current version points at v2'
);
select is((select title from public.scenarios where id = '00000000-0000-0000-0000-0000000002d1'), 'Laundry v2', 'title synced on publish');
select isnt_empty($$ select 1 from public.scenario_version_secrets $$, 'author reads own secrets');
select throws_ok(
  $$ update public.scenario_versions set title = 'x' $$, '42501', null, 'versions are immutable for users'
);

-- Assign v1 to own class
select lives_ok(
  $$ insert into public.assignments (class_id, scenario_version_id)
     select '00000000-0000-0000-0000-0000000002c1', id from public.scenario_versions
     where scenario_id = '00000000-0000-0000-0000-0000000002d1' and version = 1 $$,
  'owner assigns own version'
);

-- Teacher 2: sees nothing private, cannot assign a private scenario, cannot publish someone else's
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002a2","role":"authenticated"}', true);
select is_empty($$ select id from public.scenarios $$, 'other teacher cannot read draft');
select is_empty($$ select version_id from public.scenario_version_secrets $$, 'other teacher cannot read secrets');
select throws_ok(
  $$ select public.publish_scenario('00000000-0000-0000-0000-0000000002d1', '{}', '{}') $$,
  '42501', null, 'non-author cannot publish'
);

-- Learner in class: reads assigned brief, never drafts or secrets
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002b1","role":"authenticated"}', true);
select is((select count(*)::int from public.assignments), 1, 'member sees assignment');
select is(
  (select array_agg(client_name || ' v' || version) from public.scenario_versions),
  array['Bu Ratna v1'], 'member reads only the assigned version brief'
);
select is_empty($$ select id from public.scenarios $$, 'learner cannot read drafts');
select is_empty($$ select version_id from public.scenario_version_secrets $$, 'learner cannot read secrets');

-- Learner outside the class sees nothing until it goes public; then only the current version
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002b2","role":"authenticated"}', true);
select is_empty($$ select id from public.scenario_versions $$, 'outsider sees no version');
set local role postgres;
update public.scenarios set is_public = true where id = '00000000-0000-0000-0000-0000000002d1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000002b2","role":"authenticated"}', true);
select is(
  (select array_agg(version) from public.scenario_versions), array[2], 'public library exposes only the current version'
);

select is(
  (select array_agg(client_name || ' v' || version) from public.library_versions), array['Bu Ratna v2'], 'library view lists the public current version'
);

select * from finish();
rollback;
