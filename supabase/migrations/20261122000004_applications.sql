-- 아임웹 의뢰 지원 기록(구글 시트 "초이스랩 지원 현황" 대체).
-- status / contact_status 는 시트의 실제 드롭다운 값이 늘어날 수 있어 check 제약 없이 길이만 제한한다(화면에서 알려진 값 목록으로 표시).
-- 로그인한 본인(authenticated)만 접근하고 anon에는 권한을 주지 않는다.

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  applied_on date,
  title text not null check (char_length(title) between 1 and 300),
  platform text not null default 'imweb' check (char_length(platform) <= 30),
  work_type text check (char_length(work_type) <= 100),
  budget_text text check (char_length(budget_text) <= 100),
  bid_text text check (char_length(bid_text) <= 100),
  invoice_need text check (char_length(invoice_need) <= 30),
  withholding text check (char_length(withholding) <= 30),
  competitors integer check (competitors is null or competitors >= 0),
  portfolio text check (char_length(portfolio) <= 200),
  status text not null default '지원완료' check (char_length(status) <= 30),
  contact_status text not null default '대기' check (char_length(contact_status) <= 30),
  memo text check (char_length(memo) <= 5000),
  message text check (char_length(message) <= 5000),
  experiment text check (char_length(experiment) <= 50),
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 같은 지원일 + 의뢰명은 한 번만(같은 CSV를 다시 올려도 중복되지 않게)
create unique index applications_dedupe_idx on public.applications (coalesce(applied_on, date '0001-01-01'), title);
create index applications_applied_idx on public.applications (applied_on desc nulls last, created_at desc);
create index applications_status_idx on public.applications (status);

create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();

alter table public.applications enable row level security;
revoke all on public.applications from anon;
create policy "owner all applications" on public.applications for all to authenticated using (true) with check (true);

-- 매칭된 의뢰를 고객 + 프로젝트(단계: 견적)로 전환한다. 이미 전환되었으면 기존 프로젝트 id를 반환한다.
-- 예산·세금 정보는 프로젝트 메모로 복사한다. 함수 전체가 하나의 트랜잭션이다.
create or replace function public.convert_application_to_project(p_application_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  a public.applications;
  v_customer uuid;
  v_project uuid;
  v_memo text;
begin
  select * into a from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found';
  end if;
  if a.project_id is not null then
    return a.project_id;
  end if;

  insert into public.customers (name, source)
  values (left(a.title, 100), '아임웹 의뢰')
  returning id into v_customer;

  v_memo := concat_ws(E'\n',
    case when a.budget_text is not null then '의뢰 예산(만원): ' || a.budget_text end,
    case when a.bid_text is not null then '내 견적(만원): ' || a.bid_text end,
    case when a.invoice_need is not null then '세금계산서: ' || a.invoice_need end,
    case when a.withholding is not null then '3.3% 문의: ' || a.withholding end,
    case when a.memo is not null then a.memo end
  );

  insert into public.projects (customer_id, name, stage, platform, memo)
  values (v_customer, left(a.title, 150), 'quote', case when a.platform = 'imweb' then 'imweb' end, nullif(left(v_memo, 5000), ''))
  returning id into v_project;

  update public.applications set project_id = v_project, status = '매칭완료' where id = a.id;
  return v_project;
end
$$;

revoke all on function public.convert_application_to_project(uuid) from public, anon;
grant execute on function public.convert_application_to_project(uuid) to authenticated;
