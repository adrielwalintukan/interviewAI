-- M1: kelas + keanggotaan + gabung lewat kode (US-P-01, US-G-01).

-- Helpers are security definer so policies on classes <-> class_members don't recurse into each other.
create function public.is_active_teacher() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'pengajar' and status = 'active'
  );
$$;

-- 31 chars: no I, O, 0, 1 so codes survive being read aloud or copied from a projector.
create function public.generate_join_code() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.classes where join_code = code);
  end loop;
  return code;
end;
$$;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  join_code text not null unique check (join_code ~ '^[A-Z2-9]{6,8}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.classes alter column join_code set default public.generate_join_code();
create index classes_owner_idx on public.classes (owner_id);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create index class_members_user_idx on public.class_members (user_id);

create function public.is_class_owner(p_class_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.classes where id = p_class_id and owner_id = auth.uid());
$$;

create function public.is_class_member(p_class_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.class_members where class_id = p_class_id and user_id = auth.uid());
$$;

create function public.teaches_user(p_user_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_members m
    join public.classes c on c.id = m.class_id
    where m.user_id = p_user_id and c.owner_id = auth.uid()
  );
$$;

alter table public.classes enable row level security;
alter table public.class_members enable row level security;

create policy "classes: owner reads" on public.classes
  for select to authenticated using (owner_id = auth.uid());
create policy "classes: member reads" on public.classes
  for select to authenticated using (public.is_class_member(id));
create policy "classes: admin reads" on public.classes
  for select to authenticated using (public.is_admin());
create policy "classes: active teacher creates own" on public.classes
  for insert to authenticated with check (owner_id = auth.uid() and public.is_active_teacher());
create policy "classes: owner updates" on public.classes
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Owners may rename/archive; the code only changes through regenerate_join_code().
revoke insert, update on public.classes from authenticated, anon;
grant insert (owner_id, name) on public.classes to authenticated;
grant update (name, archived_at) on public.classes to authenticated;

create policy "class_members: self reads" on public.class_members
  for select to authenticated using (user_id = auth.uid());
create policy "class_members: owner reads" on public.class_members
  for select to authenticated using (public.is_class_owner(class_id));
create policy "class_members: admin reads" on public.class_members
  for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: joining goes through join_class(), bulk enrolment through the server.

create policy "profiles: teacher reads own students" on public.profiles
  for select to authenticated using (public.teaches_user(id));

-- Same null result for a wrong code and an archived class, so the endpoint can't probe which codes exist.
create function public.join_class(p_code text) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_class_id uuid;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'pelajar' and status = 'active'
  ) then
    return null;
  end if;

  select id into v_class_id from public.classes
  where join_code = upper(trim(p_code)) and archived_at is null;

  if v_class_id is null then
    return null;
  end if;

  insert into public.class_members (class_id, user_id)
  values (v_class_id, auth.uid())
  on conflict do nothing;

  return v_class_id;
end;
$$;

create function public.regenerate_join_code(p_class_id uuid) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_class_owner(p_class_id) then
    raise exception 'not class owner' using errcode = '42501';
  end if;
  v_code := public.generate_join_code();
  update public.classes set join_code = v_code where id = p_class_id;
  return v_code;
end;
$$;

revoke execute on function public.join_class(text), public.regenerate_join_code(uuid) from public, anon;
grant execute on function public.join_class(text), public.regenerate_join_code(uuid) to authenticated;
