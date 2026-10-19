-- US-A-02 (#14): Admin permanently deletes a learner's data on request (docs/security-privacy.md §3).
-- One transaction: delete the Auth user (profiles and every learner row cascade from it: class_members,
-- sessions → messages, evaluations, llm_calls) and write audit_log, so a deletion is never unlogged.
-- audit_log.target holds the deleted id only, never the name, username or email.

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('delete_student')),
  target text not null,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

create policy "audit_log: admin reads" on public.audit_log
  for select to authenticated using (public.is_admin());
-- No write policies: rows are written only by the security-definer RPC below.
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- Learners only: deleting a teacher would also take their classes and scenarios (out of scope).
-- p_confirm = the learner's display name, retyped by the admin and checked here, not only in the UI.
create function public.delete_student(p_user_id uuid, p_confirm text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_name text;
  v_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_delete_self' using errcode = '22023';
  end if;
  select display_name, role into v_name, v_role from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_role <> 'pelajar' then
    raise exception 'not_a_student' using errcode = '22023';
  end if;
  if btrim(coalesce(p_confirm, '')) <> btrim(v_name) then
    raise exception 'confirmation_mismatch' using errcode = '22023';
  end if;

  delete from auth.users where id = p_user_id;
  insert into public.audit_log (actor_id, action, target) values (auth.uid(), 'delete_student', p_user_id::text);
end;
$$;

revoke execute on function public.delete_student(uuid, text) from public, anon;
grant execute on function public.delete_student(uuid, text) to authenticated;
