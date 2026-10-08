-- Run this script in the Supabase SQL Editor.
-- Create admin accounts from Supabase Auth; do not enable public sign-ups for this panel.

create table if not exists public.site_content (
  id text primary key check (id = 'main'),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.cms_admins enable row level security;

create or replace function public.is_cms_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cms_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_cms_admin() from public;
grant execute on function public.is_cms_admin() to authenticated;

alter table public.site_content enable row level security;

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated admins can insert site content" on public.site_content;
create policy "Authenticated admins can insert site content"
  on public.site_content for insert
  to authenticated
  with check (id = 'main' and (select public.is_cms_admin()));

drop policy if exists "Authenticated admins can update site content" on public.site_content;
create policy "Authenticated admins can update site content"
  on public.site_content for update
  to authenticated
  using (id = 'main' and (select public.is_cms_admin()))
  with check (id = 'main' and (select public.is_cms_admin()));

grant select on public.site_content to anon, authenticated;
grant insert, update on public.site_content to authenticated;

insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view site images" on storage.objects;
create policy "Public can view site images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'site-media');

drop policy if exists "Authenticated admins can upload site images" on storage.objects;
create policy "Authenticated admins can upload site images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-media' and (select public.is_cms_admin()));

drop policy if exists "Authenticated admins can update site images" on storage.objects;
create policy "Authenticated admins can update site images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-media' and (select public.is_cms_admin()))
  with check (bucket_id = 'site-media' and (select public.is_cms_admin()));

drop policy if exists "Authenticated admins can delete site images" on storage.objects;
create policy "Authenticated admins can delete site images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-media' and (select public.is_cms_admin()));

-- After creating the admin user in Supabase Auth, run this separately,
-- replacing the email with that user's email:
-- insert into public.cms_admins (user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL';
