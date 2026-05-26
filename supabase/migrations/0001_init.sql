-- ============================================================
-- Family Expense Tracker — Initial schema
-- Run this in your Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- =========== TABLES ===========

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  color text default '#16a34a',
  sort_order int not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null default 0,
  unique (category_id, month)
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null,
  source text not null,
  amount numeric(14,2) not null default 0
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  spent_at date not null default current_date,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index expenses_household_date_idx on public.expenses(household_id, spent_at desc);
create index expenses_household_category_idx on public.expenses(household_id, category_id);
create index budgets_household_month_idx on public.budgets(household_id, month);
create index incomes_household_month_idx on public.incomes(household_id, month);

-- =========== AUTO-PROVISION ON SIGNUP ===========

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
  this_month date := date_trunc('month', current_date)::date;
begin
  -- Create household
  insert into public.households (name)
  values ('Keluarga ' || coalesce(split_part(new.email, '@', 1), 'Baru'))
  returning id into new_household_id;

  -- Add user as member
  insert into public.household_members (household_id, user_id, display_name)
  values (new_household_id, new.id, split_part(new.email, '@', 1));

  -- Seed default categories (from user's existing Google Sheet)
  insert into public.categories (household_id, name, sort_order, color) values
    (new_household_id, 'Tagihan',                1, '#ef4444'),
    (new_household_id, 'Kebutuhan Anak',         2, '#f97316'),
    (new_household_id, 'Kebutuhan Rumah Tangga', 3, '#eab308'),
    (new_household_id, 'Makan',                  4, '#22c55e'),
    (new_household_id, 'Transportasi',           5, '#06b6d4'),
    (new_household_id, 'Kebutuhan Tambahan',     6, '#3b82f6'),
    (new_household_id, 'Self Reward Umma',       7, '#a855f7'),
    (new_household_id, 'Self Reward Abbi',       8, '#ec4899'),
    (new_household_id, 'Kebutuhan Kultural',     9, '#14b8a6'),
    (new_household_id, 'Nabung',                10, '#64748b');

  -- Seed default budgets for current month (matches user's June 2026 sheet)
  insert into public.budgets (household_id, category_id, month, amount)
  select new_household_id, c.id, this_month,
    case c.name
      when 'Tagihan'                then 1000000
      when 'Kebutuhan Anak'         then 5000000
      when 'Kebutuhan Rumah Tangga' then 1000000
      when 'Makan'                  then 3000000
      when 'Transportasi'           then 2000000
      when 'Kebutuhan Tambahan'     then 500000
      when 'Self Reward Umma'       then 1000000
      when 'Self Reward Abbi'       then 500000
      when 'Kebutuhan Kultural'     then 4000000
      else 0
    end
  from public.categories c
  where c.household_id = new_household_id;

  -- Seed income placeholder
  insert into public.incomes (household_id, month, source, amount)
  values (new_household_id, this_month, 'Abbi', 0),
         (new_household_id, this_month, 'Umma', 0);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========== ROW-LEVEL SECURITY ===========

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.categories        enable row level security;
alter table public.budgets           enable row level security;
alter table public.incomes           enable row level security;
alter table public.expenses          enable row level security;

create or replace function public.is_household_member(_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = _household_id and user_id = auth.uid()
  );
$$;

-- households
create policy "view own household" on public.households
  for select using (public.is_household_member(id));

-- household_members
create policy "view own membership" on public.household_members
  for select using (user_id = auth.uid() or public.is_household_member(household_id));

-- categories
create policy "members manage categories" on public.categories
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- budgets
create policy "members manage budgets" on public.budgets
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- incomes
create policy "members manage incomes" on public.incomes
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- expenses
create policy "members manage expenses" on public.expenses
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- =========== HELPER VIEW: monthly summary ===========

create or replace view public.v_monthly_summary as
select
  c.household_id,
  c.id as category_id,
  c.name as category_name,
  c.color,
  c.sort_order,
  date_trunc('month', current_date)::date as month,
  coalesce(b.amount, 0) as budget,
  coalesce(spent.total, 0) as spent,
  coalesce(b.amount, 0) - coalesce(spent.total, 0) as remaining,
  case
    when coalesce(b.amount, 0) = 0 then 0
    else round((coalesce(spent.total, 0) / b.amount) * 100, 2)
  end as usage_pct
from public.categories c
left join public.budgets b
  on b.category_id = c.id
  and b.month = date_trunc('month', current_date)::date
left join lateral (
  select sum(e.amount) as total
  from public.expenses e
  where e.category_id = c.id
    and date_trunc('month', e.spent_at) = date_trunc('month', current_date)
) spent on true
where c.is_archived = false;

-- Done. Default categories + budgets are auto-created the moment a user signs up.
