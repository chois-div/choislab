-- 견적서 저장소(기존 Google 시트 대체)와 "견적 확정 → 프로젝트·입금 일정 자동 생성" 함수.
-- 로그인한 본인(authenticated)만 접근하고 anon에는 권한을 주지 않는다.

create table public.quotes (
  doc_no text primary key check (char_length(doc_no) between 1 and 50),
  client_name text not null default '' check (char_length(client_name) <= 200),
  project text not null default '' check (char_length(project) <= 300),
  total bigint not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'confirmed', 'lost')),
  data jsonb not null,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_created_idx on public.quotes (created_at desc);

create trigger quotes_touch before update on public.quotes for each row execute function public.touch_updated_at();

alter table public.quotes enable row level security;
revoke all on public.quotes from anon;
create policy "owner all quotes" on public.quotes for all to authenticated using (true) with check (true);

-- 견적 확정: 상태를 confirmed로 바꾸고, 고객(기존 선택 또는 이름 일치/신규)과 프로젝트(단계: 계약), 입금 일정을 한 번에 만든다.
-- p_split 예: [{"pct":40},{"pct":30},{"pct":30}] — 합계가 100이어야 하고, 반올림 차이는 마지막 항목이 흡수한다.
-- 이미 프로젝트가 연결된 견적이면 기존 프로젝트 id를 그대로 돌려준다. 함수 전체가 하나의 트랜잭션이다.
create or replace function public.confirm_quote(
  p_doc_no text,
  p_customer_id uuid,
  p_customer_name text,
  p_project_name text,
  p_amount bigint,
  p_split jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  q public.quotes;
  v_customer uuid;
  v_project uuid;
  n int := coalesce(jsonb_array_length(p_split), 0);
  i int;
  v_sum numeric := 0;
  v_paid bigint := 0;
  v_amt bigint;
  v_kind text;
begin
  select * into q from public.quotes where doc_no = p_doc_no for update;
  if not found then
    raise exception 'quote_not_found';
  end if;
  if q.project_id is not null then
    return q.project_id;
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'invalid_amount';
  end if;
  if coalesce(trim(p_project_name), '') = '' then
    raise exception 'project_name_required';
  end if;
  if n > 0 then
    select coalesce(sum((e ->> 'pct')::numeric), 0) into v_sum from jsonb_array_elements(p_split) e;
    if v_sum <> 100 then
      raise exception 'split_must_total_100';
    end if;
  end if;

  if p_customer_id is not null then
    select id into v_customer from public.customers where id = p_customer_id;
    if v_customer is null then
      raise exception 'customer_not_found';
    end if;
  else
    if coalesce(trim(p_customer_name), '') = '' then
      raise exception 'customer_name_required';
    end if;
    select id into v_customer from public.customers where name = trim(p_customer_name) limit 1;
    if v_customer is null then
      insert into public.customers (name, source) values (trim(p_customer_name), '견적서') returning id into v_customer;
    end if;
  end if;

  insert into public.projects (customer_id, name, stage, contract_amount, quote_doc_no)
  values (v_customer, trim(p_project_name), 'contract', p_amount, p_doc_no)
  returning id into v_project;

  for i in 0 .. n - 1 loop
    if i = n - 1 then
      v_amt := p_amount - v_paid;
    else
      v_amt := round(p_amount * ((p_split -> i ->> 'pct')::numeric) / 100);
    end if;
    v_paid := v_paid + v_amt;
    v_kind := case when n = 1 then 'balance' when i = 0 then 'deposit' when i = n - 1 then 'balance' else 'interim' end;
    if v_amt > 0 then
      insert into public.payments (project_id, kind, amount) values (v_project, v_kind, v_amt);
    end if;
  end loop;

  update public.quotes set status = 'confirmed', project_id = v_project where doc_no = p_doc_no;
  return v_project;
end
$$;

revoke all on function public.confirm_quote(text, uuid, text, text, bigint, jsonb) from public, anon;
grant execute on function public.confirm_quote(text, uuid, text, text, bigint, jsonb) to authenticated;
