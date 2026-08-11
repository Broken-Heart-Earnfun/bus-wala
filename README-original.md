# Bus Wala 🚌 — Horn OK Please

A jukebox styled after the back of a decorated Indian bus — built as a proper playlist with a
Supabase backend you control, instead of one looping track.

## Files

- `index.html` — the player everyone sees
- `admin.html` — "Driver's Cabin", where you sign in and upload tracks
- `supabase-config.js` — shared Supabase connection, used by both pages
- `schema.sql` — run once in Supabase to create the table, storage buckets, and policies
- `style.css` — shared fonts and the few animations Tailwind can't do alone

## Setup

1. **Create a Supabase project** at supabase.com (the free tier is enough).
2. **Run the schema.** Open the SQL editor in your project, paste in `schema.sql`, and run it.
   This creates the `tracks` table, two public storage buckets (`tracks-audio`, `tracks-covers`),
   and the row-level-security policies that let anyone listen but only signed-in drivers upload.
3. **Create yourself a driver login.** In Supabase → Authentication → Users → Add user, set an
   email and password. That's what you'll use to sign into `admin.html`.
4. **Connect the site.** In Supabase → Project Settings → API, copy the Project URL and the
   `anon public` key. Paste them into `supabase-config.js`:
   ```js
   const SUPABASE_URL = 'https://xxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
5. **Upload some music.** Open `admin.html`, sign in, and load a few cassettes — title, artist,
   an audio file, and an optional cover photo.
6. **Open `index.html`.** Hit "Start the Engine" and you're on the road.

## Hosting

These are static files — drag the folder into Netlify, Vercel, or GitHub Pages, or just open
`index.html` directly. No build step, no server of your own.

## What's different from the sites this took inspiration from

- A real playlist with previous/next, shuffle, and repeat — not one looping track.
- A live "on board" count powered by Supabase Realtime presence, not a static number.
- A searchable manifest, per-track durations, and a horn button (synthesized in-browser, no
  audio file needed).
- You own the catalog — add or offload tracks any time from the Driver's Cabin, backed by your
  own Supabase project.
