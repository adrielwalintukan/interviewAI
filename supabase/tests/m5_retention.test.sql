begin;

select plan(12);

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000ca1', 'authenticated', 'authenticated', 'rg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-000000000cb1', 'authenticated', 'authenticated', 'rs@test.local', '{}', '{"display_name":"Siswa"}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-000000000ca1';

insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-000000000cd1', '00000000-0000-0000-0000-000000000ca1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-000000000ce1', '00000000-0000-0000-0000-000000000cd1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');

-- Synthetic dates: archived 13 months ago (purged), 11 months ago (kept), and active (kept).
insert into public.classes (id, owner_id, name, archived_at) values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000ca1', 'Lama', now() - interval '13 months'),
  ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-000000000ca1', 'Baru', now() - interval '11 months'),
  ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-000000000ca1', 'Aktif', null),
  ('00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-000000000ca1', 'Dibuka lagi', now() - interval '13 months');
insert into public.class_members (class_id, user_id) values ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000cb1');
insert into public.assignments (id, class_id, scenario_version_id) values
  ('00000000-0000-0000-0000-000000000ca2', '00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000ce1'),
  ('00000000-0000-0000-0000-000000000ca3', '00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-000000000ce1'),
  ('00000000-0000-0000-0000-000000000ca4', '00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-000000000ce1'),
  ('00000000-0000-0000-0000-000000000ca5', '00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-000000000ce1');
insert into public.sessions (id, user_id, kind, assignment_id, scenario_version_id, status, prompt_version, ends_at) values
  ('00000000-0000-0000-0000-000000000cf1', '00000000-0000-0000-0000-000000000cb1', 'assignment', '00000000-0000-0000-0000-000000000ca2', '00000000-0000-0000-0000-000000000ce1', 'graded', 'persona@2', now()),
  ('00000000-0000-0000-0000-000000000cf2', '00000000-0000-0000-0000-000000000cb1', 'assignment', '00000000-0000-0000-0000-000000000ca2', '00000000-0000-0000-0000-000000000ce1', 'graded', 'persona@2', now()),
  ('00000000-0000-0000-0000-000000000cf3', '00000000-0000-0000-0000-000000000cb1', 'assignment', '00000000-0000-0000-0000-000000000ca3', '00000000-0000-0000-0000-000000000ce1', 'graded', 'persona@2', now()),
  ('00000000-0000-0000-0000-000000000cf4', '00000000-0000-0000-0000-000000000cb1', 'assignment', '00000000-0000-0000-0000-000000000ca4', '00000000-0000-0000-0000-000000000ce1', 'graded', 'persona@2', now()),
  ('00000000-0000-0000-0000-000000000cf5', '00000000-0000-0000-0000-000000000cb1', 'library', null, '00000000-0000-0000-0000-000000000ce1', 'graded', 'persona@2', now()),
  ('00000000-0000-0000-0000-000000000cf6', '00000000-0000-0000-0000-000000000cb1', 'assignment', '00000000-0000-0000-0000-000000000ca5', '00000000-0000-0000-0000-000000000ce1', 'graded', 'persona@2', now());
insert into public.messages (session_id, seq, speaker, text)
  select id, 1, 'learner', 'Halo' from public.sessions where user_id = '00000000-0000-0000-0000-000000000cb1';
insert into public.evaluations (session_id, ai_result, ai_score, final_score, grader_model, prompt_version)
  select id, '{"facts":[]}', 50, 50, 'm', 'grader@1' from public.sessions where user_id = '00000000-0000-0000-0000-000000000cb1';

-- Only the service role (and pg_cron, as postgres) may run it
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000ca1","role":"authenticated"}', true);
-- The owner reopens the class archived 13 months ago (unarchiveClass: archived_at = null), as the app does.
update public.classes set archived_at = null where id = '00000000-0000-0000-0000-000000000c04';
select throws_ok($$ select public.purge_archived_class_sessions() $$, '42501', null, 'authenticated cannot purge');
set local role anon;
select throws_ok($$ select public.purge_archived_class_sessions() $$, '42501', null, 'anon cannot purge');

set local role service_role;
select is(public.purge_archived_class_sessions(), 2, 'purges the 2 sessions of the class archived > 1 year ago');

set local role postgres;
select results_eq(
  $$ select
       (select count(*)::int from public.sessions where id in ('00000000-0000-0000-0000-000000000cf1', '00000000-0000-0000-0000-000000000cf2')),
       (select count(*)::int from public.messages where session_id in ('00000000-0000-0000-0000-000000000cf1', '00000000-0000-0000-0000-000000000cf2')),
       (select count(*)::int from public.evaluations where session_id in ('00000000-0000-0000-0000-000000000cf1', '00000000-0000-0000-0000-000000000cf2')) $$,
  $$ values (0, 0, 0) $$,
  'transcripts and evaluations of the old archived class are gone');
select results_eq(
  $$ select array_agg(id::text order by id) from public.sessions where user_id = '00000000-0000-0000-0000-000000000cb1' $$,
  $$ values (array['00000000-0000-0000-0000-000000000cf3', '00000000-0000-0000-0000-000000000cf4', '00000000-0000-0000-0000-000000000cf5', '00000000-0000-0000-0000-000000000cf6']) $$,
  'class archived < 1 year, active class, a class reopened after 13 months, and library sessions are untouched');
select results_eq(
  $$ select (select count(*)::int from public.messages where session_id in ('00000000-0000-0000-0000-000000000cf3', '00000000-0000-0000-0000-000000000cf4', '00000000-0000-0000-0000-000000000cf5', '00000000-0000-0000-0000-000000000cf6')),
            (select count(*)::int from public.classes where id = '00000000-0000-0000-0000-000000000c01'),
            (select count(*)::int from public.class_members where class_id = '00000000-0000-0000-0000-000000000c01'),
            (select count(*)::int from public.assignments where id = '00000000-0000-0000-0000-000000000ca2') $$,
  $$ values (4, 1, 1, 1) $$,
  'their messages, and the old class with its members and assignment, stay');
select results_eq(
  $$ select actor_id, action, target from public.audit_log where action = 'purge_archived_sessions' $$,
  $$ values (null::uuid, 'purge_archived_sessions', '2') $$,
  'audit_log records only the count, no actor, no personal data');

-- Archived again today (archiveClass: archived_at = now()): retention restarts from the latest archive.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000ca1","role":"authenticated"}', true);
update public.classes set archived_at = now() where id = '00000000-0000-0000-0000-000000000c04';
set local role postgres;
select ok((select archived_at > now() - interval '1 minute' from public.classes where id = '00000000-0000-0000-0000-000000000c04'), 'owner re-archived the class: archived_at is the new date');

set local role service_role;
select is(public.purge_archived_class_sessions(), 0, 'second run deletes nothing, not even the re-archived class');
set local role postgres;
select is((select count(*)::int from public.messages where session_id = '00000000-0000-0000-0000-000000000cf6'), 1, 're-archived class keeps its transcript until 1 year after the latest archive');

set local role postgres;
select is((select count(*)::int from public.audit_log where action = 'purge_archived_sessions'), 2, 'every run is logged, even with 0');
select results_eq(
  $$ select schedule, command from cron.job where jobname = 'monthly-retention' $$,
  $$ values ('0 3 1 * *'::text, 'select public.purge_archived_class_sessions(); select public.purge_llm_calls();'::text) $$,
  'monthly pg_cron job runs both purges');

select * from finish();
rollback;
