-- Enforce domain rule: sessions cannot be started if class is archived (US-G-01).
create or replace function public.start_session(p_kind text, p_assignment_id uuid, p_version_id uuid, p_prompt_version text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_version uuid;
  v_minutes int;
  v_due timestamptz;
  v_max int;
  v_archived_at timestamptz;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform public.close_stale_sessions(v_uid);
  if exists (select 1 from public.sessions where user_id = v_uid and status = 'active') then
    raise exception 'active_session_exists' using errcode = 'P0001';
  end if;

  if p_kind = 'assignment' then
    select a.scenario_version_id, a.duration_min, a.due_at, a.max_attempts, c.archived_at
      into v_version, v_minutes, v_due, v_max, v_archived_at
    from public.assignments a
    join public.classes c on c.id = a.class_id
    join public.class_members m on m.class_id = a.class_id and m.user_id = v_uid
    join public.profiles p on p.id = v_uid and p.role = 'pelajar' and p.status = 'active'
    where a.id = p_assignment_id;
    if v_version is null then raise exception 'not_allowed' using errcode = '42501'; end if;
    if v_archived_at is not null then raise exception 'class_archived' using errcode = 'P0001'; end if;
    if v_due is not null and v_due < now() then raise exception 'past_due' using errcode = 'P0001'; end if;
    if (select count(*) from public.sessions where user_id = v_uid and assignment_id = p_assignment_id) >= v_max then
      raise exception 'no_attempts_left' using errcode = 'P0001';
    end if;

  elsif p_kind = 'library' then
    if not public.is_public_current_version(p_version_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
    -- shortcut: fixed quota of 3 practice sessions per learner per (UTC) day; make it configurable per institution later.
    if (select count(*) from public.sessions where user_id = v_uid and kind = 'library' and started_at >= date_trunc('day', now())) >= 3 then
      raise exception 'daily_quota' using errcode = 'P0001';
    end if;
    v_version := p_version_id;
    v_minutes := 15;

  elsif p_kind = 'preview' then
    if not (public.is_scenario_author(public.version_scenario_id(p_version_id)) and public.is_active_teacher()) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    v_version := p_version_id;
    v_minutes := 10;

  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;

  insert into public.sessions (user_id, kind, assignment_id, scenario_version_id, prompt_version, ends_at)
  values (v_uid, p_kind, case when p_kind = 'assignment' then p_assignment_id end, v_version, p_prompt_version,
          now() + make_interval(mins => v_minutes))
  returning id into v_id;
  return v_id;
end;
$$;
