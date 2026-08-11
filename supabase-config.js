// Shared Supabase connection for Bus Wala (index.html) and the Driver's Cabin (cabin-d2cd41816e.html).
// Find these in your Supabase project: Settings → API.
const SUPABASE_URL = 'https://ebrfekydopgadbzzmdwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVicmZla3lkb3BnYWRienptZHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzOTU4NjYsImV4cCI6MjEwMTk3MTg2Nn0.T9zv0toxbknYt9bn5ZcENtWDWdAHLANfQvlt6XKGAFE';

window.BUCKETS = { audio: 'tracks-audio', covers: 'tracks-covers' };
window.supabaseClient = SUPABASE_URL.includes('YOUR-PROJECT')
  ? null
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
