-- LLM/voice call log (architecture §4 "Pencatatan", §10; ADR-003): one row per provider attempt.
-- Metadata only: never prompt text, transcript or secrets (security-privacy §2). Source of the admin
-- monitoring page (US-A-04) and of the pilot quota measurement.

create table public.llm_calls (
  id bigint generated always as identity primary key,
  task text not null check (task in ('chat', 'grader', 'generator', 'live', 'tts')),
  provider text not null check (provider in ('9router', 'gemini')),
  model text not null check (char_length(model) <= 200),
  latency_ms int not null check (latency_ms >= 0),
  -- ok; timeout; fallback = failed and the next provider was tried; error = failed, nothing left to try
  status text not null check (status in ('ok', 'error', 'timeout', 'fallback')),
  tokens_in int check (tokens_in >= 0),
  tokens_out int check (tokens_out >= 0),
  -- Learner data: deleting a session (or its learner) deletes its log rows.
  session_id uuid references public.sessions (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index llm_calls_created_at_idx on public.llm_calls (created_at);
create index llm_calls_session_id_idx on public.llm_calls (session_id);

alter table public.llm_calls enable row level security;

create policy "llm_calls: admin reads" on public.llm_calls
  for select to authenticated using (public.is_admin());

-- Written by the server with the service role only (it bypasses RLS).
revoke all on public.llm_calls from public, anon, authenticated;
grant select on public.llm_calls to authenticated;
