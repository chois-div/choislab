-- 고객·프로젝트·입금·세금 테이블과 문의 → 프로젝트 전환 함수.
-- 모든 테이블은 로그인한 본인(authenticated)만 접근하고 anon에는 권한을 주지 않는다.
-- 신규 가입(sign-ups)이 꺼져 있어야 "authenticated = 본인 1명"이 성립한다.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  contact_name text check (char_length(contact_name) <= 100),
  phone text check (char_length(phone) <= 50),
  email text check (char_length(email) <= 200),
  source text check (char_length(source) <= 50),
  memo text check (char_length(memo) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 150),
  stage text not null default 'inquiry' check (stage in ('inquiry', 'quote', 'contract', 'production', 'review', 'done', 'hold')),
  start_date date,
  due_date date,
  contract_amount bigint not null default 0 check (contract_amount >= 0),
  memo text check (char_length(memo) <= 5000),
  quote_doc_no text check (char_length(quote_doc_no) <= 50),
  platform text check (platform in ('imweb', 'framer', 'other')),
  plan_name text check (char_length(plan_name) <= 100),
  plan_paid_by text check (plan_paid_by in ('self', 'client')),
  plan_paid_at date,
  plan_expires_at date,
  plan_auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'interim', 'balance')),
  amount bigint not null check (amount > 0),
  due_date date,
  paid_at date,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('tax_invoice', 'withholding_3_3')),
  amount bigint not null check (amount > 0),
  issued boolean not null default false,
  issued_at date,
  memo text check (char_length(memo) <= 500),
  created_at timestamptz not null default now()
);

create index projects_customer_idx on public.projects (customer_id);
create index projects_stage_due_idx on public.projects (stage, due_date);
create index projects_plan_expires_idx on public.projects (plan_expires_at) where plan_expires_at is not null;
create index payments_project_idx on public.payments (project_id);
create index invoices_project_idx on public.invoices (project_id);

create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

alter table public.inquiries
  add constraint inquiries_project_fk foreign key (project_id) references public.projects (id) on delete set null;

alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;

revoke all on public.customers, public.projects, public.payments, public.invoices from anon;

create policy "owner all customers" on public.customers for all to authenticated using (true) with check (true);
create policy "owner all projects" on public.projects for all to authenticated using (true) with check (true);
create policy "owner all payments" on public.payments for all to authenticated using (true) with check (true);
create policy "owner all invoices" on public.invoices for all to authenticated using (true) with check (true);

-- 문의 1건을 고객 + 프로젝트(단계: 문의)로 전환한다. 이미 전환된 문의면 기존 프로젝트 id를 그대로 돌려준다.
-- 함수 전체가 하나의 트랜잭션이라 중간에 실패하면 고객·프로젝트·연결 중 아무것도 남지 않는다.
create or replace function public.convert_inquiry_to_project(p_inquiry_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  q public.inquiries;
  v_customer uuid;
  v_project uuid;
  v_email text;
  v_phone text;
  v_platform text;
begin
  select * into q from public.inquiries where id = p_inquiry_id for update;
  if not found then
    raise exception 'inquiry_not_found';
  end if;
  if q.project_id is not null then
    return q.project_id;
  end if;

  if position('@' in q.contact) > 0 then
    v_email := q.contact;
  else
    v_phone := q.contact;
  end if;

  select id into v_customer from public.customers
   where name = q.name
     and ((v_email is not null and email = v_email) or (v_phone is not null and phone = v_phone))
   limit 1;

  if v_customer is null then
    insert into public.customers (name, email, phone, source)
    values (q.name, v_email, v_phone, '홈페이지 문의')
    returning id into v_customer;
  end if;

  v_platform := case q.platform_pref when '아임웹' then 'imweb' when '프레이머' then 'framer' else null end;

  insert into public.projects (customer_id, name, stage, due_date, platform, memo)
  values (v_customer, q.name || ' ' || q.inquiry_type, 'inquiry', q.desired_launch, v_platform, left(q.message, 1000))
  returning id into v_project;

  update public.inquiries set project_id = v_project where id = q.id;
  return v_project;
end
$$;

revoke all on function public.convert_inquiry_to_project(uuid) from public, anon;
grant execute on function public.convert_inquiry_to_project(uuid) to authenticated;
