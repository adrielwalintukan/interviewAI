-- #41: retention security (docs/security-privacy.md §3).
-- Prevent teachers from tampering with classes.archived_at to prematurely purge student data.
-- Direct updates to archived_at are revoked; archiving and unarchiving must use the set_class_archived() RPC
-- which strictly enforces class ownership and binds timestamps to server time (now() or null).

revoke update (archived_at) on public.classes from authenticated, anon;

create function public.set_class_archived(p_class_id uuid, p_archived boolean) returns timestamptz
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_archived_at timestamptz;
  v_updated_id uuid;
begin
  if not public.is_class_owner(p_class_id) then
    raise exception 'not class owner' using errcode = '42501';
  end if;

  v_archived_at := case when p_archived then now() else null end;

  update public.classes
  set archived_at = v_archived_at
  where id = p_class_id and owner_id = auth.uid()
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'not class owner' using errcode = '42501';
  end if;

  return v_archived_at;
end;
$$;

revoke execute on function public.set_class_archived(uuid, boolean) from public, anon;
grant execute on function public.set_class_archived(uuid, boolean) to authenticated;
