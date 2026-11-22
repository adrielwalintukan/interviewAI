-- Deepgram TTS is the backup voice for mode hemat (architecture §3.2, ADR-002 amendment): when Gemini TTS
-- fails on quota/429/outage the same reply is spoken by Deepgram Flux TTS. Log rows for it need their own
-- provider value; the admin usage page groups per provider (9router, gemini), so it ignores the new one.

alter table public.llm_calls drop constraint llm_calls_provider_check;
alter table public.llm_calls add constraint llm_calls_provider_check
  check (provider in ('9router', 'gemini', 'deepgram'));
