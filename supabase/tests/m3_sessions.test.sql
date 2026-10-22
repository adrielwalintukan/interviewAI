begin;

select plan(29);

select has_table('public', 'sessions', 'sessions exists');
select has_table('public', 'messages', 'messages exists');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003a1', 'authenticated', 'authenticated', 'g@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000003a2', 'authenticated', 'authenticated', 'g2@test.local', '{}', '{"display_name":"Guru 2","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000003b1', 'authenticated', 'authenticated', 's1@test.local', '{}', '{"display_name":"Siswa 1"}'),
  ('00000000-0000-0000-0000-0000000003b2', 'authenticated', 'authenticated', 's2@test.local', '{}', '{"display_name":"Siswa 2"}');
update public.profiles set status = 'active' where id in ('00000000-0000-0000-0000-0000000003a1', '00000000-0000-0000-0000-0000000003a2');
insert into public.classes (id, owner_id, name, join_code) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003a1', 'K', 'SESIAA');
insert into public.class_members (class_id, user_id) values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003b1');
insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-0000000003d1', '00000000-0000-0000-0000-0000000003a1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-0000000003e1', '00000000-0000-0000-0000-0000000003d1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');
update public.scenarios set current_version_id = '00000000-0000-0000-0000-0000000003e1' where id = '00000000-0000-0000-0000-0000000003d1';
insert into public.assignments (id, class_id, scenario_version_id, duration_min, max_attempts)
  values ('00000000-0000-0000-0000-0000000003f1', '00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003e1', 15, 2);

-- Learner 1 starts an assignment session
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003b1","role":"authenticated"}', true);
select lives_ok($$ select public.start_session('assignment', '00000000-0000-0000-0000-0000000003f1', null, 'persona@1') $$, 'member starts session');
-- Pin the id (no turns yet) so other roles can reference it without reading the table.
set local role postgres;
update public.sessions set id = '00000000-0000-0000-0000-0000000003aa';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003b1","role":"authenticated"}', true);
select is((select count(*)::int from public.sessions where status = 'active'), 1, 'one active session, readable by owner');
select throws_ok($$ select public.start_session('assignment', '00000000-0000-0000-0000-0000000003f1', null, 'persona@1') $$,
  'P0001', 'active_session_exists', 'cannot start a second concurrent session');
select throws_ok($$ insert into public.messages (session_id, seq, speaker, text) select id, 1, 'learner', 'x' from public.sessions $$,
  '42501', null, 'no direct insert into messages');

-- Turns get sequential numbers
select is(public.append_message('00000000-0000-0000-0000-0000000003aa', 'learner', '  Selamat siang, Bu.  '), 1, 'first turn is seq 1');
select is(public.append_message('00000000-0000-0000-0000-0000000003aa', 'character', 'Siang.'), 2, 'second turn is seq 2');
select is((select text from public.messages where seq = 1), 'Selamat siang, Bu.', 'turn text is trimmed');

-- Another learner cannot write to or read this session
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003b2","role":"authenticated"}', true);
select throws_ok($$ select public.append_message('00000000-0000-0000-0000-0000000003aa', 'learner', 'nyusup') $$, 'P0001', 'session_closed', 'non-owner cannot append');
select is_empty($$ select seq from public.messages $$, 'non-owner cannot read transcript');
select throws_ok($$ select public.start_session('assignment', '00000000-0000-0000-0000-0000000003f1', null, 'persona@1') $$,
  '42501', 'not_allowed', 'non-member cannot start the assignment');

-- Class teacher reads the transcript; another teacher does not
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003a1","role":"authenticated"}', true);
select is((select count(*)::int from public.messages), 2, 'class teacher reads transcript');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003a2","role":"authenticated"}', true);
select is_empty($$ select seq from public.messages $$, 'other teacher cannot read transcript');

-- Live slots are capped
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003b1","role":"authenticated"}', true);
select is(public.claim_live_slot('00000000-0000-0000-0000-0000000003aa', 0), false, 'no slot when cap is reached');
select is(public.claim_live_slot('00000000-0000-0000-0000-0000000003aa', 5), true, 'slot claimed under the cap');
select is((select mode from public.sessions), 'live', 'session flipped to live');

-- End, then attempts: 2 allowed, 1 used
select lives_ok($$ select public.end_session('00000000-0000-0000-0000-0000000003aa') $$, 'owner ends session');
select throws_ok($$ select public.append_message('00000000-0000-0000-0000-0000000003aa', 'learner', 'telat') $$, 'P0001', 'session_closed', 'no turns after end');
select lives_ok($$ select public.end_session(public.start_session('assignment', '00000000-0000-0000-0000-0000000003f1', null, 'persona@1')) $$, 'second attempt');
select throws_ok($$ select public.start_session('assignment', '00000000-0000-0000-0000-0000000003f1', null, 'persona@1') $$,
  'P0001', 'no_attempts_left', 'third attempt refused');

-- Deadline
set local role postgres;
update public.assignments set max_attempts = 10, due_at = now() - interval '1 hour';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003b1","role":"authenticated"}', true);
select throws_ok($$ select public.start_session('assignment', '00000000-0000-0000-0000-0000000003f1', null, 'persona@1') $$,
  'P0001', 'past_due', 'past-due assignment refused');

-- Archived class (US-G-01 invariant)
set local role postgres;
update public.assignments set due_at = null;
update public.classes set archived_at = now() where id = '00000000-0000-0000-0000-0000000003c1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003b1","role":"authenticated"}', true);
select throws_ok($$ select public.start_session('assignment', '00000000-0000-0000-0000-0000000003f1', null, 'persona@1') $$,
  'P0001', 'class_archived', 'archived class assignment refused');

-- Teacher cannot create assignment in archived class
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003a1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.assignments (class_id, scenario_version_id, duration_min, max_attempts)
     values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003e1', 15, 2) $$,
  '42501', null, 'cannot create assignment in archived class'
);

-- Unarchive class
set local role postgres;
update public.classes set archived_at = null where id = '00000000-0000-0000-0000-0000000003c1';
set local role authenticated;
-- Teacher can create assignment after unarchive
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003a1","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.assignments (class_id, scenario_version_id, duration_min, max_attempts)
     values ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003e1', 15, 2) $$,
  'teacher creates assignment after unarchive'
);
-- Student can start session after unarchive
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003b1","role":"authenticated"}', true);
select lives_ok($$ select public.end_session(public.start_session('assignment', '00000000-0000-0000-0000-0000000003f1', null, 'persona@1')) $$,
  'unarchived class assignment permitted');

-- Library needs a public version; preview needs the author
select throws_ok($$ select public.start_session('library', null, '00000000-0000-0000-0000-0000000003e1', 'persona@1') $$,
  '42501', 'not_allowed', 'private version is not in the library');
select throws_ok($$ select public.start_session('preview', null, '00000000-0000-0000-0000-0000000003e1', 'persona@1') $$,
  '42501', 'not_allowed', 'learner cannot preview');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003a1","role":"authenticated"}', true);
select lives_ok($$ select public.start_session('preview', null, '00000000-0000-0000-0000-0000000003e1', 'persona@1') $$, 'author previews own scenario');

select * from finish();
rollback;
