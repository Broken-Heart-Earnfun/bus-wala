import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const youtubeKey = Deno.env.get('YOUTUBE_API_KEY');

// Current Supabase projects expose named secret keys automatically.
// Older projects expose the legacy service-role key. Support both so this
// works with the user's existing Supabase project without creating another one.
let adminKey = '';
try {
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeysRaw) {
    const secretKeys = JSON.parse(secretKeysRaw);
    adminKey = secretKeys.default || '';
  }
} catch (e) {
  console.error('Could not parse SUPABASE_SECRET_KEYS');
}
adminKey = adminKey || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!adminKey) console.error('No Supabase server-side secret key is available');
if (!youtubeKey) console.error('YOUTUBE_API_KEY is missing');

const admin = adminKey
  ? createClient(supabaseUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!admin || !youtubeKey) return json({ error: 'YouTube search is not configured yet.' }, 503);

  try {
    const body = await req.json().catch(() => ({}));
    const rawQuery = String(body.query || '').trim();
    const query = rawQuery.replace(/\s+/g, ' ').slice(0, 100);
    const maxResults = Math.min(Math.max(Number(body.maxResults || 8), 1), 10);

    if (query.length < 3) return json({ tracks: [], message: 'Search needs at least 3 characters.' });

    // Cache for 24 hours. This prevents the same search from repeatedly consuming quota.
    const cacheKey = `v3:${query.toLowerCase()}`;
    const { data: cached } = await admin
      .from('youtube_search_cache')
      .select('results, created_at')
      .eq('query', cacheKey)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return json({ tracks: Array.isArray(cached.results) ? cached.results : [] });
      }
    }

    // Lightweight per-IP throttle: 10 fresh searches/hour/IP.
    const forwarded = req.headers.get('x-forwarded-for') || '';
    const ip = (forwarded.split(',')[0] || req.headers.get('cf-connecting-ip') || 'unknown').trim().slice(0, 100);
    const now = Date.now();
    const { data: rate } = await admin
      .from('youtube_search_rate_limits')
      .select('ip, window_started_at, request_count')
      .eq('ip', ip)
      .maybeSingle();

    if (rate) {
      const age = now - new Date(rate.window_started_at).getTime();
      if (age < 60 * 60 * 1000 && rate.request_count >= 10) {
        return json({ tracks: [], error: 'Search limit reached. Try again later.' }, 429);
      }
      if (age >= 60 * 60 * 1000) {
        await admin.from('youtube_search_rate_limits').upsert({ ip, window_started_at: new Date().toISOString(), request_count: 1 });
      } else {
        await admin.from('youtube_search_rate_limits').update({ request_count: rate.request_count + 1 }).eq('ip', ip);
      }
    } else {
      await admin.from('youtube_search_rate_limits').insert({ ip, window_started_at: new Date().toISOString(), request_count: 1 });
    }

    // Prefer individual songs over compilations/jukeboxes. We do this in two
    // layers: YouTube's video-duration filter removes most long jukeboxes, and
    // our local scorer rejects titles that are clearly compilations/remixes.
    // This keeps the database clean without making extra YouTube API calls.
    const blockedTerms = [
      'jukebox', 'compilation', 'playlist', 'nonstop', 'non-stop',
      'mashup', 'medley', 'remix', 'slowed', 'reverb', 'cover',
      'karaoke', 'instrumental', 'full album', 'album', 'collection',
      'best of', 'top 5', 'top 10', 'top 20', 'top 50', 'top 100',
      'hit songs', 'superhit songs', 'hits songs', 'evergreen songs',
      'sadabahar', 'old is gold', 'old songs', 'purane gane',
      'mix', '1 hour', '2 hour', '3 hour', '4 hour'
    ];

    const preferredChannels = [
      'tips official', 'shemaroo filmi gaane', 'saregama music',
      't-series', 'venus', 'ultra music', 'ishtar music',
      'sony music india', 'universal music india', 'drj records',
      'rajshri', 'bollywood classics'
    ];

    const searchQuery = `${query} official song`;
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', searchQuery.slice(0, 100));
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoEmbeddable', 'true');
    url.searchParams.set('videoSyndicated', 'true');
    // Individual Bollywood songs are normally in the 4–20 minute range;
    // this removes most jukebox/full-album results before our title filter.
    url.searchParams.set('videoDuration', 'medium');
    url.searchParams.set('maxResults', '25');
    url.searchParams.set('key', youtubeKey);

    const ytRes = await fetch(url);
    const ytData = await ytRes.json();

    if (!ytRes.ok) {
      console.error('YouTube API error', ytData);
      return json({ tracks: [], error: 'YouTube search failed.' }, 502);
    }

    const normalize = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, ' ').trim();

    const queryWords = normalize(query)
      .split(/\s+/)
      .filter((word: string) => word.length >= 3 && !['song', 'songs', 'music', 'hindi', '90s', '90'].includes(word));

    const candidates = (ytData.items || [])
      .filter((item: any) => item?.id?.videoId)
      .map((item: any) => {
        const id = item.id.videoId;
        const title = item.snippet?.title || 'Unknown title';
        const channel = item.snippet?.channelTitle || 'YouTube';
        const thumb = item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url || null;
        const haystack = `${title} ${channel}`.toLowerCase();
        const normalizedTitle = normalize(title);
        const channelNormalized = normalize(channel);

        const blocked = blockedTerms.some(term => haystack.includes(term));
        if (blocked) return null;

        let score = 0;

        // Exact query words in the title are a strong signal that this is the
        // requested song/artist rather than a generic recommendation.
        for (const word of queryWords) {
          if (normalizedTitle.includes(word)) score += 3;
        }

        // Official/recognized music channels get a ranking boost, but unknown
        // channels are not automatically rejected because some legitimate
        // uploads come from smaller rights holders.
        if (preferredChannels.some(name => channelNormalized.includes(name))) score += 8;
        if (haystack.includes('official')) score += 4;
        if (haystack.includes('full video')) score += 3;
        if (/\b(199[0-9]|2000)\b/.test(haystack)) score += 2;

        // A pipe-separated title with a movie name/year is common for official
        // individual Bollywood music videos.
        if (title.includes('|')) score += 2;
        if (/\[(199[0-9]|2000)\]/.test(title)) score += 2;

        return {
          title,
          artist: channel,
          youtube_id: id,
          youtube_url: `https://www.youtube.com/watch?v=${id}`,
          youtube_channel: channel,
          thumbnail_url: thumb,
          duration_seconds: null,
          _score: score,
        };
      })
      .filter(Boolean) as any[];

    // Require at least one meaningful match to the user's query. For broad
    // searches such as "90s Hindi songs", the official-channel/year signals
    // can still produce useful results; for a specific artist/song, title
    // matching is required.
    const isBroadQuery = queryWords.length <= 1;
    const found = candidates
      .filter(track => isBroadQuery || queryWords.some(word => normalize(track.title).includes(word)))
      .sort((a, b) => b._score - a._score)
      .slice(0, maxResults)
      .map(({ _score, ...track }) => track);

    if (found.length) {
      const { error: upsertError } = await admin
        .from('youtube_tracks')
        .upsert(found, { onConflict: 'youtube_id', ignoreDuplicates: true });
      if (upsertError) throw upsertError;
    }

    const ids = found.map((x: any) => x.youtube_id);
    let tracks = found;

    if (ids.length) {
      const { data: saved } = await admin
        .from('youtube_tracks')
        .select('*')
        .in('youtube_id', ids);
      if (saved?.length) tracks = saved;
    }

    await admin.from('youtube_search_cache').upsert({
      query: cacheKey,
      results: tracks,
      created_at: new Date().toISOString(),
    });

    return json({ tracks });
  } catch (error) {
    console.error(error);
    return json({ tracks: [], error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
