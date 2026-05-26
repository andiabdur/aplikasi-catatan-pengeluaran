-- =====================================================================
-- Custom Pay Period Ranges
-- Allows overriding the period range for specific months (periods).
-- =====================================================================

create table if not exists public.custom_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label_month date not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint custom_periods_dates_check check (start_date <= end_date),
  unique (household_id, label_month)
);

-- Enable RLS
alter table public.custom_periods enable row level security;

-- Policy for members
create policy "members manage custom_periods" on public.custom_periods
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Update RPC f_period_summary to check custom_periods
create or replace function public.f_period_summary(
  p_household_id uuid,
  p_label_month  date
)
returns table (
  household_id  uuid,
  category_id   uuid,
  category_name text,
  color         text,
  sort_order    int,
  label_month   date,
  period_start  date,
  period_end    date,
  budget        numeric,
  spent         numeric,
  remaining     numeric,
  usage_pct     numeric
)
language sql
stable
security invoker
as $$
  with h as (
    select pay_day_of_month as pd from public.households where id = p_household_id
  ),
  cp as (
    select start_date, end_date
    from public.custom_periods
    where household_id = p_household_id and label_month = p_label_month
  ),
  pr as (
    select
      coalesce((select start_date from cp), public.period_start(p_label_month, h.pd)) as ps,
      coalesce((select end_date from cp), public.period_end(p_label_month, h.pd)) as pe
    from h
  )
  select
    c.household_id,
    c.id          as category_id,
    c.name        as category_name,
    c.color,
    c.sort_order,
    p_label_month as label_month,
    pr.ps         as period_start,
    pr.pe         as period_end,
    coalesce(b.amount, 0)::numeric as budget,
    coalesce(spent.total, 0)::numeric as spent,
    (coalesce(b.amount, 0) - coalesce(spent.total, 0))::numeric as remaining,
    case when coalesce(b.amount, 0) = 0 then 0::numeric
         else round((coalesce(spent.total, 0) / b.amount) * 100, 2)
    end as usage_pct
  from public.categories c
  cross join pr
  left join public.budgets b
    on b.category_id = c.id and b.month = p_label_month
  left join lateral (
    select sum(e.amount) as total
    from public.expenses e
    where e.category_id = c.id
      and e.spent_at between pr.ps and pr.pe
  ) spent on true
  where c.household_id = p_household_id
    and c.is_archived = false
  order by c.sort_order;
$$;
