-- Mode hemat voice (ADR-002 amendment): each character reply may be sent to Gemini TTS at most once,
-- so a learner can't burn the TTS quota by replaying the same reply.

alter table public.messages add column spoken_at timestamptz;

-- Returns the text of the session's latest turn iff it is an unspoken character reply, and marks it spoken.
-- null ⇒ nothing to speak (not the owner, session closed, latest turn is the learner's, or already spoken).
create function public.claim_tts(p_session_id uuid) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_text text;
begin
  perform 1 from public.sessions
  where id = p_session_id and user_id = auth.uid() and status = 'active' and ends_at + interval '1 minute' > now()
  for update;
  if not found then
    return null;
  end if;
  update public.messages m set spoken_at = now()
  where m.session_id = p_session_id and m.speaker = 'character' and m.spoken_at is null
    and m.seq = (select max(seq) from public.messages where session_id = p_session_id)
  returning m.text into v_text;
  return v_text;
end;
$$;

revoke execute on function public.claim_tts(uuid) from public, anon;
grant execute on function public.claim_tts(uuid) to authenticated;
