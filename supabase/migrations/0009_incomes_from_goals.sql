-- =====================================================================
-- Incomes from Goals (Penarikan / Nyoceng Tabungan ke Pemasukan)
--
-- Allows an income item to reference a goal_id when funds are drawn
-- from an existing savings goal into the current period's income.
--
-- HOW TO RUN: Supabase SQL Editor → New query → paste → Run
-- =====================================================================

alter table public.incomes
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

create index if not exists incomes_goal_idx on public.incomes(goal_id);
