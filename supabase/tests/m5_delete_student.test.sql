begin;

select plan(19);

select has_table('public', 'audit_log', 'audit_log exists');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass), 'RLS enabled on audit_log');

-- Every FK into learner data must cascade or set null, or deleting a learner fails / leaves rows behind.
-- Guards tables added later too.
select is(
  (select count(*)::int from pg_constraint c
   join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
   where c.contype = 'f' and n.nspname = 'public'
     and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass, 'public.sessions'::regclass)
     and c.confdeltype not in ('c', 'n')),
  0, 'every FK to auth.users / profiles / sessions is on delete cascade or set null');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000ba1', 'authenticated', 'authenticated', 'dg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-000000000bb1', 'authenticated', 'authenticated', 'ds@test.local', '{}', '{"display_name":"Siswa Hapus"}'),
  ('00000000-0000-0000-0000-000000000bb2', 'authenticated', 'authenticated', 'dt@test.local', '{}', '{"display_name":"Siswa Tetap"}'),
  ('00000000-0000-0000-0000-000000000bad', 'authenticated', 'authenticated', 'da@test.local', '{}', '{"display_name":"Admin"}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-000000000ba1';
update public.profiles set role = 'admin', status = 'active' where id = '00000000-0000-0000-0000-000000000bad';

insert into public.classes (id, owner_id, name) values ('00000000-0000-0000-0000-000000000bc1', '00000000-0000-0000-0000-000000000ba1', 'Kelas');
insert into public.class_members (class_id, user_id) values
  ('00000000-0000-0000-0000-000000000bc1', '00000000-0000-0000-0000-000000000bb1'),
  ('00000000-0000-0000-0000-000000000bc1', '00000000-0000-0000-0000-000000000bb2');
insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-000000000bd1', '00000000-0000-0000-0000-000000000ba1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-000000000be1', '00000000-0000-0000-0000-000000000bd1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');
insert into public.sessions (id, user_id, kind, scenario_version_id, status, prompt_version, ends_at) values
  ('00000000-0000-0000-0000-000000000bf1', '00000000-0000-0000-0000-000000000bb1', 'library', '00000000-0000-0000-0000-000000000be1', 'graded', 'persona@2', now()),
  ('00000000-0000-0000-0000-000000000bf2', '00000000-0000-0000-0000-000000000bb2', 'library', '00000000-0000-0000-0000-000000000be1', 'graded', 'persona@2', now());
insert into public.messages (session_id, seq, speaker, text) values
  ('00000000-0000-0000-0000-000000000bf1', 1, 'learner', 'Halo'),
  ('00000000-0000-0000-0000-000000000bf2', 1, 'learner', 'Halo');
insert into public.evaluations (session_id, ai_result, ai_score, final_score, grader_model, prompt_version, reviewer_id) values
  ('00000000-0000-0000-0000-000000000bf1', '{"facts":[]}', 50, 50, 'm', 'grader@1', '00000000-0000-0000-0000-000000000ba1'),
  ('00000000-0000-0000-0000-000000000bf2', '{"facts":[]}', 60, 60, 'm', 'grader@1', null);
insert into public.llm_calls (task, provider, model, latency_ms, status, session_id) values
  ('chat', 'gemini', 'g', 1, 'ok', '00000000-0000-0000-0000-000000000bf1'),
  ('chat', 'gemini', 'g', 1, 'ok', '00000000-0000-0000-0000-000000000bf2');

-- Only admins
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000bb2","role":"authenticated"}', true);
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000bb1', 'Siswa Hapus') $$, '42501', null, 'learner is refused');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000ba1","role":"authenticated"}', true);
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000bb1', 'Siswa Hapus') $$, '42501', null, 'teacher is refused, even for a learner in their class');
select is((select count(*)::int from public.audit_log), 0, 'teacher cannot read audit_log');
set local role anon;
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000bb1', 'Siswa Hapus') $$, '42501', null, 'anon is refused');

-- Admin guard rails
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000bad","role":"authenticated"}', true);
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000bad', 'Admin') $$, '22023', 'cannot_delete_self', 'admin cannot delete themselves');
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000ba1', 'Guru') $$, '22023', 'not_a_student', 'teachers cannot be deleted here');
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000bb1', 'Siswa Tetap') $$, '22023', 'confirmation_mismatch', 'wrong confirmation is refused');
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000bb1', null) $$, '22023', 'confirmation_mismatch', 'missing confirmation is refused');
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-00000000ffff', 'X') $$, 'P0002', 'not_found', 'unknown user');
select throws_ok($$ insert into public.audit_log (actor_id, action, target) values (auth.uid(), 'delete_student', 'x') $$, '42501', null, 'no direct writes to audit_log');

-- Delete
select lives_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000bb1', ' Siswa Hapus ') $$, 'admin deletes the learner');

set local role postgres;
select results_eq(
  $$ select
       (select count(*)::int from auth.users where id = '00000000-0000-0000-0000-000000000bb1'),
       (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000bb1'),
       (select count(*)::int from public.class_members where user_id = '00000000-0000-0000-0000-000000000bb1'),
       (select count(*)::int from public.sessions where user_id = '00000000-0000-0000-0000-000000000bb1'),
       (select count(*)::int from public.messages where session_id = '00000000-0000-0000-0000-000000000bf1'),
       (select count(*)::int from public.evaluations where session_id = '00000000-0000-0000-0000-000000000bf1'),
       (select count(*)::int from public.llm_calls where session_id = '00000000-0000-0000-0000-000000000bf1') $$,
  $$ values (0, 0, 0, 0, 0, 0, 0) $$,
  'no learner rows left: auth user, profile, membership, sessions, messages, evaluations, llm_calls');
select results_eq(
  $$ select
       (select count(*)::int from public.class_members where user_id = '00000000-0000-0000-0000-000000000bb2'),
       (select count(*)::int from public.sessions where user_id = '00000000-0000-0000-0000-000000000bb2'),
       (select count(*)::int from public.messages where session_id = '00000000-0000-0000-0000-000000000bf2'),
       (select count(*)::int from public.evaluations where session_id = '00000000-0000-0000-0000-000000000bf2'),
       (select count(*)::int from public.llm_calls where session_id = '00000000-0000-0000-0000-000000000bf2'),
       (select count(*)::int from public.classes where id = '00000000-0000-0000-0000-000000000bc1'),
       (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000ba1') $$,
  $$ values (1, 1, 1, 1, 1, 1, 1) $$,
  'other learners, the class and the teacher are untouched');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000bad","role":"authenticated"}', true);
select results_eq(
  $$ select actor_id, action, target from public.audit_log $$,
  $$ values ('00000000-0000-0000-0000-000000000bad'::uuid, 'delete_student', '00000000-0000-0000-0000-000000000bb1') $$,
  'admin reads one audit row: actor, action, deleted id');
select is(
  (select count(*)::int from public.audit_log where target ilike '%siswa%' or target ilike '%@%'),
  0, 'audit_log holds no name or email of the deleted learner');
select throws_ok($$ select public.delete_student('00000000-0000-0000-0000-000000000bb1', 'Siswa Hapus') $$, 'P0002', 'not_found', 'deleting twice is refused, not silently logged again');

select * from finish();
rollback;
