# Supabase setup checklist

## Status
The project may now contain `VITE_SUPABASE_URL` and a browser-safe publishable key. Public publishing, voting, storage, and withdrawals remain unconnected until the migration in [`../database/SUPABASE_MIGRATION.sql`](../database/SUPABASE_MIGRATION.sql) is run and the `bot-thumbnails` bucket exists. Only browser-safe variables may be used in the app.

## Required migration
Run the complete contents of [`../database/SUPABASE_MIGRATION.sql`](../database/SUPABASE_MIGRATION.sql) once in the Supabase SQL Editor. It:

- removes the broad bootstrap table policies and exposes only `public.bot_gallery` to browsers;
- adds token-hashed publish, like, withdrawal, and report RPC functions;
- hashes account-free voter keys before storing likes/reports;
- adds rate limiting to reports;
- limits thumbnail uploads to JPEG files under the `public/` storage path.

After running the migration, create or confirm the public `bot-thumbnails` bucket in Storage. The app never stores uploaded user badges or raw local image content in Supabase.

## Required browser environment variables
Create `.env.local` (not committed) with:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_BROWSER_SAFE_ANON_KEY
VITE_COMPETITION_DEADLINE=
VITE_COMPETITION_ELIGIBILITY=Rules approved by NxtWave
VITE_COMPETITION_PRIZE_INR=500
# Optional dedicated workshop registration form. Leave unset until a verified URL is provided.
VITE_WORKSHOP_REGISTRATION_URL=
```

Restart Vite after changing environment variables. Never place a Supabase service-role key in browser code or a Vite environment variable.

## Database SQL (run in Supabase SQL Editor)

```sql
create table if not exists public.bot_creations (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 2 and 40),
  recipe jsonb not null,
  thumbnail_path text,
  image_consent boolean not null default false,
  management_token_hash text not null unique,
  like_count bigint not null default 0,
  report_count integer not null default 0,
  status text not null default 'published' check (status in ('published','withdrawn','moderation')),
  created_at timestamptz not null default now()
);

create table if not exists public.bot_likes (
  creation_id uuid references public.bot_creations(id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key (creation_id, voter_key)
);

create table if not exists public.bot_reports (
  id uuid primary key default gen_random_uuid(),
  creation_id uuid references public.bot_creations(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 240),
  reporter_key text not null,
  status text not null default 'open' check (status in ('open','reviewing','dismissed','removed')),
  created_at timestamptz not null default now()
);

alter table public.bot_creations enable row level security;
alter table public.bot_likes enable row level security;
alter table public.bot_reports enable row level security;

create policy "public gallery reads" on public.bot_creations for select using (status = 'published');
create policy "anonymous publishes" on public.bot_creations for insert to anon with check (image_consent = true);
create policy "public likes read" on public.bot_likes for select to anon using (true);
create policy "public likes insert" on public.bot_likes for insert to anon with check (char_length(voter_key) between 16 and 128);
create policy "public reports insert" on public.bot_reports for insert to anon with check (char_length(reason) between 3 and 240);
```

For withdrawal, expose an RPC that accepts the locally generated management token and updates only the matching row; do not implement withdrawal by returning raw token-hash columns to public clients. Add a separate abuse-rate function or Supabase Edge Function later.

## Storage
1. Create a public bucket named `bot-thumbnails` only for generated JPEG/WebP thumbnails.
2. Do not store original uploaded images in the public creation URL or public metadata.
3. Add a private raw-image bucket named `bot-user-images` if originals are approved, and restrict it through signed URLs.
4. Accept only PNG, JPEG, and WebP content at the application and storage boundaries; enforce a maximum upload size.
5. Keep thumbnails reasonably small (for example 512 px max) and delete withdrawn content with an Edge Function or maintenance task.

## Gallery and abuse expectations
Account-free likes cannot completely prevent coordinated abuse. Use database unique constraints on `(creation_id, voter_key)`, one hashed browser voter key per browser, submission rate limits, reporting, moderation, and server-side final winner review. The browser management token is a prototype ownership mechanism and is not an account or cryptographic proof of identity.

## Referral limitation
A local `?ref=` link can award five prototype credits only after this browser successfully places a valid image. It can be reset by clearing storage and does not prove an independent participant or eligible referral. Do not call it secure or unlimited. A reliable implementation requires backend referral validation and eligible-action records.
