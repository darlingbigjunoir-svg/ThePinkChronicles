-- ============================================================
-- THE PINK CHRONICLES — Supabase database setup
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1. EPISODES (videos & audio) ---------------------------------
create table if not exists episodes (
  id           bigint generated always as identity primary key,
  number       int,
  topic        text,
  title        text not null,
  description  text,
  duration     text,
  air_date     date,
  type         text check (type in ('video','audio')) not null,
  media_url    text,        -- public URL of file in Supabase Storage (audio, or directly-uploaded video)
  youtube_url  text,        -- OR a YouTube link, for videos hosted on YouTube instead
  file_name    text,
  created_at   timestamptz default now()
);

-- 2. COMMUNITY MEMBERS ------------------------------------------
create table if not exists members (
  id          bigint generated always as identity primary key,
  name        text not null,
  nickname    text,
  email       text not null unique,
  age         text,
  country     text,
  interests   text[],
  why         text,
  role        text default 'Member',
  status      text default 'active',
  joined_at   timestamptz default now()
);

-- 3. SITE SETTINGS (single row) ----------------------------------
create table if not exists settings (
  id             int primary key default 1,
  podcast_name   text,
  host_name      text,
  tagline        text,
  website_url    text,
  instagram_url  text,
  tiktok_url     text,
  spotify_url    text,
  youtube_url    text,
  email          text,
  phone          text,
  updated_at     timestamptz default now()
);
insert into settings (id, podcast_name, host_name, tagline)
  values (1, 'The Pink Chronicles', 'Herty Afari', 'Real talks. Real girls. Real growth.')
  on conflict (id) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- Public visitors can READ episodes + settings, and INSERT
-- themselves into members (the join form). Only a signed-in
-- admin (via Supabase Auth) can write/edit/delete anything else.
-- ============================================================
alter table episodes enable row level security;
alter table members  enable row level security;
alter table settings enable row level security;

-- Episodes: everyone can read, only logged-in admin can write
drop policy if exists "episodes_public_read" on episodes;
create policy "episodes_public_read" on episodes
  for select using (true);
drop policy if exists "episodes_admin_write" on episodes;
create policy "episodes_admin_write" on episodes
  for insert with check (auth.role() = 'authenticated');
drop policy if exists "episodes_admin_update" on episodes;
create policy "episodes_admin_update" on episodes
  for update using (auth.role() = 'authenticated');
drop policy if exists "episodes_admin_delete" on episodes;
create policy "episodes_admin_delete" on episodes
  for delete using (auth.role() = 'authenticated');

-- Members: anyone can join (insert), only admin can view/manage the list
drop policy if exists "members_public_join" on members;
create policy "members_public_join" on members
  for insert with check (true);
drop policy if exists "members_admin_read" on members;
create policy "members_admin_read" on members
  for select using (auth.role() = 'authenticated');
drop policy if exists "members_admin_update" on members;
create policy "members_admin_update" on members
  for update using (auth.role() = 'authenticated');
drop policy if exists "members_admin_delete" on members;
create policy "members_admin_delete" on members
  for delete using (auth.role() = 'authenticated');

-- Settings: everyone can read, only admin can update
drop policy if exists "settings_public_read" on settings;
create policy "settings_public_read" on settings
  for select using (true);
drop policy if exists "settings_admin_update" on settings;
create policy "settings_admin_update" on settings
  for update using (auth.role() = 'authenticated');

-- ============================================================
-- STORAGE
-- After running this SQL, go to Storage in the sidebar and:
--  1. Create a new bucket named exactly:  media
--  2. Toggle it to "Public bucket" = ON
-- Then come back here and run the policies below.
-- ============================================================
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
  on storage.objects for select
  using ( bucket_id = 'media' );

drop policy if exists "media_admin_upload" on storage.objects;
create policy "media_admin_upload"
  on storage.objects for insert
  with check ( bucket_id = 'media' and auth.role() = 'authenticated' );

drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete"
  on storage.objects for delete
  using ( bucket_id = 'media' and auth.role() = 'authenticated' );