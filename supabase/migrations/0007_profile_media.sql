-- 0007_profile_media.sql
-- Profile pictures, banners, and the rest of the fields a person expects to
-- be able to set about themselves.

-- ------------------------------------------------------- profile fields --

alter table profiles
  add column if not exists avatar_path    text,
  add column if not exists banner_path    text,
  add column if not exists bio            text,
  add column if not exists program        text,
  add column if not exists year_level     text,
  add column if not exists contact_number text,
  add column if not exists updated_at     timestamptz not null default now();

-- ------------------------------------------------------- media storage --

-- Public read, unlike the attachments bucket. An avatar is rendered in the
-- nav on every page load; minting a signed URL each time would add a round
-- trip to every render for an image that is not sensitive. Writes are still
-- restricted to the owner's own folder.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy "upload own profile media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "replace own profile media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "remove own profile media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Keep updated_at honest without the client having to remember.
create or replace function public.touch_profile()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch
  before update on profiles
  for each row execute function public.touch_profile();
