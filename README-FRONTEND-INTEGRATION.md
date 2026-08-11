# Bus Wala — Final Frontend Integration

This is a separate frontend project that uses the existing Bus Wala Supabase project.

## Existing data is preserved
- `tracks` remains the existing Supabase audio catalog.
- `youtube_tracks` contains YouTube metadata returned by the existing `youtube-search` Edge Function.
- No existing `tracks` rows or Storage files are migrated or deleted.

## Search behavior
1. Search the existing Supabase catalog first.
2. If there is no local match after 3+ characters, call the existing `youtube-search` Edge Function.
3. Show accepted YouTube results in the manifest and play them through the supported YouTube IFrame Player.
4. If YouTube search fails or returns no accepted results, show only the original pre-loaded Supabase songs as the fallback.

## Deployment
Deploy this folder as a NEW Vercel project. Do not replace the original live Bus Wala deployment.

The frontend calls:
`supabase.functions.invoke('youtube-search', ...)`

The YouTube API key remains server-side in the Supabase Edge Function secret `YOUTUBE_API_KEY`.
