-- Issue #18 (workflow §1): on /daftar the role is chosen before "Lanjut dengan Google", but an OAuth sign-up carries
-- no role metadata, so handle_new_user creates a pelajar. The OAuth callback then asks for this switch.
-- Only a brand-new, untouched self sign-up qualifies (profile ≤ 10 minutes old, active pelajar, not a bulk account,
-- no class, no session), and it lands as pending until an admin approves, exactly like the email sign-up path.
-- Returns true when the caller is now on the teacher side (switched now, or already pengajar/admin), so the callback
-- only turns away an existing pelajar or a failed call.
create function public.request_teacher_role() returns boolean
language sql security definer set search_path = ''
as $$
  with switched as (
    update public.profiles p set role = 'pengajar', status = 'pending'
    where p.id = auth.uid()
      and p.role = 'pelajar' and p.status = 'active' and not p.must_change_password
      and p.created_at > now() - interval '10 minutes'
      and not exists (select 1 from public.class_members m where m.user_id = p.id)
      and not exists (select 1 from public.sessions s where s.user_id = p.id)
    returning 1
  )
  select exists (select 1 from switched)
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('pengajar', 'admin'));
$$;

revoke execute on function public.request_teacher_role() from public, anon;
grant execute on function public.request_teacher_role() to authenticated;
