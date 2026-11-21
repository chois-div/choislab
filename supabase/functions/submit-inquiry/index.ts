import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://chois-lab.site', 'https://www.chois-lab.site'];
const TYPES = ['홈페이지 제작', '쇼핑몰', '랜딩페이지', '유지보수', '기타'];
const PLATFORMS = ['아임웹', '프레이머', '미정'];
const EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'ppt', 'pptx', 'doc', 'docx', 'hwp', 'hwpx', 'xls', 'xlsx'];
const MAX_FILES = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_MAILS_PER_HOUR = 20;
const URL_RE = /^https?:[/][/]/i;
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

const reply = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' } });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isUrl = (v: string) => URL_RE.test(v) && v.length <= 300;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function verifyTurnstile(token: string, ip: string | null) {
  const body = new URLSearchParams({ secret: Deno.env.get('TURNSTILE_SECRET_KEY') ?? '', response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const data = await res.json();
  return data.success === true;
}

async function sendNotification(row: { name: string; inquiry_type: string; budget: string | null; message: string }) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('NOTIFY_EMAIL');
  if (!apiKey || !to) return;
  const since = new Date(Date.now() - 3600000).toISOString();
  const { count } = await admin.from('inquiries').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((count ?? 0) > MAX_MAILS_PER_HOUR) return;
  const preview = row.message.length > 100 ? row.message.slice(0, 100) + '…' : row.message;
  const html =
    '<div style="font-family:sans-serif;max-width:560px">' +
    '<h2>새 문의가 도착했습니다</h2>' +
    '<p><b>이름</b> ' + esc(row.name) + '<br><b>문의 유형</b> ' + esc(row.inquiry_type) + '<br><b>예산대</b> ' + esc(row.budget || '-') + '</p>' +
    '<p style="white-space:pre-wrap">' + esc(preview) + '</p>' +
    '<p><a href="https://chois-lab.site/ops/">문의함에서 보기</a></p>' +
    '<p style="color:#888;font-size:12px">연락처와 첨부 파일은 보안을 위해 메일에 포함하지 않습니다.</p></div>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev',
      to,
      subject: '[초이스랩] 새 문의 · ' + row.name + ' (' + row.inquiry_type + ')',
      html,
    }),
  });
  if (!res.ok) console.error('notification failed', res.status, await res.text());
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405, origin);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return reply({ error: 'forbidden' }, 403, origin);

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return reply({ error: 'invalid_json' }, 400, origin); }

  if (str(p.website, 200)) return reply({ ok: true, uploads: [] }, 200, origin);

  const name = str(p.name, 50);
  const contact = str(p.contact, 100);
  const inquiryType = str(p.inquiryType, 30);
  const message = str(p.message, 5000);
  const budget = str(p.budget, 30) || null;
  const platformPref = str(p.platformPref, 10) || null;
  const desiredLaunch = DATE_RE.test(str(p.desiredLaunch, 10)) ? str(p.desiredLaunch, 10) : null;
  const existingUrl = str(p.existingUrl, 300) || null;
  const referenceUrls = (Array.isArray(p.referenceUrls) ? p.referenceUrls : []).map((u) => str(u, 300)).filter(Boolean);
  const files = Array.isArray(p.files) ? p.files : [];

  if (!name || contact.length < 3 || !message || p.consent !== true) return reply({ error: 'missing_fields' }, 400, origin);
  if (!TYPES.includes(inquiryType)) return reply({ error: 'invalid_type' }, 400, origin);
  if (platformPref && !PLATFORMS.includes(platformPref)) return reply({ error: 'invalid_platform' }, 400, origin);
  if (existingUrl && !isUrl(existingUrl)) return reply({ error: 'invalid_url' }, 400, origin);
  if (referenceUrls.length > 3 || !referenceUrls.every(isUrl)) return reply({ error: 'invalid_url' }, 400, origin);
  if (files.length > MAX_FILES) return reply({ error: 'too_many_files' }, 400, origin);

  const checkedFiles: { name: string; size: number; type: string; ext: string }[] = [];
  for (const f of files as Record<string, unknown>[]) {
    const fname = str(f?.name, 200);
    const ext = fname.split('.').pop()?.toLowerCase() ?? '';
    const size = Number(f?.size);
    if (!fname || !EXTENSIONS.includes(ext) || !Number.isInteger(size) || size < 1 || size > MAX_BYTES) {
      return reply({ error: 'invalid_file' }, 400, origin);
    }
    checkedFiles.push({ name: fname, size, type: str(f?.type, 100) || 'application/octet-stream', ext });
  }

  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const token = str(p.turnstileToken, 2048);
  if (!token || !(await verifyTurnstile(token, ip))) return reply({ error: 'captcha_failed' }, 400, origin);

  const { data: inquiry, error } = await admin
    .from('inquiries')
    .insert({
      name, contact, inquiry_type: inquiryType, budget, platform_pref: platformPref,
      desired_launch: desiredLaunch, existing_url: existingUrl, reference_urls: referenceUrls,
      message, consent_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error || !inquiry) { console.error('insert failed', error); return reply({ error: 'save_failed' }, 500, origin); }

  const uploads: { path: string; token: string }[] = [];
  for (const f of checkedFiles) {
    const path = inquiry.id + '/' + crypto.randomUUID() + '.' + f.ext;
    const signed = await admin.storage.from('inquiry-files').createSignedUploadUrl(path);
    if (signed.error || !signed.data) { console.error('signed url failed', signed.error); continue; }
    const rec = await admin.from('inquiry_files').insert({
      inquiry_id: inquiry.id, storage_path: path, file_name: f.name, size_bytes: f.size, mime_type: f.type,
    });
    if (rec.error) { console.error('file record failed', rec.error); continue; }
    uploads.push({ path, token: signed.data.token });
  }

  try { await sendNotification({ name, inquiry_type: inquiryType, budget, message }); } catch (e) { console.error('notification error', e); }

  return reply({ ok: true, uploads }, 200, origin);
});
