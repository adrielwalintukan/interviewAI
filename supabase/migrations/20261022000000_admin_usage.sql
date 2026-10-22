-- US-A-04 (#22): daily usage for the Admin page, aggregated in Postgres (group by day), never raw rows.
-- Security invoker: the caller's RLS still applies (sessions/llm_calls "admin reads"), plus an explicit
-- admin check so non-admins get an error instead of silently empty numbers.
-- Days follow the database clock (UTC), the same boundary as the library daily quota (start_session).
-- Calls = provider attempts (ok/error/timeout/fallback); busy/unconfigured never reached a provider.
-- Provider errors = error + fallback (a fallback row is a failed attempt at that provider); timeouts apart.

create function public.admin_usage(p_days int default 14)
returns table (
  day date,
  sessions int,
  fallback_sessions int,
  chat int,
  grader int,
  generator int,
  live int,
  tts int,
  router_errors int,
  router_timeouts int,
  gemini_errors int,
  gemini_timeouts int
)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 90 then
    raise exception 'invalid_days' using errcode = '22023';
  end if;

  return query
  with d as (
    select (current_date - g)::date as day from generate_series(0, p_days - 1) as g
  ),
  s as (
    select started_at::date as day, count(*)::int as n, (count(*) filter (where mode = 'fallback'))::int as fb
    from public.sessions
    where started_at >= current_date - (p_days - 1)
    group by 1
  ),
  c as (
    select
      created_at::date as day,
      (count(*) filter (where task = 'chat' and status in ('ok', 'error', 'timeout', 'fallback')))::int as chat,
      (count(*) filter (where task = 'grader' and status in ('ok', 'error', 'timeout', 'fallback')))::int as grader,
      (count(*) filter (where task = 'generator' and status in ('ok', 'error', 'timeout', 'fallback')))::int as generator,
      (count(*) filter (where task = 'live' and status in ('ok', 'error', 'timeout', 'fallback')))::int as live,
      (count(*) filter (where task = 'tts' and status in ('ok', 'error', 'timeout', 'fallback')))::int as tts,
      (count(*) filter (where provider = '9router' and status in ('error', 'fallback')))::int as re,
      (count(*) filter (where provider = '9router' and status = 'timeout'))::int as rt,
      (count(*) filter (where provider = 'gemini' and status in ('error', 'fallback')))::int as ge,
      (count(*) filter (where provider = 'gemini' and status = 'timeout'))::int as gt
    from public.llm_calls
    where created_at >= current_date - (p_days - 1)
    group by 1
  )
  select d.day, coalesce(s.n, 0), coalesce(s.fb, 0),
    coalesce(c.chat, 0), coalesce(c.grader, 0), coalesce(c.generator, 0), coalesce(c.live, 0), coalesce(c.tts, 0),
    coalesce(c.re, 0), coalesce(c.rt, 0), coalesce(c.ge, 0), coalesce(c.gt, 0)
  from d
  left join s on s.day = d.day
  left join c on c.day = d.day
  order by d.day desc;
end;
$$;

revoke execute on function public.admin_usage(int) from public, anon;
grant execute on function public.admin_usage(int) to authenticated;
