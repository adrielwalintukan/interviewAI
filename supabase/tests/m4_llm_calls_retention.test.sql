begin;

select plan(7);

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000008a1', 'authenticated', 'authenticated', 'rg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000008b1', 'authenticated', 'authenticated', 'rs@test.local', '{}', '{"display_name":"Siswa"}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000008a1';
insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-0000000008d1', '00000000-0000-0000-0000-0000000008a1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008d1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');
insert into public.sessions (id, user_id, kind, scenario_version_id, status, prompt_version, started_at, ends_at) values
  ('00000000-0000-0000-0000-0000000008aa', '00000000-0000-0000-0000-0000000008b1', 'library', '00000000-0000-0000-0000-0000000008e1', 'active', 'persona@2', now(), now() + interval '15 minutes');

set local role service_role;
-- Non-provider outcomes have their own statuses
select lives_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status, session_id) values
  ('live', 'gemini', 'live-m', 0, 'busy', '00000000-0000-0000-0000-0000000008aa'),
  ('tts', 'gemini', '', 0, 'unconfigured', '00000000-0000-0000-0000-0000000008aa') $$, 'busy and unconfigured are accepted');
select throws_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status) values ('live', 'gemini', 'm', 0, 'skipped') $$,
  '23514', null, 'other statuses are still rejected');

-- Retention: session-less rows older than 1 year go; recent ones and session rows stay
insert into public.llm_calls (task, provider, model, latency_ms, status, session_id, created_at) values
  ('generator', '9router', 'old', 1, 'ok', null, now() - interval '1 year 1 day'),
  ('generator', '9router', 'recent', 1, 'ok', null, now() - interval '364 days'),
  ('chat', '9router', 'old-session', 1, 'ok', '00000000-0000-0000-0000-0000000008aa', now() - interval '2 years');
select is(public.purge_llm_calls(), 1, 'purge deletes exactly the old session-less row');
select results_eq($$ select model from public.llm_calls where task in ('generator', 'chat') order by model $$,
  $$ values ('old-session'::text), ('recent'::text) $$, 'recent and session rows are kept');
select is(public.purge_llm_calls(), 0, 'purge is idempotent');

-- Only the server may run it
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}', true);
select throws_ok($$ select public.purge_llm_calls() $$, '42501', null, 'authenticated cannot purge');
set local role anon;
select throws_ok($$ select public.purge_llm_calls() $$, '42501', null, 'anon cannot purge');

select * from finish();
rollback;
