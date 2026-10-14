begin;

select plan(20);

select has_table('public', 'evaluations', 'evaluations exists');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005a1', 'authenticated', 'authenticated', 'eg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000005a2', 'authenticated', 'authenticated', 'eg2@test.local', '{}', '{"display_name":"Guru 2","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000005b1', 'authenticated', 'authenticated', 'es1@test.local', '{}', '{"display_name":"Siswa 1"}'),
  ('00000000-0000-0000-0000-0000000005b2', 'authenticated', 'authenticated', 'es2@test.local', '{}', '{"display_name":"Siswa 2"}');
update public.profiles set status = 'active' where id in ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000005a2');
insert into public.classes (id, owner_id, name, join_code) values ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005a1', 'K', 'NILAIA');
insert into public.class_members (class_id, user_id) values ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005b1');
insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-0000000005a1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-0000000005e1', '00000000-0000-0000-0000-0000000005d1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');
insert into public.assignments (id, class_id, scenario_version_id, duration_min, max_attempts)
  values ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005e1', 15, 3);
-- s1: one ended session with a question, one ended without any question, one still running
insert into public.sessions (id, user_id, kind, assignment_id, scenario_version_id, status, prompt_version, started_at, ends_at, ended_at) values
  ('00000000-0000-0000-0000-0000000005aa', '00000000-0000-0000-0000-0000000005b1', 'assignment', '00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005e1', 'ended', 'persona@2', now() - interval '20 minutes', now() - interval '5 minutes', now() - interval '6 minutes'),
  ('00000000-0000-0000-0000-0000000005ab', '00000000-0000-0000-0000-0000000005b1', 'assignment', '00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005e1', 'ended', 'persona@2', now() - interval '20 minutes', now() - interval '5 minutes', now() - interval '6 minutes'),
  ('00000000-0000-0000-0000-0000000005ac', '00000000-0000-0000-0000-0000000005b1', 'assignment', '00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000005e1', 'active', 'persona@2', now(), now() + interval '15 minutes', null);
insert into public.messages (session_id, seq, speaker, text) values
  ('00000000-0000-0000-0000-0000000005aa', 1, 'character', 'Halo.'),
  ('00000000-0000-0000-0000-0000000005aa', 2, 'learner', 'Apa masalah Ibu?'),
  ('00000000-0000-0000-0000-0000000005ab', 1, 'character', 'Halo.'),
  ('00000000-0000-0000-0000-0000000005ac', 1, 'learner', 'Halo?');

-- The browser can never drive grading or write results
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005b1","role":"authenticated"}', true);
select throws_ok($$ select public.claim_grading('00000000-0000-0000-0000-0000000005aa') $$, '42501', null, 'learner cannot claim grading');
select throws_ok($$ select public.finish_grading('00000000-0000-0000-0000-0000000005aa', '{}', 100, 'm', 'grader@1') $$, '42501', null, 'learner cannot store a result');
select throws_ok($$ insert into public.evaluations (session_id, ai_result, ai_score, grader_model, prompt_version)
  values ('00000000-0000-0000-0000-0000000005aa', '{}', 100, 'm', 'grader@1') $$, '42501', null, 'no direct insert into evaluations');

-- Server (service role) grading lifecycle
set local role service_role;
select is(public.claim_grading('00000000-0000-0000-0000-0000000005ac'), false, 'a running session is not graded');
select is(public.claim_grading('00000000-0000-0000-0000-0000000005ab'), false, 'a session without questions is not graded');
select is(public.claim_grading('00000000-0000-0000-0000-0000000005aa'), true, 'an ended session with a question is claimed');
select is(public.claim_grading('00000000-0000-0000-0000-0000000005aa'), false, 'a session being graded cannot be claimed twice');
select lives_ok($$ select public.finish_grading('00000000-0000-0000-0000-0000000005aa', null, 0, '', 'grader@1') $$, 'a failed run is recorded');
select is((select status from public.sessions where id = '00000000-0000-0000-0000-0000000005aa'), 'grading_failed', 'status is grading_failed');
select is(public.claim_grading('00000000-0000-0000-0000-0000000005aa'), true, 'a failed session can be graded again');
select lives_ok($$ select public.finish_grading('00000000-0000-0000-0000-0000000005aa', '{"facts":[]}', 72, 'grader-x', 'grader@1') $$, 'a result is stored');
select results_eq($$ select s.status, e.ai_score::int, e.final_score::int from public.sessions s join public.evaluations e on e.session_id = s.id
  where s.id = '00000000-0000-0000-0000-0000000005aa' $$, $$ values ('graded'::text, 72, 72) $$, 'session graded, ai and final score stored');
select lives_ok($$ select public.finish_grading('00000000-0000-0000-0000-0000000005aa', '{"facts":[]}', 5, 'late', 'grader@1') $$, 'a late duplicate run is ignored');
select is((select ai_score::int from public.evaluations where session_id = '00000000-0000-0000-0000-0000000005aa'), 72, 'score untouched by a run that did not claim');

-- Readers: owner and class teacher only
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005b1","role":"authenticated"}', true);
select is((select count(*)::int from public.evaluations), 1, 'owner reads own evaluation');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005b2","role":"authenticated"}', true);
select is((select count(*)::int from public.evaluations), 0, 'another learner reads nothing');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);
select is((select count(*)::int from public.evaluations), 1, 'the class teacher reads it');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a2","role":"authenticated"}', true);
select is((select count(*)::int from public.evaluations), 0, 'a teacher of another class reads nothing');

-- Deleting the learner removes the evaluation (cascade via sessions)
set local role postgres;
delete from auth.users where id = '00000000-0000-0000-0000-0000000005b1';
select is((select count(*)::int from public.evaluations where session_id = '00000000-0000-0000-0000-0000000005aa'), 0, 'evaluation deleted with the learner');

select * from finish();
rollback;
