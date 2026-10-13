-- M2: karakter, skenario (draf + versi terbit + rahasia), tugas (US-G-03/05/06/10).
-- Secrets (persona, facts, rubric) live in their own table that learners can never select.

create table public.characters (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  occupation text not null,
  age_range text not null,
  gender text not null check (gender in ('female', 'male')),
  live_voice text not null,          -- Gemini Live prebuilt voice name
  portrait_hue smallint not null check (portrait_hue between 0 and 359),
  vrm_path text,                     -- Supabase Storage path, arrives with M3 assets
  active boolean not null default true,
  sort smallint not null default 0
);

alter table public.characters enable row level security;
create policy "characters: signed-in reads active" on public.characters
  for select to authenticated using (active or public.is_admin());

insert into public.characters (id, name, occupation, age_range, gender, live_voice, portrait_hue, sort) values
  ('ratna',  'Bu Ratna',  'Pemilik usaha laundry',           '40-an', 'female', 'Aoede',  18,  1),
  ('hendra', 'Pak Hendra','Manajer gudang distribusi',       '50-an', 'male',   'Charon', 210, 2),
  ('nadia',  'Kak Nadia', 'Pemilik kafe',                    '20-an', 'female', 'Leda',   340, 3),
  ('yosef',  'Pak Yosef', 'Kepala sekolah',                  '50-an', 'male',   'Orus',   150, 4),
  ('sri',    'Bu Sri',    'Ketua koperasi tani',             '40-an', 'female', 'Kore',   95,  5),
  ('dimas',  'Mas Dimas', 'Founder startup logistik',        '30-an', 'male',   'Puck',   265, 6);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Skenario tanpa judul' check (char_length(title) between 1 and 120),
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) < 200000),
  is_public boolean not null default false,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_public or current_version_id is not null)  -- only published scenarios can be public
);

create index scenarios_author_idx on public.scenarios (author_id);

create table public.scenario_versions (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  version integer not null check (version > 0),
  title text not null check (char_length(title) between 1 and 120),
  language text not null check (language in ('id', 'en')),
  level text not null check (level in ('smk', 's1', 'umum')),
  learner_role text not null check (char_length(learner_role) between 1 and 200),
  objective text not null check (char_length(objective) between 1 and 500),
  client_name text not null check (char_length(client_name) between 1 and 80),
  client_occupation text not null check (char_length(client_occupation) between 1 and 120),
  character_id text not null references public.characters (id),
  published_at timestamptz not null default now(),
  unique (scenario_id, version)
);

alter table public.scenarios
  add constraint scenarios_current_version_fk foreign key (current_version_id)
  references public.scenario_versions (id) on delete set null;

create table public.scenario_version_secrets (
  version_id uuid primary key references public.scenario_versions (id) on delete cascade,
  persona jsonb not null check (jsonb_typeof(persona) = 'object'),
  facts jsonb not null check (jsonb_typeof(facts) = 'array'),
  rubric jsonb not null check (jsonb_typeof(rubric) = 'array')
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  scenario_version_id uuid not null references public.scenario_versions (id) on delete restrict,
  due_at timestamptz,
  duration_min smallint not null default 15 check (duration_min between 5 and 60),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  created_at timestamptz not null default now()
);

create index assignments_class_idx on public.assignments (class_id);

-- Helpers (security definer: they read across tables RLS would otherwise hide from the caller).
create function public.is_scenario_author(p_scenario_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.scenarios where id = p_scenario_id and author_id = auth.uid());
$$;

create function public.is_public_current_version(p_version_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.scenarios where current_version_id = p_version_id and is_public);
$$;

create function public.is_version_assigned_to_me(p_version_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.assignments a
    join public.classes c on c.id = a.class_id
    left join public.class_members m on m.class_id = a.class_id and m.user_id = auth.uid()
    where a.scenario_version_id = p_version_id and (c.owner_id = auth.uid() or m.user_id is not null)
  );
$$;

create function public.version_scenario_id(p_version_id uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select scenario_id from public.scenario_versions where id = p_version_id;
$$;

alter table public.scenarios enable row level security;
alter table public.scenario_versions enable row level security;
alter table public.scenario_version_secrets enable row level security;
alter table public.assignments enable row level security;

-- scenarios: drafts are the author's alone (they contain facts).
create policy "scenarios: author reads" on public.scenarios
  for select to authenticated using (author_id = auth.uid());
create policy "scenarios: admin reads" on public.scenarios
  for select to authenticated using (public.is_admin());
create policy "scenarios: active teacher creates own" on public.scenarios
  for insert to authenticated with check (author_id = auth.uid() and public.is_active_teacher());
create policy "scenarios: author updates" on public.scenarios
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

revoke insert, update, delete on public.scenarios from authenticated, anon;
grant insert (author_id, title, draft) on public.scenarios to authenticated;
grant update (title, draft, is_public, updated_at) on public.scenarios to authenticated;

-- versions: brief only. Readable by author, admin, anyone for a public current version, and classes it's assigned to.
create policy "versions: author reads" on public.scenario_versions
  for select to authenticated using (public.is_scenario_author(scenario_id));
create policy "versions: admin reads" on public.scenario_versions
  for select to authenticated using (public.is_admin());
create policy "versions: public library" on public.scenario_versions
  for select to authenticated using (public.is_public_current_version(id));
create policy "versions: assigned" on public.scenario_versions
  for select to authenticated using (public.is_version_assigned_to_me(id));
revoke insert, update, delete on public.scenario_versions from authenticated, anon;

-- secrets: author + admin only. Personas/facts/rubrics reach the AI through the server, never the learner.
create policy "secrets: author reads" on public.scenario_version_secrets
  for select to authenticated using (public.is_scenario_author(public.version_scenario_id(version_id)));
create policy "secrets: admin reads" on public.scenario_version_secrets
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.scenario_version_secrets from authenticated, anon;

-- assignments: class owner manages; members read.
create policy "assignments: owner reads" on public.assignments
  for select to authenticated using (public.is_class_owner(class_id));
create policy "assignments: member reads" on public.assignments
  for select to authenticated using (public.is_class_member(class_id));
create policy "assignments: admin reads" on public.assignments
  for select to authenticated using (public.is_admin());
create policy "assignments: owner creates" on public.assignments
  for insert to authenticated with check (
    public.is_class_owner(class_id)
    and public.is_active_teacher()
    and (public.is_scenario_author(public.version_scenario_id(scenario_version_id))
         or public.is_public_current_version(scenario_version_id))
  );
create policy "assignments: owner updates" on public.assignments
  for update to authenticated using (public.is_class_owner(class_id)) with check (public.is_class_owner(class_id));
create policy "assignments: owner deletes" on public.assignments
  for delete to authenticated using (public.is_class_owner(class_id));

revoke insert, update on public.assignments from authenticated, anon;
grant insert (class_id, scenario_version_id, due_at, duration_min, max_attempts) on public.assignments to authenticated;
grant update (due_at, duration_min, max_attempts) on public.assignments to authenticated;

-- Publish = one transaction: next version number, brief row, secrets row, pointer + title.
-- Shape is validated by Zod on the server first; the column checks above are the backstop.
create function public.publish_scenario(p_scenario_id uuid, p_brief jsonb, p_secrets jsonb) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_version int;
  v_id uuid;
begin
  if not (public.is_scenario_author(p_scenario_id) and public.is_active_teacher()) then
    raise exception 'not scenario author' using errcode = '42501';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.scenario_versions where scenario_id = p_scenario_id;

  insert into public.scenario_versions
    (scenario_id, version, title, language, level, learner_role, objective, client_name, client_occupation, character_id)
  values (
    p_scenario_id, v_version,
    p_brief ->> 'title', p_brief ->> 'language', p_brief ->> 'level', p_brief ->> 'learnerRole',
    p_brief ->> 'objective', p_brief ->> 'clientName', p_brief ->> 'clientOccupation', p_brief ->> 'characterId'
  )
  returning id into v_id;

  insert into public.scenario_version_secrets (version_id, persona, facts, rubric)
  values (v_id, p_secrets -> 'persona', p_secrets -> 'facts', p_secrets -> 'rubric');

  update public.scenarios
  set current_version_id = v_id, title = p_brief ->> 'title', updated_at = now()
  where id = p_scenario_id;

  return v_id;
end;
$$;

revoke execute on function public.publish_scenario(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.publish_scenario(uuid, jsonb, jsonb) to authenticated;

-- Pustaka Skenario: current version of every public scenario. security_invoker keeps RLS in force.
create view public.library_versions with (security_invoker = true) as
  select v.id, v.scenario_id, v.version, v.title, v.language, v.level, v.learner_role, v.objective,
         v.client_name, v.client_occupation, v.character_id, v.published_at
  from public.scenario_versions v
  where public.is_public_current_version(v.id);

grant select on public.library_versions to authenticated;
