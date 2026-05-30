-- =====================================================================
-- Goals — family financial targets (Umroh, trip to Japan, etc.)
--
-- A goal is funded by tagging "Nabung" expenses to it. A goal's saved
-- amount = sum of expenses.amount where expenses.goal_id = goal.id.
-- No separate wallet/balance table — the tag IS the link, so progress
-- can never drift out of sync.
--
-- HOW TO RUN: Supabase SQL Editor → New query → paste → Run
-- =====================================================================

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null default 0 check (target_amount >= 0),
  target_date date,
  emoji text not null default '🎯',
  color text not null default '#16a34a',
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists goals_household_idx on public.goals(household_id, status);

-- Link a savings deposit to a goal. Only "Nabung" expenses set this.
-- on delete set null: deleting a goal keeps the expense, just untags it.
alter table public.expenses
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

create index if not exists expenses_goal_idx on public.expenses(goal_id);

-- =========== RLS ===========

alter table public.goals enable row level security;

drop policy if exists "members manage goals" on public.goals;
create policy "members manage goals" on public.goals
  for all using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Done. Existing expenses untouched (goal_id defaults to NULL).
