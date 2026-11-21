-- 홈페이지 문의 접수용 테이블과 비공개 저장 버킷.
-- 접수는 Edge Function(submit-inquiry)이 서비스 키로 처리하므로 비로그인(anon) 접근은 모두 막는다.
-- 로그인 사용자는 본인 1명뿐이어야 하므로 Authentication > Sign In / Providers 에서 신규 가입(sign-ups)을 반드시 끈다.

create function public.valid_urls(urls text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    cardinality(urls) <= 3 and bool_and(u ~* '^https?://' and char_length(u) <= 300),
    true
  )
  from unnest(urls) as u
$$;

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  contact text not null check (char_length(contact) between 3 and 100),
  inquiry_type text not null check (inquiry_type in ('홈페이지 제작', '쇼핑몰', '랜딩페이지', '유지보수', '기타')),
  budget text check (char_length(budget) <= 30),
  platform_pref text check (platform_pref in ('아임웹', '프레이머', '미정')),
  desired_launch date,
  existing_url text check (existing_url is null or (existing_url ~* '^https?://' and char_length(existing_url) <= 300)),
  reference_urls text[] not null default '{}' check (public.valid_urls(reference_urls)),
  message text not null check (char_length(message) between 1 and 5000),
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'seen', 'replied', 'hold')),
  project_id uuid,
  created_at timestamptz not null default now()
);

create table public.inquiry_files (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) <= 200),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index inquiries_status_created_idx on public.inquiries (status, created_at desc);
create index inquiry_files_inquiry_idx on public.inquiry_files (inquiry_id);

alter table public.inquiries enable row level security;
alter table public.inquiry_files enable row level security;

revoke all on public.inquiries from anon;
revoke all on public.inquiry_files from anon;

create policy "owner reads inquiries" on public.inquiries for select to authenticated using (true);
create policy "owner updates inquiries" on public.inquiries for update to authenticated using (true) with check (true);
create policy "owner deletes inquiries" on public.inquiries for delete to authenticated using (true);
create policy "owner reads inquiry files" on public.inquiry_files for select to authenticated using (true);
create policy "owner deletes inquiry files" on public.inquiry_files for delete to authenticated using (true);

-- 비공개 버킷. 서버 쪽에서도 용량과 형식을 강제한다.
-- HWP는 브라우저가 MIME 타입을 다르게 보고하는 경우가 많아 변형을 함께 허용하고, 확장자는 Edge Function에서 한 번 더 검사한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inquiry-files',
  'inquiry-files',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/x-hwp',
    'application/haansofthwp',
    'application/vnd.hancom.hwp',
    'application/vnd.hancom.hwpx'
  ]
)
on conflict (id) do nothing;

create policy "owner reads inquiry files in storage" on storage.objects
  for select to authenticated using (bucket_id = 'inquiry-files');
create policy "owner deletes inquiry files in storage" on storage.objects
  for delete to authenticated using (bucket_id = 'inquiry-files');
