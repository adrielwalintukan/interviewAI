-- M3: sesi wawancara + transkrip per giliran (US-P-03..07, US-G-04, US-P-09).
-- All writes go through security-definer RPCs so attempts, deadlines, quotas and turn order are atomic.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('assignment', 'library', 'preview')),
  assignment_id uuid references public.assignments (id) on delete set null,
  scenario_version_id uuid not null references public.scenario_versions (id) on delete cascade,
  mode text not null default 'fallback' check (mode in ('live', 'fallback')),
  status text not null default 'active' check (status in ('active', 'ended', 'grading', 'graded', 'grading_failed')),
  prompt_version text not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz -- assignment_id may become null if the teacher deletes the assignment; the session stays
);

create index sessions_user_idx on public.sessions (user_id, started_at desc);
create index sessions_assignment_idx on public.sessions (assignment_id);
create index sessions_live_active_idx on public.sessions (started_at) where mode = 'live' and status = 'active';

create table public.messages (
  session_id uuid not null references public.sessions (id) on delete cascade,
  seq integer not null check (seq > 0),
  speaker text not null check (speaker in ('learner', 'character')),
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now(),
  primary key (session_id, seq)
);

alter table public.sessions enable row level security;
alter table public.messages enable row level security;

create function public.can_read_session(p_session_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    left join public.assignments a on a.id = s.assignment_id
    left join public.classes c on c.id = a.class_id
    where s.id = p_session_id
      and (s.user_id = auth.uid() or c.owner_id = auth.uid())
  );
$$;

create policy "sessions: owner or class teacher reads" on public.sessions
  for select to authenticated using (public.can_read_session(id));
create policy "sessions: admin reads" on public.sessions
  for select to authenticated using (public.is_admin());
create policy "messages: owner or class teacher reads" on public.messages
  for select to authenticated using (public.can_read_session(session_id));
create policy "messages: admin reads" on public.messages
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.sessions, public.messages from authenticated, anon;

-- Sessions past ends_at (+1 min grace) are closed lazily whenever their owner starts or writes.
create function public.close_stale_sessions(p_user_id uuid) returns void
language sql volatile security definer set search_path = ''
as $$
  update public.sessions set status = 'ended', ended_at = ends_at
  where user_id = p_user_id and status = 'active' and ends_at + interval '1 minute' < now();
$$;
revoke execute on function public.close_stale_sessions(uuid) from public, anon, authenticated;

-- Starts a session and spends an attempt (PRD §6: counted at start, not at the end).
-- Exactly one of p_assignment_id / p_version_id. p_kind: 'assignment' | 'library' | 'preview'.
create function public.start_session(p_kind text, p_assignment_id uuid, p_version_id uuid, p_prompt_version text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_version uuid;
  v_minutes int;
  v_due timestamptz;
  v_max int;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform public.close_stale_sessions(v_uid);
  if exists (select 1 from public.sessions where user_id = v_uid and status = 'active') then
    raise exception 'active_session_exists' using errcode = 'P0001';
  end if;

  if p_kind = 'assignment' then
    select a.scenario_version_id, a.duration_min, a.due_at, a.max_attempts
      into v_version, v_minutes, v_due, v_max
    from public.assignments a
    join public.class_members m on m.class_id = a.class_id and m.user_id = v_uid
    join public.profiles p on p.id = v_uid and p.role = 'pelajar' and p.status = 'active'
    where a.id = p_assignment_id;
    if v_version is null then raise exception 'not_allowed' using errcode = '42501'; end if;
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

-- Appends the next turn. Owner only, while active (1 min grace after ends_at), max 30 turns/minute.
create function public.append_message(p_session_id uuid, p_speaker text, p_text text) returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_seq int;
begin
  -- Row lock serialises concurrent appends so seq stays gapless.
  perform 1 from public.sessions
  where id = p_session_id and user_id = auth.uid() and status = 'active' and ends_at + interval '1 minute' > now()
  for update;
  if not found then
    raise exception 'session_closed' using errcode = 'P0001';
  end if;
  if (select count(*) from public.messages where session_id = p_session_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select coalesce(max(seq), 0) + 1 into v_seq from public.messages where session_id = p_session_id;
  insert into public.messages (session_id, seq, speaker, text) values (p_session_id, v_seq, p_speaker, left(trim(p_text), 2000));
  return v_seq;
end;
$$;

create function public.end_session(p_session_id uuid) returns void
language sql volatile security definer set search_path = ''
as $$
  update public.sessions set status = 'ended', ended_at = least(now(), ends_at + interval '1 minute')
  where id = p_session_id and user_id = auth.uid() and status = 'active';
$$;

-- Live is capped per project (free tier ≈ 6 concurrent, docs/architecture.md §3.1); the server
-- asks this before minting a token and flips the session to 'live' in the same call.
create function public.claim_live_slot(p_session_id uuid, p_max int) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('live_slots'));
  if (select count(*) from public.sessions where mode = 'live' and status = 'active' and ends_at > now()) >= p_max then
    return false;
  end if;
  update public.sessions set mode = 'live'
  where id = p_session_id and user_id = auth.uid() and status = 'active' and ends_at > now();
  return found;
end;
$$;

create function public.release_live_slot(p_session_id uuid) returns void
language sql volatile security definer set search_path = ''
as $$
  update public.sessions set mode = 'fallback' where id = p_session_id and user_id = auth.uid();
$$;

revoke execute on function
  public.start_session(text, uuid, uuid, text), public.append_message(uuid, text, text), public.end_session(uuid),
  public.claim_live_slot(uuid, int), public.release_live_slot(uuid)
  from public, anon;
grant execute on function
  public.start_session(text, uuid, uuid, text), public.append_message(uuid, text, text), public.end_session(uuid),
  public.claim_live_slot(uuid, int), public.release_live_slot(uuid)
  to authenticated;
