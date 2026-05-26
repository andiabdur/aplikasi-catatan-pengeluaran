-- =====================================================================
-- FIX: Merge duplicate households + harden trigger so it can't happen again
--
-- Symptom: dashboard shows kategori 2-3x (Tagihan, Tagihan, Tagihan, ...)
-- Cause:   handle_new_user() trigger fired multiple times for same user
--          (e.g., user signed up with email twice, or migration re-ran)
--          → multiple households per user.
--
-- HOW TO RUN:
--   1. Edit v_user_email below to your login email.
--   2. Supabase SQL Editor → New query → paste this → Run.
-- =====================================================================

-- ---- Part 1: harden the trigger (idempotent now) ----

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
  -- IDEMPOTENT: skip if user already belongs to a household
  if exists (select 1 from public.household_members where user_id = new.id) then
    return new;
  end if;

  insert into public.households (name)
  values ('Keluarga ' || coalesce(split_part(new.email, '@', 1), 'Baru'))
  returning id into new_household_id;

  insert into public.household_members (household_id, user_id, display_name)
  values (new_household_id, new.id, split_part(new.email, '@', 1));

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

  insert into public.incomes (household_id, month, source, amount)
  values (new_household_id, this_month, 'Abbi', 0),
         (new_household_id, this_month, 'Umma', 0);

  return new;
end;
$$;

-- ---- Part 2: cleanup duplicates ----

do $$
declare
  v_user_email text := 'andi.abdurachman@gmail.com';  -- TODO: ganti kalau email Anda beda
  v_user_id uuid;
  v_keep uuid;          -- household yang dipertahankan (yg punya expense paling banyak)
  v_drop uuid;
  v_total_dropped int := 0;
  v_total_categories_before int;
  v_total_categories_after int;
begin
  select id into v_user_id from auth.users where email = v_user_email;
  if v_user_id is null then
    raise exception 'User % tidak ditemukan', v_user_email;
  end if;

  -- Pilih household yang dipertahankan = yang punya expense terbanyak
  select hm.household_id into v_keep
  from public.household_members hm
  where hm.user_id = v_user_id
  order by (select count(*) from public.expenses e where e.household_id = hm.household_id) desc,
           (select created_at from public.households h where h.id = hm.household_id) asc
  limit 1;

  if v_keep is null then
    raise exception 'User % tidak punya household sama sekali', v_user_email;
  end if;

  select count(*) into v_total_categories_before
  from public.categories c
  join public.household_members hm on hm.household_id = c.household_id
  where hm.user_id = v_user_id;

  raise notice 'Household yang dipertahankan: %', v_keep;

  -- Hapus semua household lain milik user ini (cascade akan ikut hapus categories/budgets/incomes/expenses kosongnya)
  for v_drop in
    select hm.household_id
    from public.household_members hm
    where hm.user_id = v_user_id and hm.household_id <> v_keep
  loop
    -- Safety: kalau household yg mau di-drop punya expense, JANGAN dihapus (data berharga!)
    if exists (select 1 from public.expenses where household_id = v_drop) then
      raise notice 'SKIP household % karena punya expense — review manual!', v_drop;
      continue;
    end if;
    -- Lepas membership user dari household kosong itu
    delete from public.household_members where household_id = v_drop and user_id = v_user_id;
    -- Kalau household tsb sudah tidak punya member lain, hapus household-nya (cascade ke categories/budgets/dll)
    if not exists (select 1 from public.household_members where household_id = v_drop) then
      delete from public.households where id = v_drop;
      v_total_dropped := v_total_dropped + 1;
    end if;
  end loop;

  select count(*) into v_total_categories_after
  from public.categories c
  join public.household_members hm on hm.household_id = c.household_id
  where hm.user_id = v_user_id;

  raise notice 'Cleanup selesai. Household dihapus: %. Kategori user: % → %',
    v_total_dropped, v_total_categories_before, v_total_categories_after;
end $$;

-- ---- Part 3: cek hasil ----
select
  h.id as household_id,
  h.name,
  (select count(*) from public.categories where household_id = h.id) as kategori,
  (select count(*) from public.expenses where household_id = h.id) as expense,
  (select count(*) from public.budgets where household_id = h.id) as budget
from public.households h
where exists (select 1 from public.household_members hm where hm.household_id = h.id and hm.user_id = auth.uid());
