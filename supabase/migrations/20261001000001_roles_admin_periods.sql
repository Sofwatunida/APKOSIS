-- =====================================================
-- APKOSIS - Phase 2b: Role System Updates
-- Add super_admin, admin roles + admin_periods table + periode_id to profiles
-- =====================================================

-- =====================================================
-- 1. UPDATE PROFILES ROLE CHECK CONSTRAINT
-- =====================================================
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles add constraint profiles_role_check
  check (role in ('super_admin','admin','division_admin','monitoring','sekretaris','bendahara'));

-- Add periode_id to profiles (for Admin role - which period they manage)
alter table public.profiles add column if not exists periode_id uuid references public.periods(id);

-- Backfill: existing division_admin profiles get the default period
do $$
declare
  v_default_period_id uuid;
begin
  select id into v_default_period_id from public.periods where nama_periode = '2026/2027' limit 1;
  update public.profiles set periode_id = v_default_period_id where periode_id is null;
end $$;

create index if not exists idx_profiles_periode on public.profiles(periode_id);
create index if not exists idx_profiles_role on public.profiles(role);

-- Current user's period (untuk admin / division_admin, periode yang aktif baginya)
create or replace function public.current_periode_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select periode_id from public.profiles where id = auth.uid();
$$;

-- =====================================================
-- 2. CREATE ADMIN_PERIODS TABLE (link Admin to Period)
-- =====================================================
create table if not exists public.admin_periods (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  periode_id uuid not null references public.periods(id) on delete cascade,
  assigned_by uuid references public.profiles(id), -- Super Admin who assigned
  assigned_at timestamptz not null default now(),
  unique (admin_id, periode_id)
);

alter table public.admin_periods enable row level security;

-- Super Admin can manage all admin_periods
drop policy if exists "AdminPeriods: super_admin all" on public.admin_periods;
create policy "AdminPeriods: super_admin all" on public.admin_periods
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Admin can read their own period assignment
drop policy if exists "AdminPeriods: admin read own" on public.admin_periods;
create policy "AdminPeriods: admin read own" on public.admin_periods
  for select using (
    admin_id = auth.uid()
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- =====================================================
-- 2b. IS_ADMIN HELPER (butuh admin_periods sudah ada)
-- =====================================================
create or replace function public.is_admin(p_period_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select role = 'admin'
    from public.profiles
    where id = auth.uid()
      and (p_period_id is null or p_period_id = (select periode_id from public.admin_periods where admin_id = auth.uid() limit 1))
  ), false);
$$;

-- =====================================================
-- 3. UPDATE DIVISION_CREDENTIALS - Add periode_id
-- =====================================================
alter table public.division_credentials add column if not exists periode_id uuid references public.periods(id);

do $$
declare
  v_default_period_id uuid;
begin
  select id into v_default_period_id from public.periods where nama_periode = '2026/2027' limit 1;
  update public.division_credentials set periode_id = v_default_period_id where periode_id is null;
end $$;

alter table public.division_credentials alter column periode_id set not null;

-- Update unique constraint to include periode_id (one password per divisi per period)
alter table public.division_credentials drop constraint if exists division_credentials_pkey;
alter table public.division_credentials add primary key (divisi_id, periode_id);

create index if not exists idx_division_creds_periode on public.division_credentials(periode_id);

-- =====================================================
-- 4. UPDATE RLS POLICIES FOR PERIODS TABLE
-- =====================================================

-- Super Admin: full access to periods
drop policy if exists "Periods: super_admin all" on public.periods;
create policy "Periods: super_admin all" on public.periods
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Admin: can read active/archived periods, can update active period config
drop policy if exists "Periods: admin read" on public.periods;
create policy "Periods: admin read" on public.periods
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
    and status in ('active', 'archived')
  );

-- Admin can create new periods (only Super Admin should archive/activate)
drop policy if exists "Periods: admin insert" on public.periods;
create policy "Periods: admin insert" on public.periods
  for insert with check (
    (select role from public.profiles where id = auth.uid()) = 'admin'
  );

-- Staff (monitoring, sekretaris, bendahara): read active/archived
drop policy if exists "Periods: staff read" on public.periods;
create policy "Periods: staff read" on public.periods
  for select using (
    (select role from public.profiles where id = auth.uid()) in ('monitoring','sekretaris','bendahara')
    and status in ('active', 'archived')
  );

-- Division Admin: read active/archived (for their divisi context)
drop policy if exists "Periods: division_admin read" on public.periods;
create policy "Periods: division_admin read" on public.periods
  for select using (
    (select role from public.profiles where id = auth.uid()) = 'division_admin'
    and status in ('active', 'archived')
  );

-- =====================================================
-- 5. HELPER FUNCTION: Check if user can access period
-- =====================================================
create or replace function public.can_access_period(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then true
    when (select role from public.profiles where id = auth.uid()) = 'admin' then
      exists (
        select 1 from public.admin_periods 
        where admin_id = auth.uid() and periode_id = p_period_id
      )
    when (select role from public.profiles where id = auth.uid()) in ('monitoring','sekretaris','bendahara') then
      p_period_id in (select id from public.periods where status in ('active','archived'))
    when (select role from public.profiles where id = auth.uid()) = 'division_admin' then
      p_period_id in (select id from public.periods where status in ('active','archived'))
    else false
  end;
$$;

-- =====================================================
-- 6. TRIGGER: Prevent modification of archived period data (non-Super Admin)
-- =====================================================
create or replace function public.guard_archived_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_status text;
begin
  -- Only enforce for INSERT/UPDATE/DELETE on operational tables
  if tg_op in ('INSERT','UPDATE','DELETE') then
    -- Get period status
    select status into v_period_status from public.periods where id = new.periode_id;
    
    if v_period_status = 'archived' and not public.is_super_admin() then
      raise exception 'Cannot modify data in archived period. Contact Super Admin.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Apply guard to operational tables
drop trigger if exists trg_laporan_archived_guard on public.laporan_harian;
create trigger trg_laporan_archived_guard
  before insert or update or delete on public.laporan_harian
  for each row execute function public.guard_archived_period();

drop trigger if exists trg_transaksi_archived_guard on public.transaksi_keuangan;
create trigger trg_transaksi_archived_guard
  before insert or update or delete on public.transaksi_keuangan
  for each row execute function public.guard_archived_period();

drop trigger if exists trg_kebutuhan_archived_guard on public.kebutuhan;
create trigger trg_kebutuhan_archived_guard
  before insert or update or delete on public.kebutuhan
  for each row execute function public.guard_archived_period();

drop trigger if exists trg_pengajuan_archived_guard on public.pengajuan_dana;
create trigger trg_pengajuan_archived_guard
  before insert or update or delete on public.pengajuan_dana
  for each row execute function public.guard_archived_period();

drop trigger if exists trg_inventaris_archived_guard on public.inventaris;
create trigger trg_inventaris_archived_guard
  before insert or update or delete on public.inventaris
  for each row execute function public.guard_archived_period();

drop trigger if exists trg_program_archived_guard on public.program_kerja;
create trigger trg_program_archived_guard
  before insert or update or delete on public.program_kerja
  for each row execute function public.guard_archived_period();

drop trigger if exists trg_anggota_archived_guard on public.anggota_divisi;
create trigger trg_anggota_archived_guard
  before insert or update or delete on public.anggota_divisi
  for each row execute function public.guard_archived_period();

drop trigger if exists trg_opsi_archived_guard on public.opsi_kegiatan;
create trigger trg_opsi_archived_guard
  before insert or update or delete on public.opsi_kegiatan
  for each row execute function public.guard_archived_period();

drop trigger if exists trg_kendala_archived_guard on public.kendala_solusi;
create trigger trg_kendala_archived_guard
  before insert or update or delete on public.kendala_solusi
  for each row execute function public.guard_archived_period();

-- =====================================================
-- 7. UPDATE DIVISI RLS FOR PERIODS
-- =====================================================
-- Division Admin can only update divisi in active period (their period)
drop policy if exists "Divisi: admin sendiri update" on public.divisi;
create policy "Divisi: admin sendiri update" on public.divisi
  for update using (
    id = public.current_divisi_id()
    and periode_id = (select periode_id from public.profiles where id = auth.uid())
  )
  with check (
    id = public.current_divisi_id()
    and periode_id = (select periode_id from public.profiles where id = auth.uid())
  );

-- Super Admin can manage all divisi across periods
drop policy if exists "Divisi: super_admin all" on public.divisi;
create policy "Divisi: super_admin all" on public.divisi
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Admin can manage divisi in their assigned period
drop policy if exists "Divisi: admin period" on public.divisi;
create policy "Divisi: admin period" on public.divisi
  for all using (
    (select role from public.profiles where id = auth.uid()) = 'admin'
    and periode_id in (
      select periode_id from public.admin_periods where admin_id = auth.uid()
    )
  )
  with check (
    (select role from public.profiles where id = auth.uid()) = 'admin'
    and periode_id in (
      select periode_id from public.admin_periods where admin_id = auth.uid()
    )
  );