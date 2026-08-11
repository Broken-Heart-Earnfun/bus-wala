-- Bus Wala — run this once in your Supabase project's SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  audio_url text not null,
  audio_path text not null,
  cover_url text,
  cover_path text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

create policy "Anyone can view tracks" on public.tracks
  for select using (true);

create policy "Signed-in drivers can add tracks" on public.tracks
  for insert to authenticated with check (true);

create policy "Signed-in drivers can edit tracks" on public.tracks
  for update to authenticated using (true);

create policy "Signed-in drivers can remove tracks" on public.tracks
  for delete to authenticated using (true);

-- Public storage buckets, so the player can stream without logging in.
insert into storage.buckets (id, name, public)
  values ('tracks-audio', 'tracks-audio', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('tracks-covers', 'tracks-covers', true)
  on conflict (id) do nothing;

create policy "Anyone can stream audio" on storage.objects
  for select using (bucket_id = 'tracks-audio');

create policy "Anyone can view covers" on storage.objects
  for select using (bucket_id = 'tracks-covers');

create policy "Signed-in drivers can upload audio" on storage.objects
  for insert to authenticated with check (bucket_id = 'tracks-audio');

create policy "Signed-in drivers can upload covers" on storage.objects
  for insert to authenticated with check (bucket_id = 'tracks-covers');

create policy "Signed-in drivers can remove audio" on storage.objects
  for delete to authenticated using (bucket_id = 'tracks-audio');

create policy "Signed-in drivers can remove covers" on storage.objects
  for delete to authenticated using (bucket_id = 'tracks-covers');
