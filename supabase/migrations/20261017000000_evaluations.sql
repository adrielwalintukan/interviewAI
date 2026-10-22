-- M4: AI grading result per session (US-P-08, docs/ai-design.md §3, docs/workflow.md §4).
-- ai_result holds fact ids / flags / levels only, never fact text: fact content stays in scenario_version_secrets.
-- Written only by the server (service role) through the RPCs below; override/review columns arrive with US-G-07.

create table public.evaluations (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  ai_result jsonb not null,
  ai_score smallint not null check (ai_score between 0 and 100),
  final_score smallint check (final_score between 0 and 100),
  override jsonb,
  reviewer_id uuid references public.profiles (id) on delete set null,
  comment text check (char_length(comment) <= 2000),
  grader_model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.evaluations enable row level security;

create policy "evaluations: owner or class teacher reads" on public.evaluations
  for select to authenticated using (public.can_read_session(session_id));
create policy "evaluations: admin reads" on public.evaluations
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.evaluations from authenticated, anon;

-- Moves a finished session to 'grading'. Also takes over sessions whose timer ran out without an
-- explicit end, retries after 'grading_failed', and reclaims a 'grading' run that died (10 min after the end).
-- Returns false when there is nothing to grade: still running, already graded, being graded right now,
-- or the learner never asked anything (such a session stays 'ended' and the report says it was not graded).
create function public.claim_grading(p_session_id uuid) returns boolean
language sql volatile security definer set search_path = ''
as $$
  with claimed as (
    update public.sessions
    set status = 'grading', ended_at = coalesce(ended_at, ends_at)
    where id = p_session_id
      and exists (select 1 from public.messages m where m.session_id = p_session_id and m.speaker = 'learner')
      and (
        status in ('ended', 'grading_failed')
        or (status = 'active' and ends_at + interval '1 minute' < now())
        or (status = 'grading' and ended_at < now() - interval '10 minutes')
      )
    returning 1
  )
  select exists (select 1 from claimed);
$$;

-- Stores the grader result (p_result not null) or marks the run failed (p_result null).
create function public.finish_grading(p_session_id uuid, p_result jsonb, p_score int, p_model text, p_prompt_version text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  -- Only the run that claimed the session may finish it.
  perform 1 from public.sessions where id = p_session_id and status = 'grading' for update;
  if not found then
    return;
  end if;
  if p_result is null then
    update public.sessions set status = 'grading_failed' where id = p_session_id;
    return;
  end if;
  insert into public.evaluations (session_id, ai_result, ai_score, final_score, grader_model, prompt_version)
  values (p_session_id, p_result, p_score, p_score, p_model, p_prompt_version)
  on conflict (session_id) do update
    set ai_result = excluded.ai_result, ai_score = excluded.ai_score,
        final_score = case when public.evaluations.override is null then excluded.ai_score else public.evaluations.final_score end,
        grader_model = excluded.grader_model, prompt_version = excluded.prompt_version, updated_at = now();
  update public.sessions set status = 'graded' where id = p_session_id;
end;
$$;

-- Server-only: the browser can never mark its own session graded.
revoke execute on function public.claim_grading(uuid), public.finish_grading(uuid, jsonb, int, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_grading(uuid), public.finish_grading(uuid, jsonb, int, text, text)
  to service_role;
