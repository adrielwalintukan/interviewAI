begin;

select plan(12);

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000004a1', 'authenticated', 'authenticated', 'tg@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}'),
  ('00000000-0000-0000-0000-0000000004b1', 'authenticated', 'authenticated', 'ts1@test.local', '{}', '{"display_name":"Siswa 1"}'),
  ('00000000-0000-0000-0000-0000000004b2', 'authenticated', 'authenticated', 'ts2@test.local', '{}', '{"display_name":"Siswa 2"}');
insert into public.scenarios (id, author_id, title) values ('00000000-0000-0000-0000-0000000004d1', '00000000-0000-0000-0000-0000000004a1', 'S');
insert into public.scenario_versions (id, scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values ('00000000-0000-0000-0000-0000000004e1', '00000000-0000-0000-0000-0000000004d1', 1, 'S', 'id', 'smk', 'Analis', 'Gali', 'Bu Ratna', 'Laundry', 'ratna');
insert into public.sessions (id, user_id, kind, scenario_version_id, prompt_version, ends_at)
  values ('00000000-0000-0000-0000-0000000004aa', '00000000-0000-0000-0000-0000000004b1', 'library', '00000000-0000-0000-0000-0000000004e1', 'persona@1', now() + interval '15 minutes');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004b1","role":"authenticated"}', true);
select lives_ok($$ select public.append_message('00000000-0000-0000-0000-0000000004aa', 'character', 'Selamat pagi.') $$, 'character says: Selamat pagi.');

-- Another learner gets nothing and does not consume the reply
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004b2","role":"authenticated"}', true);
select is(public.claim_tts('00000000-0000-0000-0000-0000000004aa'), null, 'non-owner cannot claim TTS');

-- Owner gets each character reply exactly once
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004b1","role":"authenticated"}', true);
select is(public.claim_tts('00000000-0000-0000-0000-0000000004aa'), 'Selamat pagi.', 'owner claims the latest character reply');
select is(public.claim_tts('00000000-0000-0000-0000-0000000004aa'), null, 'the same reply cannot be spoken twice');

-- Only the latest turn counts: once the learner speaks, there is nothing to speak
select lives_ok($$ select public.append_message('00000000-0000-0000-0000-0000000004aa', 'learner', 'Boleh cerita?') $$, 'learner says: Boleh cerita?');
select is(public.claim_tts('00000000-0000-0000-0000-0000000004aa'), null, 'learner turn is never spoken');
select lives_ok($$ select public.append_message('00000000-0000-0000-0000-0000000004aa', 'character', 'Tentu.') $$, 'character says: Tentu.');
select is(public.claim_tts('00000000-0000-0000-0000-0000000004aa'), 'Tentu.', 'next character reply is claimable');

-- No direct writes to the marker (RLS has no update policy: the update touches nothing)
update public.messages set spoken_at = null;
select is(public.claim_tts('00000000-0000-0000-0000-0000000004aa'), null, 'direct update cannot reset the marker');

-- Closed sessions speak nothing
select lives_ok($$ select public.append_message('00000000-0000-0000-0000-0000000004aa', 'character', 'Sampai jumpa.') $$, 'character says: Sampai jumpa.');
select lives_ok($$ select public.end_session('00000000-0000-0000-0000-0000000004aa') $$, 'owner ends session');
select is(public.claim_tts('00000000-0000-0000-0000-0000000004aa'), null, 'ended session cannot claim TTS');

select * from finish();
rollback;
