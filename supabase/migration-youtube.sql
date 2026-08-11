-- SAFE migration for the NEW Bus Wala project.
-- This leaves the original public.tracks table completely untouched.
-- Your original site can keep using public.tracks exactly as it does today.

create table if not exists public.youtube_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  youtube_id text not null,
  youtube_url text not null,
  youtube_channel text,
  thumbnail_url text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create unique index if not exists youtube_tracks_youtube_id_unique
  on public.youtube_tracks (youtube_id);

alter table public.youtube_tracks enable row level security;

-- Anyone may read imported YouTube metadata. Only the Edge Function's
-- server-side secret key writes this table.
create policy "Anyone can view YouTube tracks"
  on public.youtube_tracks
  for select using (true);

-- Cache repeated searches for 24 hours so the same query does not repeatedly
-- consume YouTube Data API search quota.
create table if not exists public.youtube_search_cache (
  query text primary key,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.youtube_search_cache enable row level security;

-- Lightweight per-IP throttle for fresh searches.
create table if not exists public.youtube_search_rate_limits (
  ip text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

alter table public.youtube_search_rate_limits enable row level security;
