# Bus Wala — YouTube Auto Search (uses your CURRENT Supabase project)

This version is designed specifically for your existing Bus Wala Supabase project.

**Do NOT create another Supabase project. Do NOT run the original `schema.sql` again.**

Your current project already contains the `tracks` table, Storage buckets, Auth, and your existing songs. This add-on keeps all of those intact and adds only a small separate metadata/cache layer plus one Edge Function.

## What happens

```text
Your existing Supabase project
        │
        ├── tracks -------------------- existing uploaded songs
        │       └── HTML Audio
        │
        └── youtube_tracks ------------ automatic YouTube results
                └── YouTube IFrame Player

Search → local tracks first → if no match → YouTube → save metadata → play
                                      │
                                      └── if search fails → pre-loaded songs
```

## IMPORTANT: Supabase project limit

If you are seeing the Supabase **2 active free-project limit**, that limit is about how many free Supabase projects you can have. You do not need a third project for this feature. Supabase currently allows up to 100 Edge Functions on a Free project, so adding the single `youtube-search` function does not require another project.

## 1. Run the migration in your EXISTING project

Open:

**Supabase → SQL Editor → New query**

Run only:

`supabase/migration-youtube.sql`

It creates:

- `youtube_tracks` — YouTube metadata only
- `youtube_search_cache` — 24-hour query cache
- `youtube_search_rate_limits` — simple abuse protection

It does **not** alter, delete, copy, or rename your existing `tracks` rows or Storage files.

Do NOT run the old `schema.sql` again.

## 2. YouTube API key

Create a Google Cloud API key with **YouTube Data API v3** enabled.

Then add this one custom secret to your EXISTING Supabase project:

`YOUTUBE_API_KEY=...`

Go to:

**Supabase → Edge Functions → Secrets**

### You do NOT need to create a second Supabase project.

### You do NOT need to put a Supabase service-role/secret key into the website.

The included Edge Function supports both current Supabase named secret keys and older `SUPABASE_SERVICE_ROLE_KEY` environments. Current hosted Edge Functions automatically expose `SUPABASE_SECRET_KEYS`; the function uses the `default` secret key when available and falls back to the legacy service-role key.

## 3. Create ONE Edge Function inside the EXISTING project

Create a function named exactly:

`youtube-search`

Paste:

`supabase/functions/youtube-search/index.ts`

and deploy it.

The included `supabase/config.toml` contains:

```toml
[functions.youtube-search]
verify_jwt = false
```

This is intentional because the endpoint is a public search endpoint. The function itself performs its own input checks and uses a server-side Supabase secret only for database writes/cache.

## 4. Deploy the frontend separately

Use this folder as a **new Vercel deployment if you want to preserve your current live Vercel site**.

It still points to your **existing Supabase project** through `supabase-config.js`.

Your original Supabase data is therefore shared:

```text
Old Bus Wala site ──────┐
                        ├── SAME Supabase project
New Bus Wala site ──────┘
```

You can keep the original Vercel site running while testing this one.

## 5. Existing songs are untouched

Rows in `tracks` continue to use:

```text
audio_url
      ↓
HTML <audio>
```

The Driver's Cabin continues to upload files exactly as before.

YouTube rows are kept separately:

```text
youtube_tracks
      ↓
youtube_id
      ↓
YouTube IFrame Player
```

This prevents the existing `tracks` schema from being forced to accept fake/null audio paths.

## 6. Search behavior

The search box works in this order:

1. Search your existing Supabase tracks.
2. If there is a local match, do not call YouTube.
3. If there is no local match and at least 3 characters were entered, wait briefly and call `youtube-search`.
4. YouTube results are saved in `youtube_tracks`.
5. Results appear in the manifest and can be played.
6. Repeated searches use the 24-hour cache.
7. If YouTube fails or returns nothing, the UI restores your pre-loaded songs.

## 7. Pre-loaded fallback

If someone searches for something that cannot be found:

```text
No online match
      ↓
Play pre-loaded songs
```

The user can press **Play pre-loaded songs**, and the first existing track starts.

## 8. Do not put these secrets in frontend files

Never put these into `index.html` or `supabase-config.js`:

- `YOUTUBE_API_KEY`
- Supabase secret key
- Supabase service-role key

Your browser-side Supabase key can remain the existing publishable/anon key because your database uses RLS.

## 9. Quota protection

YouTube search calls consume API quota. This implementation therefore:

- waits until the user stops typing;
- only searches after 3+ characters;
- avoids YouTube when a local match exists;
- caches the same query for 24 hours;
- limits fresh searches per IP;
- requests only a small number of results.

## 10. Original site safety

This add-on does not modify your original Supabase `tracks` data. The original site can continue operating independently.

The only database change is adding the three new tables described above.

## Copyright / playback

YouTube results are played through YouTube's supported embedded player. The project does not download or extract YouTube audio into Supabase Storage. Only use content you are authorized to make available through your website.


## Current version: compact YouTube audio-style player

This version keeps YouTube playback inside the supported YouTube IFrame Player, but presents it as a compact source panel so the main Bus Wala controls remain the primary player UI.

YouTube search results are filtered to exclude common compilation-style results: jukebox, compilation, playlist, nonstop/non-stop, mashup, medley, remix, slowed, reverb, cover, karaoke, instrumental, album/full album, collection, and long-duration results such as 1/2/3/4 hour videos.

The filter is applied both when importing new results and when loading previously imported `youtube_tracks`, so old unwanted results do not appear in the new site's manifest.
