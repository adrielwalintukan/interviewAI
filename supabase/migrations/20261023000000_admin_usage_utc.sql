-- PR #36 review: admin_usage grouped days with ::date / current_date, which follow the connection's
-- TimeZone setting. Days are now explicit UTC calendar days, whatever the session timezone.
-- Same signature and grants (create or replace keeps them).

create or replace function public.admin_usage(p_days int default 14)
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
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_from timestamptz;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 90 then
    raise exception 'invalid_days' using errcode = '22023';
  end if;
  v_from := (v_today - (p_days - 1))::timestamp at time zone 'UTC';

  return query
  with d as (
    select (v_today - g)::date as day from generate_series(0, p_days - 1) as g
  ),
  s as (
    select (started_at at time zone 'UTC')::date as day, count(*)::int as n, (count(*) filter (where mode = 'fallback'))::int as fb
    from public.sessions
    where started_at >= v_from
    group by 1
  ),
  c as (
    select
      (created_at at time zone 'UTC')::date as day,
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
    where created_at >= v_from
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
