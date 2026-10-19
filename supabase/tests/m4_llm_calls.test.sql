begin;

select plan(11);

select has_table('public', 'llm_calls', 'llm_calls exists');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007a1', 'authenticated', 'authenticated', 'lg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000007b1', 'authenticated', 'authenticated', 'ls@test.local', '{}', '{"display_name":"Siswa"}'),
  ('00000000-0000-0000-0000-0000000007ad', 'authenticated', 'authenticated', 'la@test.local', '{}', '{"display_name":"Admin"}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000007a1';
update public.profiles set role = 'admin', status = 'active' where id = '00000000-0000-0000-0000-0000000007ad';
insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-0000000007d1', '00000000-0000-0000-0000-0000000007a1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-0000000007e1', '00000000-0000-0000-0000-0000000007d1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');
insert into public.sessions (id, user_id, kind, scenario_version_id, status, prompt_version, started_at, ends_at) values
  ('00000000-0000-0000-0000-0000000007aa', '00000000-0000-0000-0000-0000000007b1', 'library', '00000000-0000-0000-0000-0000000007e1', 'active', 'persona@2', now(), now() + interval '15 minutes');

-- The server writes with the service role
set local role service_role;
select lives_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status, tokens_in, tokens_out, session_id) values
  ('chat', '9router', 'm', 120, 'fallback', null, null, '00000000-0000-0000-0000-0000000007aa'),
  ('chat', 'gemini', 'g', 300, 'ok', 50, 20, '00000000-0000-0000-0000-0000000007aa'),
  ('generator', '9router', 'm', 900, 'ok', 400, 900, null) $$, 'service role logs calls');
select throws_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status) values ('chat', 'openai', 'm', 1, 'ok') $$,
  '23514', null, 'unknown provider is rejected');
select throws_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status) values ('chat', 'gemini', 'm', 1, 'slow') $$,
  '23514', null, 'unknown status is rejected');

-- Only admins read it; nobody writes from the browser
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007b1","role":"authenticated"}', true);
select is((select count(*)::int from public.llm_calls), 0, 'learner (owner of the session) reads nothing');
select throws_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status) values ('chat', 'gemini', 'm', 1, 'ok') $$,
  '42501', null, 'learner cannot insert');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);
select is((select count(*)::int from public.llm_calls), 0, 'teacher reads nothing');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007ad","role":"authenticated"}', true);
select is((select count(*)::int from public.llm_calls), 3, 'admin reads every call');
select throws_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status) values ('chat', 'gemini', 'm', 1, 'ok') $$,
  '42501', null, 'admin cannot insert from the browser either');

set local role anon;
select throws_ok($$ select * from public.llm_calls $$, '42501', null, 'anon cannot read');

-- Deleting the session deletes its log rows (learner data); calls without a session stay
set local role postgres;
delete from public.sessions where id = '00000000-0000-0000-0000-0000000007aa';
select results_eq($$ select task from public.llm_calls $$, $$ values ('generator'::text) $$, 'session rows cascade, session-less row kept');

select * from finish();
rollback;
