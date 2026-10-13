-- M0: profiles + roles. Remaining tables arrive with the milestone that needs them.

create type public.user_role as enum ('admin', 'pengajar', 'pelajar');
create type public.user_status as enum ('active', 'pending', 'disabled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'pelajar',
  status public.user_status not null default 'active',
  display_name text not null check (char_length(display_name) between 1 and 80),
  username text unique check (username ~ '^[a-z0-9_.]{3,32}$'),
  must_change_password boolean not null default false,
  mic_consent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- security definer avoids RLS recursion when policies ask "is the caller an admin?"
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "profiles: admin reads all" on public.profiles
  for select to authenticated using (public.is_admin());

create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Users may only edit harmless columns; role/status/flags change via server (service role).
revoke update on public.profiles from authenticated, anon;
grant update (display_name, mic_consent_at) on public.profiles to authenticated;

-- Self sign-up can request 'pengajar' but lands as pending; 'admin' is never self-assigned.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.profiles (id, role, status, display_name)
  values (
    new.id,
    case when requested = 'pengajar' then 'pengajar'::public.user_role else 'pelajar'::public.user_role end,
    case when requested = 'pengajar' then 'pending'::public.user_status else 'active'::public.user_status end,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Pengguna'
    ), 80)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
