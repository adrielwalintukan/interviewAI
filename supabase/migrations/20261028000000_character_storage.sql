-- Issue #16 (ADR-005): VRM avatars live in the public Storage bucket `characters` (docs/vrm-spec.md §6).
-- The files hold no personal data and reach every learner's browser anyway, so reads need no signed URL.
-- No storage.objects policy is added: only the service role (Dashboard upload by the repo owner) can write.
-- 8 MB cap per docs/vrm-spec.md.
insert into storage.buckets (id, name, public, file_size_limit)
values ('characters', 'characters', true, 8388608)
on conflict (id) do nothing;

-- The six preset characters (docs/vrm-spec.md §1): file name = id. Characters added later keep null and show
-- the CSS portrait until an admin's file arrives.
update public.characters set vrm_path = id || '.vrm'
where id in ('ratna', 'hendra', 'nadia', 'yosef', 'sri', 'dimas') and vrm_path is null;
