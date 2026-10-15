begin;

select plan(16);

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000006a1', 'authenticated', 'authenticated', 'rg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000006a2', 'authenticated', 'authenticated', 'rg2@test.local', '{}', '{"display_name":"Guru 2","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000006b1', 'authenticated', 'authenticated', 'rs1@test.local', '{}', '{"display_name":"Siswa 1"}'),
  ('00000000-0000-0000-0000-0000000006b2', 'authenticated', 'authenticated', 'rs2@test.local', '{}', '{"display_name":"Siswa 2"}');
update public.profiles set status = 'active' where id in ('00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006a2');
insert into public.classes (id, owner_id, name, join_code) values ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006a1', 'K', 'TINJAU');
insert into public.class_members (class_id, user_id) values ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006b1');
insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-0000000006d1', '00000000-0000-0000-0000-0000000006a1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-0000000006e1', '00000000-0000-0000-0000-0000000006d1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');
insert into public.assignments (id, class_id, scenario_version_id, duration_min, max_attempts)
  values ('00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006e1', 15, 3);
-- s1: three attempts — graded 40, graded 72, and one ended without a grade
insert into public.sessions (id, user_id, kind, assignment_id, scenario_version_id, status, prompt_version, started_at, ends_at, ended_at) values
  ('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006b1', 'assignment', '00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006e1', 'graded', 'persona@2', now() - interval '3 hours', now() - interval '2 hours', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000000006ab', '00000000-0000-0000-0000-0000000006b1', 'assignment', '00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006e1', 'graded', 'persona@2', now() - interval '2 hours', now() - interval '1 hour', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000006ac', '00000000-0000-0000-0000-0000000006b1', 'assignment', '00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006e1', 'ended', 'persona@2', now() - interval '1 hour', now() - interval '30 minutes', now() - interval '30 minutes');
insert into public.evaluations (session_id, ai_result, ai_score, final_score, grader_model, prompt_version) values
  ('00000000-0000-0000-0000-0000000006aa', '{"facts":[]}', 40, 40, 'm', 'grader@1'),
  ('00000000-0000-0000-0000-0000000006ab', '{"facts":[]}', 72, 72, 'm', 'grader@1');

-- The browser cannot call the review RPC at all
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select throws_ok($$ select public.review_evaluation('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006a1', '{}', 100, '') $$,
  '42501', null, 'authenticated cannot call review_evaluation');

-- Server-side checks: only the class owner (or an admin) may review a graded session
set local role service_role;
select throws_ok($$ select public.review_evaluation('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006a2', '{}', 100, '') $$,
  '42501', 'not_allowed', 'a teacher of another class cannot review');
select throws_ok($$ select public.review_evaluation('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006b1', '{}', 100, '') $$,
  '42501', 'not_allowed', 'the learner cannot review their own session');
select throws_ok($$ select public.review_evaluation('00000000-0000-0000-0000-0000000006ac', '00000000-0000-0000-0000-0000000006a1', '{}', 100, '') $$,
  '42501', 'not_allowed', 'an ungraded session cannot be reviewed');
select lives_ok($$ select public.review_evaluation('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006a1',
  '{"criteria":{"Pembukaan":4}}', 55, '  Bagus, tambah parafrase.  ') $$, 'the class owner reviews');
select results_eq($$ select ai_score::int, final_score::int, reviewer_id, comment, override->'criteria'->>'Pembukaan' from public.evaluations
  where session_id = '00000000-0000-0000-0000-0000000006aa' $$,
  $$ values (40, 55, '00000000-0000-0000-0000-0000000006a1'::uuid, 'Bagus, tambah parafrase.', '4') $$, 'final score, reviewer, trimmed comment and override stored; ai score kept');

-- A later re-grade keeps the teacher's final score
update public.sessions set status = 'grading' where id = '00000000-0000-0000-0000-0000000006aa';
select lives_ok($$ select public.finish_grading('00000000-0000-0000-0000-0000000006aa', '{"facts":[]}', 10, 'm2', 'grader@1') $$, 're-grade stores a new AI result');
select results_eq($$ select ai_score::int, final_score::int from public.evaluations where session_id = '00000000-0000-0000-0000-0000000006aa' $$,
  $$ values (10, 55) $$, 'override survives a re-grade');

-- assignment_scores: best final score + attempts, visible to the learner and their class teacher only
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006b1","role":"authenticated"}', true);
select results_eq($$ select attempts, best_score from public.assignment_scores where assignment_id = '00000000-0000-0000-0000-0000000006f1' $$,
  $$ values (3, 72) $$, 'learner sees 3 attempts, best 72');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select is((select best_score from public.assignment_scores where user_id = '00000000-0000-0000-0000-0000000006b1'), 72, 'class teacher sees the best score');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select is((select count(*)::int from public.assignment_scores), 0, 'another teacher sees nothing');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006b2","role":"authenticated"}', true);
select is((select count(*)::int from public.assignment_scores), 0, 'another learner sees nothing');

-- Raising the override above the other attempt changes the best score
set local role service_role;
update public.sessions set status = 'graded' where id = '00000000-0000-0000-0000-0000000006aa';
select lives_ok($$ select public.review_evaluation('00000000-0000-0000-0000-0000000006aa', '00000000-0000-0000-0000-0000000006a1', '{"criteria":{}}', 90, '') $$, 'owner raises the final score');
select is((select comment from public.evaluations where session_id = '00000000-0000-0000-0000-0000000006aa'), null, 'an empty comment is stored as null');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006b1","role":"authenticated"}', true);
select is((select best_score from public.assignment_scores), 90, 'best score follows the final score');

-- anon has no access to the view
set local role anon;
select throws_ok($$ select * from public.assignment_scores $$, '42501', null, 'anon cannot read assignment_scores');

select * from finish();
rollback;
