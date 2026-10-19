-- PR #35 review follow-up (#11):
-- 1. Record the Live/TTS requests that never reached a provider, under their own status so they don't
--    pass for provider calls: `busy` (no free Live slot, learner goes to Fallback mode) and
--    `unconfigured` (Live/TTS env not set). They feed US-A-04's fallback percentage.
-- 2. Retention for rows without a session (generator): 1 year (owner decision 2026-10-18). Rows with a
--    session are deleted with it. Scheduled monthly by the retention job (#15).

alter table public.llm_calls drop constraint llm_calls_status_check;
alter table public.llm_calls add constraint llm_calls_status_check
  check (status in ('ok', 'error', 'timeout', 'fallback', 'busy', 'unconfigured'));

create function public.purge_llm_calls() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.llm_calls where session_id is null and created_at < now() - interval '1 year';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_llm_calls() from public, anon, authenticated;
grant execute on function public.purge_llm_calls() to service_role;
