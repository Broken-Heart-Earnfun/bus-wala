# Bus Wala YouTube filter update

This update changes only the existing `youtube-search` Edge Function.

## What changed
- Uses YouTube `videoDuration=medium` to favor 4–20 minute videos and remove most long jukebox/full-album results.
- Adds aggressive title filters for compilations, jukeboxes, mashups, remixes, covers, "best of", "top 5", "hit songs", etc.
- Scores recognized music channels higher (Tips Official, Shemaroo Filmi Gaane, Saregama Music, T-Series, etc.) without rejecting unknown channels outright.
- Requires meaningful title matching for specific searches.
- Saves only filtered/scored results to `youtube_tracks`.
- Cache version bumped from v2 to v3 so old cached jukebox results are not reused.
- No database migration is required.

## Deploy
Replace the code in the existing Supabase Edge Function `youtube-search` with:

`supabase/functions/youtube-search/index.ts`

Then deploy the existing function. Do not create another Supabase project or another function.
