-- M4: teacher review & override (US-G-07) and the single "best score per assignment" source (PRD §5)
-- that the class dashboard (US-G-08) and CSV export (US-G-09) read.

-- Stores a teacher's per-criterion override and the final score the server recomputed from it
-- (docs/ai-design.md §3: scores are computed in code). Service role only; the server checks the
-- reviewer first, and this re-checks it so a wrong caller can never write a grade.
create function public.review_evaluation(p_session_id uuid, p_reviewer uuid, p_override jsonb, p_final_score int, p_comment text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions s
    join public.profiles p on p.id = p_reviewer and p.status = 'active'
    left join public.assignments a on a.id = s.assignment_id
    left join public.classes c on c.id = a.class_id
    where s.id = p_session_id and s.status = 'graded'
      and (p.role = 'admin' or (p.role = 'pengajar' and c.owner_id = p_reviewer))
  ) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.evaluations
  set override = p_override, final_score = p_final_score, reviewer_id = p_reviewer,
      comment = nullif(trim(p_comment), ''), updated_at = now()
  where session_id = p_session_id;
end;
$$;

revoke execute on function public.review_evaluation(uuid, uuid, jsonb, int, text) from public, anon, authenticated;
grant execute on function public.review_evaluation(uuid, uuid, jsonb, int, text) to service_role;

-- Best final score per learner per assignment, plus attempts used. security_invoker: callers only
-- see rows their sessions/evaluations RLS already allows (own rows, or the classes they teach).
create view public.assignment_scores with (security_invoker = true) as
select s.assignment_id, s.user_id, count(*)::int as attempts, max(e.final_score)::int as best_score
from public.sessions s
left join public.evaluations e on e.session_id = s.id
where s.kind = 'assignment' and s.assignment_id is not null
group by s.assignment_id, s.user_id;

grant select on public.assignment_scores to authenticated;
revoke all on public.assignment_scores from anon;
