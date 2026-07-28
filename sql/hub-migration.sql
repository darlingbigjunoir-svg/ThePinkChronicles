-- ============================================================
-- THE PINK CHRONICLES — Hub Backend Migration
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run
-- (Safe to re-run: every statement uses IF NOT EXISTS / DROP IF EXISTS)
-- ============================================================

-- ============================================================
-- STEP 0 — IMPORTANT SECURITY FIX
-- Until now, "episodes_admin_write" and similar policies checked
-- only auth.role() = 'authenticated' — meaning ANY logged-in
-- person (including a regular member, once members can log in)
-- would count as admin. This migration introduces a real
-- admins table and switches every admin policy to check it.
-- ============================================================

create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Add your existing admin account to this table.
-- Replace 'YOUR_ADMIN_EMAIL' with the email you use to log into Admin.
insert into admins (user_id)
  select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
  on conflict (user_id) do nothing;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ── Re-point every existing admin policy at is_admin() instead
--    of the old "any logged in user" check ──
drop policy if exists "episodes_admin_write"  on episodes;
create policy "episodes_admin_write" on episodes
  for insert with check (is_admin());
drop policy if exists "episodes_admin_update" on episodes;
create policy "episodes_admin_update" on episodes
  for update using (is_admin());
drop policy if exists "episodes_admin_delete" on episodes;
create policy "episodes_admin_delete" on episodes
  for delete using (is_admin());

drop policy if exists "members_admin_read"   on members;
create policy "members_admin_read" on members
  for select using (is_admin());
drop policy if exists "members_admin_update" on members;
create policy "members_admin_update" on members
  for update using (is_admin());
drop policy if exists "members_admin_delete" on members;
create policy "members_admin_delete" on members
  for delete using (is_admin());

drop policy if exists "settings_admin_update" on settings;
create policy "settings_admin_update" on settings
  for update using (is_admin());

drop policy if exists "media_admin_upload" on storage.objects;
create policy "media_admin_upload"
  on storage.objects for insert
  with check ( bucket_id = 'media' and is_admin() );
drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete"
  on storage.objects for delete
  using ( bucket_id = 'media' and is_admin() );


-- ============================================================
-- STEP 1 — LINK MEMBERS TO REAL LOGIN ACCOUNTS
-- ============================================================
alter table members add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table members add column if not exists bio text;
create unique index if not exists members_auth_user_id_key on members(auth_user_id);

-- A member can read and update their OWN row (for Settings page)
drop policy if exists "members_self_read" on members;
create policy "members_self_read" on members
  for select using (auth.uid() = auth_user_id);
drop policy if exists "members_self_update" on members;
create policy "members_self_update" on members
  for update using (auth.uid() = auth_user_id);

-- Lets someone who just signed up "claim" a members row that the
-- admin added manually before they ever had a login (matched by
-- email, only while that row has no linked account yet)
drop policy if exists "members_claim_by_email" on members;
create policy "members_claim_by_email" on members
  for update using (auth_user_id is null and email = (auth.jwt() ->> 'email'));

-- Safe public directory: only non-sensitive columns, only active members
create or replace view member_directory as
  select id, name, nickname, role, joined_at
  from members
  where status = 'active';

grant select on member_directory to anon, authenticated;


-- ============================================================
-- STEP 2 — DISCUSSION FEED
-- ============================================================
create table if not exists posts (
  id           bigint generated always as identity primary key,
  member_id    bigint references members(id) on delete cascade,
  author_name  text not null,
  content      text not null,
  topic        text,
  created_at   timestamptz default now()
);
create table if not exists post_likes (
  id         bigint generated always as identity primary key,
  post_id    bigint references posts(id) on delete cascade,
  member_id  bigint references members(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, member_id)
);
create table if not exists post_comments (
  id           bigint generated always as identity primary key,
  post_id      bigint references posts(id) on delete cascade,
  member_id    bigint references members(id) on delete cascade,
  author_name  text not null,
  content      text not null,
  created_at   timestamptz default now()
);

alter table posts enable row level security;
alter table post_likes enable row level security;
alter table post_comments enable row level security;

drop policy if exists "posts_read" on posts;
create policy "posts_read" on posts for select using (true);
drop policy if exists "posts_member_insert" on posts;
create policy "posts_member_insert" on posts for insert
  with check (member_id in (select id from members where auth_user_id = auth.uid()));
drop policy if exists "posts_own_delete" on posts;
create policy "posts_own_delete" on posts for delete
  using (member_id in (select id from members where auth_user_id = auth.uid()) or is_admin());

drop policy if exists "likes_read" on post_likes;
create policy "likes_read" on post_likes for select using (true);
drop policy if exists "likes_member_insert" on post_likes;
create policy "likes_member_insert" on post_likes for insert
  with check (member_id in (select id from members where auth_user_id = auth.uid()));
drop policy if exists "likes_own_delete" on post_likes;
create policy "likes_own_delete" on post_likes for delete
  using (member_id in (select id from members where auth_user_id = auth.uid()));

drop policy if exists "comments_read" on post_comments;
create policy "comments_read" on post_comments for select using (true);
drop policy if exists "comments_member_insert" on post_comments;
create policy "comments_member_insert" on post_comments for insert
  with check (member_id in (select id from members where auth_user_id = auth.uid()));
drop policy if exists "comments_own_delete" on post_comments;
create policy "comments_own_delete" on post_comments for delete
  using (member_id in (select id from members where auth_user_id = auth.uid()) or is_admin());


-- ============================================================
-- STEP 3 — EVENTS (admin-managed, member-visible)
-- ============================================================
create table if not exists events (
  id           bigint generated always as identity primary key,
  title        text not null,
  description  text,
  event_date   date,
  event_time   text,
  created_at   timestamptz default now()
);
alter table events enable row level security;
drop policy if exists "events_read" on events;
create policy "events_read" on events for select using (true);
drop policy if exists "events_admin_write" on events;
create policy "events_admin_write" on events for insert with check (is_admin());
drop policy if exists "events_admin_update" on events;
create policy "events_admin_update" on events for update using (is_admin());
drop policy if exists "events_admin_delete" on events;
create policy "events_admin_delete" on events for delete using (is_admin());

-- ============================================================
-- Done! Next: Authentication settings.
-- Go to Authentication → Providers → Email and turn OFF
-- "Confirm email" so new members can log in immediately after
-- joining, without needing to click a confirmation link.
-- (You can turn this back on later if you'd prefer verified
-- emails — members will then need to confirm before logging in.)
-- ============================================================