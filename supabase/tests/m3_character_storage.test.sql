begin;

-- Issue #16: the `characters` bucket is public-read with an 8 MB cap, signed-in users cannot write to it,
-- and the six preset characters point at their files.
select plan(4);

select is(
  (select public from storage.buckets where id = 'characters'), true, 'characters bucket exists and is public');
select is(
  (select file_size_limit from storage.buckets where id = 'characters'), 8388608::bigint, 'characters bucket caps files at 8 MB');
select is(
  (select count(*)::int from public.characters where id in ('ratna', 'hendra', 'nadia', 'yosef', 'sri', 'dimas') and vrm_path = id || '.vrm'),
  6, 'preset characters point at <id>.vrm');

set local role postgres;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000f01', 'authenticated', 'authenticated', 'vrm@test.local', '{}', '{"display_name":"Guru","role":"pengajar"}');
update public.profiles set role = 'admin', status = 'active' where id = '00000000-0000-0000-0000-000000000f01';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000f01","role":"authenticated"}', true);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('characters', 'ratna.vrm') $$,
  '42501', null, 'a signed-in user (even an admin) cannot upload to the characters bucket');

select * from finish();
rollback;
