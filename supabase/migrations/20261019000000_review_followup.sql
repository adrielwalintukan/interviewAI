-- PR #27 review follow-up (US-G-07):
-- 1. The learner is notified when a teacher reviews their grade: reviewed_at vs review_seen_at.
-- 2. review_evaluation validates the override itself instead of trusting its service-role caller.
-- 3. finish_grading takes the final score from the server, which recomputes it from the stored override
--    on a re-grade (scores are computed in code, docs/ai-design.md §3) instead of keeping a stale one.

alter table public.evaluations
  add column reviewed_at timestamptz,
  add column review_seen_at timestamptz;

create or replace function public.review_evaluation(p_session_id uuid, p_reviewer uuid, p_override jsonb, p_final_score int, p_comment text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_rubric jsonb;
begin
  select sec.rubric into v_rubric
  from public.sessions s
  join public.profiles p on p.id = p_reviewer and p.status = 'active'
  join public.scenario_version_secrets sec on sec.version_id = s.scenario_version_id
  left join public.assignments a on a.id = s.assignment_id
  left join public.classes c on c.id = a.class_id
  where s.id = p_session_id and s.status = 'graded'
    and (p.role = 'admin' or (p.role = 'pengajar' and c.owner_id = p_reviewer));
  if v_rubric is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- Override = exactly one level 1..4 for every rubric criterion of this scenario version.
  if p_final_score is null or p_final_score not between 0 and 100
     or jsonb_typeof(p_override -> 'criteria') is distinct from 'object'
     or (select coalesce(array_agg(k order by k), '{}') from jsonb_object_keys(p_override -> 'criteria') k)
        is distinct from (select coalesce(array_agg(r ->> 'criterion' order by r ->> 'criterion'), '{}') from jsonb_array_elements(v_rubric) r)
     or exists (
       select 1 from jsonb_each(p_override -> 'criteria') e
       where jsonb_typeof(e.value) <> 'number' or e.value::text not in ('1', '2', '3', '4')
     )
  then
    raise exception 'bad_override' using errcode = '22023';
  end if;

  update public.evaluations
  set override = p_override, final_score = p_final_score, reviewer_id = p_reviewer,
      comment = nullif(trim(p_comment), ''), reviewed_at = now(), review_seen_at = null, updated_at = now()
  where session_id = p_session_id;
end;
$$;

-- New signature (adds p_final_score): drop the old one so no caller can keep using it.
drop function public.finish_grading(uuid, jsonb, int, text, text);

create function public.finish_grading(p_session_id uuid, p_result jsonb, p_score int, p_final_score int, p_model text, p_prompt_version text)
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
  values (p_session_id, p_result, p_score, p_final_score, p_model, p_prompt_version)
  on conflict (session_id) do update
    set ai_result = excluded.ai_result, ai_score = excluded.ai_score, final_score = excluded.final_score,
        grader_model = excluded.grader_model, prompt_version = excluded.prompt_version, updated_at = now();
  update public.sessions set status = 'graded' where id = p_session_id;
end;
$$;

-- The owner opened their report: clears the "nilai baru dari pengajar" notice.
create function public.mark_review_seen(p_session_id uuid) returns void
language sql volatile security definer set search_path = ''
as $$
  update public.evaluations e set review_seen_at = now()
  from public.sessions s
  where e.session_id = p_session_id and s.id = e.session_id and s.user_id = auth.uid() and e.reviewed_at is not null;
$$;

revoke execute on function public.review_evaluation(uuid, uuid, jsonb, int, text),
  public.finish_grading(uuid, jsonb, int, int, text, text) from public, anon, authenticated;
grant execute on function public.review_evaluation(uuid, uuid, jsonb, int, text),
  public.finish_grading(uuid, jsonb, int, int, text, text) to service_role;
revoke execute on function public.mark_review_seen(uuid) from public, anon;
grant execute on function public.mark_review_seen(uuid) to authenticated;
