-- #15: retention (docs/security-privacy.md §3). Transcripts and evaluations of assignments in a class
-- archived more than 1 year ago are deleted (sessions → messages, evaluations, llm_calls cascade).
-- The class, its members and assignments stay. Runs monthly with pg_cron (Supabase Cron), together
-- with purge_llm_calls(); no route or secret is involved.

alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('delete_student', 'purge_archived_sessions'));

-- target = number of deleted sessions; actor_id stays null (system job). No personal data.
create function public.purge_archived_class_sessions() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count int;
begin
  delete from public.sessions s
  using public.assignments a, public.classes c
  where s.assignment_id = a.id and a.class_id = c.id and c.archived_at < now() - interval '1 year';
  get diagnostics v_count = row_count;
  insert into public.audit_log (actor_id, action, target) values (null, 'purge_archived_sessions', v_count::text);
  return v_count;
end;
$$;

revoke execute on function public.purge_archived_class_sessions() from public, anon, authenticated;
grant execute on function public.purge_archived_class_sessions() to service_role;

-- https://supabase.com/docs/guides/cron/install
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- 03:00 on the 1st of every month (pg_cron uses the database clock, UTC). Same name = upsert.
select cron.schedule(
  'monthly-retention',
  '0 3 1 * *',
  'select public.purge_archived_class_sessions(); select public.purge_llm_calls();'
);
