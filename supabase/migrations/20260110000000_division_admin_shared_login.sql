-- =====================================================
-- DIVISION ADMIN SHARED LOGIN
-- ---------------------------------------------------------
-- Satu akun Supabase Auth (divisi.apkosis26@gmail.com) untuk
-- seluruh divisi. Setelah login Auth:
--   pilih divisi -> masukkan password divisi -> dashboard divisi.
--
-- HANYA berlaku untuk role = 'division_admin'.
-- Tidak mengubah role, profile, trigger, atau RLS policy
-- milik monitoring / sekretaris / bendahara.
-- =====================================================

-- =====================================================
-- 1. EXTENSION
-- =====================================================
create extension if not exists pgcrypto;

-- =====================================================
-- 2. TABEL KHUSUS division_admin
-- =====================================================

-- Password/kode tiap divisi. Hash TIDAK PERNAH dibaca client
-- (tidak ada policy select); verifikasi lewat RPC.
create table if not exists public.division_credentials (
  divisi_id uuid primary key references public.divisi(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.division_credentials is
  'Hash password/kode divisi. Hanya dipakai role division_admin.';

-- Sesi divisi aktif. Satu baris = satu peramban yang sedang
-- mengelola sebuah divisi di bawah akun divisi bersama.
create table if not exists public.division_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

comment on table public.division_sessions is
  'Sesi divisi untuk akun division_admin bersama. Tidak dipakai role lain.';

create index if not exists division_sessions_user_idx
  on public.division_sessions (user_id);

create index if not exists division_sessions_expires_idx
  on public.division_sessions (expires_at);

-- =====================================================
-- 3. RLS BARU (KHUSUS division_admin)
-- =====================================================
alter table public.division_credentials enable row level security;
alter table public.division_sessions enable row level security;

-- Sengaja TIDAK ada policy select untuk division_credentials:
-- hash password tidak boleh keluar ke client lewat PostgREST.

drop policy if exists "Division credentials: admin divisi insert" on public.division_credentials;
create policy "Division credentials: admin divisi insert" on public.division_credentials
  for insert with check (public.is_division_admin());

drop policy if exists "Division credentials: admin divisi update" on public.division_credentials;
create policy "Division credentials: admin divisi update" on public.division_credentials
  for update using (public.is_division_admin())
             with check (public.is_division_admin());

drop policy if exists "Division credentials: admin divisi delete" on public.division_credentials;
create policy "Division credentials: admin divisi delete" on public.division_credentials
  for delete using (public.is_division_admin());

drop policy if exists "Division sessions: user read own" on public.division_sessions;
create policy "Division sessions: user read own" on public.division_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "Division sessions: user insert own" on public.division_sessions;
create policy "Division sessions: user insert own" on public.division_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Division sessions: user delete own" on public.division_sessions;
create policy "Division sessions: user delete own" on public.division_sessions
  for delete using (auth.uid() = user_id);

-- =====================================================
-- 4. FUNGSI PEMBACA TOKEN DIVISI
-- Token dikirim browser sebagai header "x-division-token" pada
-- setiap permintaan PostgREST.
-- =====================================================
create or replace function public.division_session_token()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_headers jsonb;
  v_token text;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  v_token := v_headers ->> 'x-division-token';
  return nullif(btrim(coalesce(v_token, '')), '');
exception when others then
  return null;
end;
$$;

-- =====================================================
-- 5. current_divisi_id() -- SATU-SATUNYA fungsi existing yang diubah
-- Untuk role selain division_admin, cabang else mengembalikan
-- ekspresi yang sama persis dengan definisi lama, sehingga
-- seluruh policy monitoring / sekretaris / bendahara tidak berubah.
-- Jika token sesi tidak ada, division_admin kembali ke
-- profiles.divisi_id (perilaku lama), sehingga kegagalan token
-- tidak pernah membuka akses lintas divisi.
-- =====================================================
create or replace function public.current_divisi_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_division_admin() then coalesce(
      (
        select s.divisi_id
          from public.division_sessions s
         where s.token::text = public.division_session_token()
           and s.user_id = auth.uid()
           and s.expires_at > now()
         limit 1
      ),
      (select p.divisi_id from public.profiles p where p.id = auth.uid())
    )
    else (select p.divisi_id from public.profiles p where p.id = auth.uid())
  end;
$$;

-- =====================================================
-- 6. RPC VERIFIKASI PASSWORD DIVISI
-- =====================================================
create or replace function public.verify_division_password(
  p_divisi_id uuid,
  p_password text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if not public.is_division_admin() then
    return false;
  end if;

  if p_divisi_id is null or p_password is null or p_password = '' then
    return false;
  end if;

  select c.password_hash into v_hash
    from public.division_credentials c
   where c.divisi_id = p_divisi_id;

  if v_hash is null then
    return false;
  end if;

  return crypt(p_password, v_hash) = v_hash;
end;
$$;

revoke all on function public.verify_division_password(uuid, text) from public;
grant execute on function public.verify_division_password(uuid, text) to authenticated;

-- =====================================================
-- 7. RPC SESI DIVISI (mulai / selesai)
-- =====================================================
create or replace function public.start_division_session(
  p_divisi_id uuid,
  p_password text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if not public.is_division_admin() then
    raise exception 'Akses hanya untuk akun divisi.';
  end if;

  if p_divisi_id is null or p_password is null or p_password = '' then
    raise exception 'Pilih divisi dan masukkan password divisi.';
  end if;

  if not exists (
    select 1 from public.division_credentials where divisi_id = p_divisi_id
  ) then
    raise exception 'Divisi ini belum memiliki password.';
  end if;

  if not public.verify_division_password(p_divisi_id, p_password) then
    raise exception 'Password divisi salah.';
  end if;

  delete from public.division_sessions where expires_at <= now();

  v_token := gen_random_uuid();

  insert into public.division_sessions (token, user_id, divisi_id, expires_at)
  values (v_token, auth.uid(), p_divisi_id, now() + interval '12 hours');

  return v_token;
end;
$$;

revoke all on function public.start_division_session(uuid, text) from public;
grant execute on function public.start_division_session(uuid, text) to authenticated;

create or replace function public.end_division_session(p_token uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_token is null then
    return;
  end if;

  delete from public.division_sessions
   where token = p_token
     and user_id = auth.uid();
end;
$$;

revoke all on function public.end_division_session(uuid) from public;
grant execute on function public.end_division_session(uuid) to authenticated;

