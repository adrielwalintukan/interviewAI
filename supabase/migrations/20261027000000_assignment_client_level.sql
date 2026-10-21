-- Issue #49: how open the client is in an assignment's sessions (persona@3 shifts fact difficulty by it).
-- Existing assignments become 'normal', which plays exactly as before. Chosen on insert only: no update grant,
-- so scores within one assignment stay comparable.
alter table public.assignments
  add column client_level text not null default 'normal' check (client_level in ('mudah', 'normal', 'sulit'));

grant insert (client_level) on public.assignments to authenticated;
