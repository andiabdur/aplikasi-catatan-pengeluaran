-- =====================================================================
-- API Tokens & MCP (Model Context Protocol) Integration
--
-- Menyimpan Access Token untuk integrasi agen AI eksternal (Google Gemini,
-- Claude, OmniRoute, OpenClaw, dll.) dengan otorisasi berbasis household.
--
-- CARA MENJALANKAN:
-- Buka Supabase SQL Editor -> New query -> Paste isi file ini -> Run
-- =====================================================================

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  token_prefix text not null,
  scopes text[] not null default array['all'],
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Indeks performa pencarian hash & household
create index if not exists idx_api_tokens_token_hash on public.api_tokens(token_hash);
create index if not exists idx_api_tokens_household_id on public.api_tokens(household_id);
create index if not exists idx_api_tokens_user_id on public.api_tokens(user_id);

-- Aktifkan Row-Level Security
alter table public.api_tokens enable row level security;

-- Policy RLS: hanya anggota household yang dapat melihat token household-nya
create policy "api_tokens_select_policy"
  on public.api_tokens for select
  using (public.is_household_member(household_id));

-- Policy RLS: hanya anggota household yang dapat membuat token
create policy "api_tokens_insert_policy"
  on public.api_tokens for insert
  with check (public.is_household_member(household_id) and auth.uid() = user_id);

-- Policy RLS: hanya pemilik token atau anggota household yang dapat menghapus token
create policy "api_tokens_delete_policy"
  on public.api_tokens for delete
  using (public.is_household_member(household_id));

-- RPC Fungsi Keamanan: verify_api_token
-- Memvalidasi hash token dan memperbarui timestamp last_used_at secara atomik.
create or replace function public.verify_api_token(p_token_hash text)
returns table (
  token_id uuid,
  household_id uuid,
  user_id uuid,
  token_name text,
  scopes text[]
)
language plpgsql
security definer
as $$
declare
  v_row record;
begin
  select t.id, t.household_id, t.user_id, t.name, t.scopes
  into v_row
  from public.api_tokens t
  where t.token_hash = p_token_hash
  limit 1;

  if found then
    update public.api_tokens
    set last_used_at = now()
    where id = v_row.id;

    return query select v_row.id, v_row.household_id, v_row.user_id, v_row.name, v_row.scopes;
  end if;
  return;
end;
$$;

grant execute on function public.verify_api_token(text) to anon, authenticated, service_role;
