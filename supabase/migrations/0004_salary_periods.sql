-- =====================================================================
-- Salary period system
--
-- A "period" = the timeframe funded by one paycheck. Default pay day = 25.
-- Period "Gajian Juni 2026" = 25 Mei 2026 → 24 Juni 2026
-- (labeled by month containing the END of the period)
--
-- HOW TO RUN: Supabase SQL Editor → New query → paste → Run
-- =====================================================================

-- ---- pay day setting on household ----
alter table public.households
  add column if not exists pay_day_of_month int not null default 25;

alter table public.households
  drop constraint if exists households_pay_day_check;
alter table public.households
  add constraint households_pay_day_check check (pay_day_of_month between 1 and 28);

-- ---- helper SQL functions ----

-- Given a label-month (first day of the month the period ENDS in) and pay day,
-- return the period's START date (pay_day of previous month).
create or replace function public.period_start(p_label_month date, p_pay_day int)
returns date
language sql
immutable
as $$
  select ((p_label_month - interval '1 month')::date + (p_pay_day - 1));
$$;

-- Period END date (inclusive) — day before next period's pay day = (pay_day - 1) of label month.
create or replace function public.period_end(p_label_month date, p_pay_day int)
returns date
language sql
immutable
as $$
  select (p_label_month + (p_pay_day - 2));
$$;

-- Given a date, return its period label-month.
create or replace function public.period_label_for(p_date date, p_pay_day int)
returns date
language sql
immutable
as $$
  select case
    when extract(day from p_date)::int >= p_pay_day
      then (date_trunc('month', p_date) + interval '1 month')::date
    else date_trunc('month', p_date)::date
  end;
$$;

-- Current period label (uses CURRENT_DATE).
create or replace function public.current_period_label(p_pay_day int)
returns date
language sql
stable
as $$
  select public.period_label_for(current_date, p_pay_day);
$$;

-- ---- RPC: summary for a given period of a household ----
-- Replaces v_monthly_summary which was hardcoded to calendar months.

drop view if exists public.v_monthly_summary;

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
  pr as (
    select public.period_start(p_label_month, h.pd) as ps,
           public.period_end(p_label_month, h.pd) as pe
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

-- Done. Existing data preserved — semantics of budgets.month now interpreted
-- as "first day of label month" of a period instead of a calendar month.
