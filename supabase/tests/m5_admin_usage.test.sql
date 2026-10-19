begin;

select plan(11);

set local timezone = 'UTC';

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000009a1', 'authenticated', 'authenticated', 'ug@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000009b1', 'authenticated', 'authenticated', 'us@test.local', '{}', '{"display_name":"Siswa"}'),
  ('00000000-0000-0000-0000-0000000009ad', 'authenticated', 'authenticated', 'ua@test.local', '{}', '{"display_name":"Admin"}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000009a1';
update public.profiles set role = 'admin', status = 'active' where id = '00000000-0000-0000-0000-0000000009ad';
insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-0000000009d1', '00000000-0000-0000-0000-0000000009a1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-0000000009e1', '00000000-0000-0000-0000-0000000009d1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');

-- Today: 1 live + 2 fallback sessions. Yesterday: 2 fallback (one at 20:00 UTC, already "today" in WIB).
-- 20 days ago: 1 (outside the 14-day window).
insert into public.sessions (user_id, kind, scenario_version_id, mode, status, prompt_version, started_at, ends_at) values
  ('00000000-0000-0000-0000-0000000009b1', 'library', '00000000-0000-0000-0000-0000000009e1', 'live', 'ended', 'persona@2', now(), now()),
  ('00000000-0000-0000-0000-0000000009b1', 'library', '00000000-0000-0000-0000-0000000009e1', 'fallback', 'ended', 'persona@2', now(), now()),
  ('00000000-0000-0000-0000-0000000009b1', 'library', '00000000-0000-0000-0000-0000000009e1', 'fallback', 'ended', 'persona@2', now(), now()),
  ('00000000-0000-0000-0000-0000000009b1', 'library', '00000000-0000-0000-0000-0000000009e1', 'fallback', 'ended', 'persona@2', now() - interval '1 day', now()),
  ('00000000-0000-0000-0000-0000000009b1', 'library', '00000000-0000-0000-0000-0000000009e1', 'fallback', 'ended', 'persona@2', date_trunc('day', now(), 'UTC') - interval '4 hours', now()),
  ('00000000-0000-0000-0000-0000000009b1', 'library', '00000000-0000-0000-0000-0000000009e1', 'live', 'ended', 'persona@2', now() - interval '20 days', now());

insert into public.llm_calls (task, provider, model, latency_ms, status, created_at) values
  ('chat', '9router', 'm', 1, 'fallback', now()),   -- 9router failed, fell back: a 9router error, and a chat call
  ('chat', 'gemini', 'g', 1, 'ok', now()),
  ('chat', '9router', 'm', 1, 'ok', now()),
  ('grader', 'gemini', 'g', 1, 'timeout', now()),
  ('generator', '9router', 'm', 1, 'error', now()),
  ('live', 'gemini', 'l', 1, 'ok', now()),
  ('live', 'gemini', 'l', 0, 'busy', now()),       -- never reached a provider: not a call
  ('tts', 'gemini', '', 0, 'unconfigured', now()), -- idem
  ('tts', 'gemini', 't', 1, 'ok', now() - interval '1 day');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009ad","role":"authenticated"}', true);
select is((select count(*)::int from public.admin_usage(14)), 14, 'one row per day for 14 days, empty days included');
select results_eq(
  $$ select sessions, fallback_sessions, chat, grader, generator, live, tts, router_errors, router_timeouts, gemini_errors, gemini_timeouts
     from public.admin_usage(14) where day = (now() at time zone 'UTC')::date $$,
  $$ values (3, 2, 3, 1, 1, 1, 0, 2, 0, 0, 1) $$,
  'today: sessions, fallback share, calls per task (busy/unconfigured excluded), errors/timeouts per provider');
select results_eq(
  $$ select sessions, fallback_sessions, tts from public.admin_usage(14) where day = (now() at time zone 'UTC')::date - 1 $$,
  $$ values (2, 2, 1) $$, 'yesterday counted on its own UTC day');
select is((select sum(sessions)::int from public.admin_usage(14)), 5, 'sessions older than the window are left out');
select is((select max(day) from public.admin_usage(14)), (now() at time zone 'UTC')::date, 'newest day is today in UTC');
select throws_ok($$ select * from public.admin_usage(0) $$, '22023', null, 'window must be 1..90 days');

-- Days are UTC whatever the connection's timezone (PR #36 review)
set local role postgres;
create temp table utc_usage as select * from public.admin_usage(14);
set local timezone = 'Asia/Jakarta';
select results_eq($$ select * from public.admin_usage(14) $$, $$ select * from utc_usage $$, 'same result with session timezone Asia/Jakarta');
set local timezone = 'America/Los_Angeles';
select results_eq($$ select * from public.admin_usage(14) $$, $$ select * from utc_usage $$, 'same result with session timezone America/Los_Angeles');
set local timezone = 'UTC';
set local role authenticated;

-- Only admins
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009a1","role":"authenticated"}', true);
select throws_ok($$ select * from public.admin_usage(14) $$, '42501', null, 'teacher is refused');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000009b1","role":"authenticated"}', true);
select throws_ok($$ select * from public.admin_usage(14) $$, '42501', null, 'learner is refused');
set local role anon;
select throws_ok($$ select * from public.admin_usage(14) $$, '42501', null, 'anon is refused');

select * from finish();
rollback;
