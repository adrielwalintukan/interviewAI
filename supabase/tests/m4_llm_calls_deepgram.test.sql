begin;

select plan(2);

set local role service_role;
select lives_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status) values
  ('tts', 'deepgram', 'flux-dewi-id', 800, 'ok') $$, 'deepgram logs a TTS attempt');
select throws_ok($$ insert into public.llm_calls (task, provider, model, latency_ms, status) values ('tts', 'elevenlabs', 'm', 1, 'ok') $$,
  '23514', null, 'unknown provider is still rejected');

select * from finish();
rollback;
