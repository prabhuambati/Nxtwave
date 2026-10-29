-- Run in Supabase SQL Editor for the "Next Web" project.
-- This migration hardens the prepared schema and adds account-free leaderboard RPCs.

create extension if not exists pgcrypto with schema extensions;

alter table public.bot_creations enable row level security;
alter table public.bot_likes enable row level security;
alter table public.bot_reports enable row level security;

revoke all on public.bot_creations from anon, authenticated;
revoke all on public.bot_likes from anon, authenticated;
revoke all on public.bot_reports from anon, authenticated;

-- Remove the broad bootstrap policies. Public clients must use the view and RPCs below.
drop policy if exists "public gallery reads" on public.bot_creations;
drop policy if exists "anonymous publishes" on public.bot_creations;
drop policy if exists "public likes read" on public.bot_likes;
drop policy if exists "public likes insert" on public.bot_likes;
drop policy if exists "public reports insert" on public.bot_reports;

grant select, insert, update on public.bot_creations to authenticated;

drop view if exists public.bot_gallery;
create or replace view public.bot_gallery with (security_barrier=true, security_invoker=false) as
select id, display_name, recipe, thumbnail_path, like_count, created_at
from public.bot_creations
where status = 'published';

revoke all on public.bot_gallery from anon, authenticated;
grant select on public.bot_gallery to anon, authenticated;

create or replace function public.publish_bot_creation(
  p_creation_id uuid,
  p_display_name text,
  p_recipe jsonb,
  p_thumbnail_path text,
  p_management_token text,
  p_image_consent boolean
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_path text;
begin
  if p_creation_id is null or p_display_name is null
     or char_length(trim(p_display_name)) < 2
     or char_length(p_display_name) > 40 then
    raise exception 'Invalid display name';
  end if;
  if p_management_token is null or char_length(p_management_token) < 32 then
    raise exception 'Invalid management token';
  end if;
  if coalesce(p_image_consent, false) <> true then
    raise exception 'Explicit publication consent is required';
  end if;
  if p_recipe is null or jsonb_typeof(p_recipe) <> 'object' then
    raise exception 'Invalid creation recipe';
  end if;
  if p_thumbnail_path is not null
     and p_thumbnail_path !~ '^public/[0-9a-f-]+\.jpg$' then
    raise exception 'Invalid thumbnail path';
  end if;
  if exists (select 1 from public.bot_creations where id = p_creation_id) then
    return p_creation_id;
  end if;
  insert into public.bot_creations (
    id, display_name, recipe, thumbnail_path, image_consent,
    management_token_hash, like_count, report_count, status
  ) values (
    p_creation_id, trim(p_display_name), p_recipe, p_thumbnail_path, true,
    encode(digest(convert_to(p_management_token, 'UTF8'), 'sha256'), 'hex'),
    0, 0, 'published'
  );
  return p_creation_id;
end;
$$;

create or replace function public.like_bot_creation(p_creation_id uuid, p_voter_key text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_creation_id is null or p_voter_key is null
     or char_length(p_voter_key) < 16 or char_length(p_voter_key) > 128 then
    raise exception 'Invalid like request';
  end if;
  if not exists (select 1 from public.bot_creations
                 where id = p_creation_id and status = 'published') then
    raise exception 'Creation is not publicly available';
  end if;
  begin
    insert into public.bot_likes (creation_id, voter_key)
    values (p_creation_id, encode(digest(convert_to(p_voter_key, 'UTF8'), 'sha256'), 'hex'));
  exception when unique_violation then
    return false;
  end;
  update public.bot_creations
  set like_count = like_count + 1
  where id = p_creation_id and status = 'published';
  return true;
end;
$$;

create or replace function public.withdraw_bot_creation(p_creation_id uuid, p_management_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  if p_creation_id is null or p_management_token is null then
    return false;
  end if;
  v_hash := encode(digest(convert_to(p_management_token, 'UTF8'), 'sha256'), 'hex');
  update public.bot_creations
  set status = 'withdrawn'
  where id = p_creation_id and management_token_hash = v_hash;
  return found;
end;
$$;

create or replace function public.report_bot_creation(
  p_creation_id uuid,
  p_reason text,
  p_reporter_key text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_hash text;
begin
  if p_creation_id is null or p_reason is null
     or char_length(trim(p_reason)) < 3
     or char_length(p_reason) > 240 then
    raise exception 'Invalid report';
  end if;
  if p_reporter_key is null or char_length(p_reporter_key) < 16 then
    raise exception 'Invalid reporter';
  end if;
  v_hash := encode(digest(convert_to(p_reporter_key, 'UTF8'), 'sha256'), 'hex');
  if (select count(*) from public.bot_reports
      where creation_id = p_creation_id and reporter_key = v_hash
      and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Report rate limit exceeded';
  end if;
  insert into public.bot_reports (creation_id, reason, reporter_key, status)
  values (p_creation_id, trim(p_reason), v_hash, 'open')
  returning id into v_id;
  update public.bot_creations
  set report_count = report_count + 1
  where id = p_creation_id;
  return v_id;
end;
$$;

revoke execute on function public.publish_bot_creation(uuid,text,jsonb,text,text,boolean) from public;
revoke execute on function public.like_bot_creation(uuid,text) from public;
revoke execute on function public.withdraw_bot_creation(uuid,text) from public;
revoke execute on function public.report_bot_creation(uuid,text,text) from public;

grant execute on function public.publish_bot_creation(uuid,text,jsonb,text,text,boolean) to anon, authenticated;
grant execute on function public.like_bot_creation(uuid,text) to anon, authenticated;
grant execute on function public.withdraw_bot_creation(uuid,text) to anon, authenticated;
grant execute on function public.report_bot_creation(uuid,text,text) to anon, authenticated;

-- Storage configuration for public thumbnails generated by the browser.
update storage.buckets
set public = true,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'],
    file_size_limit = 5242880
where id = 'bot-thumbnails';

-- Storage policies for public thumbnails generated by the browser.
drop policy if exists "public thumbnail read" on storage.objects;
drop policy if exists "anonymous thumbnail upload" on storage.objects;
drop policy if exists "anonymous thumbnail delete" on storage.objects;

create policy "public thumbnail read" on storage.objects
for select using (bucket_id = 'bot-thumbnails');

create policy "anonymous thumbnail upload" on storage.objects
for insert to anon, authenticated with check (
  bucket_id = 'bot-thumbnails'
  and (storage.foldername(name))[1] = 'public'
  and name ~ '^public/[0-9a-f-]+\.jpg$'
  and coalesce(metadata->>'mimetype', '') = 'image/jpeg'
);

-- Public thumbnail withdrawal/deletion requires an Edge Function or authenticated moderator.
-- No anonymous delete policy is intentionally created.
