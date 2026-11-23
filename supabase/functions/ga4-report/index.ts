import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://chois-lab.site', 'https://www.chois-lab.site'];
const PROPERTY_ID = '552537264';
const CACHE_MS = 5 * 60 * 1000;
const ALLOWED_DAYS = [7, 30, 90];

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const adminEmails = (Deno.env.get('ADMIN_EMAILS') ?? 'choislab.studio@gmail.com').split(',').map((s) => s.trim().toLowerCase());

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const reply = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).split('+').join('-').split('/').join('_').split('=').join('');
}

let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;

  const raw = Deno.env.get('GA4_SA_KEY_B64');
  if (!raw) throw new Error('GA4_SA_KEY_B64 secret is missing');
  const sa = JSON.parse(atob(raw.trim()));

  const nl = String.fromCharCode(10);
  const pemBody = String(sa.private_key)
    .split('-----BEGIN PRIVATE KEY-----').join('')
    .split('-----END PRIVATE KEY-----').join('')
    .split(nl).join('')
    .split(String.fromCharCode(13)).join('')
    .split(' ').join('');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = header + '.' + claim;
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)));
  const assertion = signingInput + '.' + b64url(sig);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error('token exchange failed: ' + (data.error ?? res.status));
  tokenCache = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return tokenCache.token;
}

type Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };

const dim = (r: Row, i = 0) => r.dimensionValues?.[i]?.value ?? '';
const met = (r: Row, i = 0) => Number(r.metricValues?.[i]?.value ?? 0);

async function buildReport(days: number) {
  const token = await getAccessToken();
  const current = { startDate: String(days - 1) + 'daysAgo', endDate: 'today', name: 'current' };
  const previous = { startDate: String(days * 2 - 1) + 'daysAgo', endDate: String(days) + 'daysAgo', name: 'previous' };
  const range = [{ startDate: current.startDate, endDate: current.endDate }];

  const body = {
    requests: [
      {
        dateRanges: [current, previous],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
      },
      {
        dateRanges: range,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      },
      {
        dateRanges: range,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      },
      {
        dateRanges: range,
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 50,
      },
      {
        dateRanges: range,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      },
    ],
  };

  const res = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + PROPERTY_ID + ':batchRunReports', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('ga4 api failed: ' + (data.error?.message ?? res.status));

  const [totalsRep, dailyRep, channelRep, sourceRep, pageRep] = data.reports as { rows?: Row[] }[];
  const totals: Record<string, { users: number; sessions: number; views: number; avgSeconds: number }> = {
    current: { users: 0, sessions: 0, views: 0, avgSeconds: 0 },
    previous: { users: 0, sessions: 0, views: 0, avgSeconds: 0 },
  };
  for (const r of totalsRep.rows ?? []) {
    const name = dim(r);
    if (totals[name]) totals[name] = { users: met(r, 0), sessions: met(r, 1), views: met(r, 2), avgSeconds: met(r, 3) };
  }

  const allSources = (sourceRep.rows ?? []).map((r) => ({ name: dim(r), sessions: met(r, 0) }));
  const naverSessions = allSources.filter((s) => s.name.toLowerCase().includes('naver')).reduce((sum, s) => sum + s.sessions, 0);

  return {
    days,
    totals,
    daily: (dailyRep.rows ?? []).map((r) => ({ date: dim(r), users: met(r, 0), sessions: met(r, 1), views: met(r, 2) })),
    channels: (channelRep.rows ?? []).map((r) => ({ name: dim(r), sessions: met(r, 0), users: met(r, 1) })),
    sources: allSources.slice(0, 8),
    naverSessions,
    pages: (pageRep.rows ?? []).map((r) => ({ path: dim(r), views: met(r, 0), users: met(r, 1) })),
    generatedAt: new Date().toISOString(),
  };
}

const reportCache = new Map<number, { at: number; body: unknown }>();

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply({ error: 'method not allowed' }, 405, origin);

  const jwt = (req.headers.get('Authorization') ?? '').split(' ')[1] ?? '';
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  const email = userData?.user?.email?.toLowerCase() ?? '';
  if (userError || !email || !adminEmails.includes(email)) return reply({ error: 'forbidden' }, 403, origin);

  let days = 30;
  try {
    const input = await req.json();
    if (ALLOWED_DAYS.includes(Number(input?.days))) days = Number(input.days);
  } catch (_e) {
    // empty body keeps default range
  }

  const hit = reportCache.get(days);
  if (hit && Date.now() - hit.at < CACHE_MS) return reply(hit.body, 200, origin);

  try {
    const body = await buildReport(days);
    reportCache.set(days, { at: Date.now(), body });
    return reply(body, 200, origin);
  } catch (e) {
    console.error(e);
    return reply({ error: 'report failed' }, 502, origin);
  }
});
