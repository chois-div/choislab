create table if not exists public.contracts (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  status text not null check (status in ('draft', 'sending', 'sent', 'signed', 'declined')),
  token_hash text,
  expires_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_token_hash_format check (
    token_hash is null or token_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint contracts_token_hash_consistent check (
    token_hash is null or token_hash = data->>'tokenHash'
  )
);

create unique index if not exists contracts_token_hash_unique
  on public.contracts (token_hash)
  where token_hash is not null;

create index if not exists contracts_owner_updated_at
  on public.contracts (owner_id, updated_at desc);

alter table public.contracts enable row level security;
grant select on public.contracts to authenticated;
grant all on public.contracts to service_role;

drop policy if exists "Contract owners can read their records" on public.contracts;
create policy "Contract owners can read their records"
  on public.contracts for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "Contract owners can create their records" on public.contracts;
drop policy if exists "Contract owners can update their records" on public.contracts;
drop policy if exists "Contract owners can delete their records" on public.contracts;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-files', 'contract-files', false, 15728640, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 15728640,
    allowed_mime_types = array['application/pdf'];

drop policy if exists "Contract owners can read their files" on storage.objects;
create policy "Contract owners can read their files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'contract-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Contract owners can upload their files" on storage.objects;
create policy "Contract owners can upload their files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contract-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Contract owners can update their files" on storage.objects;
create policy "Contract owners can update their files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'contract-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'contract-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Contract owners can delete their files" on storage.objects;
create policy "Contract owners can delete their files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'contract-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
