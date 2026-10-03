-- =====================================================
-- APKOSIS - Phase 2: Periods System
-- Create periods table and add periode_id to all operational tables
-- =====================================================

-- =====================================================
-- 1. CREATE PERIODS TABLE
-- =====================================================
create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  nama_periode text not null unique,        -- "2026/2027"
  tahun_mulai integer not null,             -- 2026
  tahun_selesai integer not null,           -- 2027
  status text not null default 'inactive'   -- active, archived, inactive
    check (status in ('active','archived','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_periods_updated_at on public.periods;
create trigger trg_periods_updated_at
  before update on public.periods
  for each row execute function public.handle_updated_at();

-- Index for performance
create index if not exists idx_periods_status on public.periods(status);
create index if not exists idx_periods_nama on public.periods(nama_periode);

-- Enable RLS
alter table public.periods enable row level security;

-- Policy: Super Admin full access (will be enforced via role check in policies below)
-- For now: authenticated users can read active/archived periods
drop policy if exists "Periods: read active and archived" on public.periods;
create policy "Periods: read active and archived" on public.periods
  for select using (
    status in ('active', 'archived')
    and auth.role() = 'authenticated'
  );

-- Policy: Super Admin can do everything (to be implemented with is_super_admin function)
-- This will be updated in Phase 9

-- =====================================================
-- 2. SEED DEFAULT PERIOD (2026/2027 as active)
-- =====================================================
insert into public.periods (nama_periode, tahun_mulai, tahun_selesai, status)
values ('2026/2027', 2026, 2027, 'active')
on conflict (nama_periode) do nothing;

-- =====================================================
-- 3. ADD PERIODE_ID TO OPERATIONAL TABLES
-- =====================================================

-- 3.1 laporan_harian
alter table public.laporan_harian add column if not exists periode_id uuid references public.periods(id);

-- 3.2 transaksi_keuangan
alter table public.transaksi_keuangan add column if not exists periode_id uuid references public.periods(id);

-- 3.3 kebutuhan
alter table public.kebutuhan add column if not exists periode_id uuid references public.periods(id);

-- 3.4 pengajuan_dana
alter table public.pengajuan_dana add column if not exists periode_id uuid references public.periods(id);

-- 3.5 inventaris
alter table public.inventaris add column if not exists periode_id uuid references public.periods(id);

-- 3.6 program_kerja
alter table public.program_kerja add column if not exists periode_id uuid references public.periods(id);

-- 3.7 anggota_divisi
alter table public.anggota_divisi add column if not exists periode_id uuid references public.periods(id);

-- 3.8 opsi_kegiatan
alter table public.opsi_kegiatan add column if not exists periode_id uuid references public.periods(id);

-- 3.9 kendala_solusi (via laporan_harian, but add for direct query performance)
alter table public.kendala_solusi add column if not exists periode_id uuid references public.periods(id);

-- =====================================================
-- 4. BACKFILL EXISTING DATA TO DEFAULT PERIOD (2026/2027)
-- =====================================================

-- Get the default period ID
do $$
declare
  v_default_period_id uuid;
begin
  select id into v_default_period_id from public.periods where nama_periode = '2026/2027' limit 1;
  
  if v_default_period_id is null then
    raise exception 'Default period 2026/2027 not found';
  end if;

  -- Backfill all operational tables
  update public.laporan_harian set periode_id = v_default_period_id where periode_id is null;
  update public.transaksi_keuangan set periode_id = v_default_period_id where periode_id is null;
  update public.kebutuhan set periode_id = v_default_period_id where periode_id is null;
  update public.pengajuan_dana set periode_id = v_default_period_id where periode_id is null;
  update public.inventaris set periode_id = v_default_period_id where periode_id is null;
  update public.program_kerja set periode_id = v_default_period_id where periode_id is null;
  update public.anggota_divisi set periode_id = v_default_period_id where periode_id is null;
  update public.opsi_kegiatan set periode_id = v_default_period_id where periode_id is null;
  
  -- For kendala_solusi, get periode_id from laporan_harian
  update public.kendala_solusi ks
  set periode_id = lh.periode_id
  from public.laporan_harian lh
  where ks.laporan_id = lh.id
    and ks.periode_id is null;
end $$;

-- =====================================================
-- 5. SET NOT NULL AFTER BACKFILL
-- =====================================================
alter table public.laporan_harian alter column periode_id set not null;
alter table public.transaksi_keuangan alter column periode_id set not null;
alter table public.kebutuhan alter column periode_id set not null;
alter table public.pengajuan_dana alter column periode_id set not null;
alter table public.inventaris alter column periode_id set not null;
alter table public.program_kerja alter column periode_id set not null;
alter table public.anggota_divisi alter column periode_id set not null;
alter table public.opsi_kegiatan alter column periode_id set not null;
alter table public.kendala_solusi alter column periode_id set not null;

-- =====================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
create index if not exists idx_laporan_periode_divisi on public.laporan_harian(periode_id, divisi_id);
create index if not exists idx_laporan_periode_tanggal on public.laporan_harian(periode_id, tanggal);
create index if not exists idx_transaksi_periode_divisi on public.transaksi_keuangan(periode_id, divisi_id);
create index if not exists idx_transaksi_periode_tanggal on public.transaksi_keuangan(periode_id, tanggal);
create index if not exists idx_kebutuhan_periode_divisi on public.kebutuhan(periode_id, divisi_id);
create index if not exists idx_pengajuan_periode_divisi on public.pengajuan_dana(periode_id, divisi_id);
create index if not exists idx_inventaris_periode_divisi on public.inventaris(periode_id, divisi_id);
create index if not exists idx_program_periode_divisi on public.program_kerja(periode_id, divisi_id);
create index if not exists idx_anggota_periode_divisi on public.anggota_divisi(periode_id, divisi_id);
create index if not exists idx_opsi_periode_divisi on public.opsi_kegiatan(periode_id, divisi_id);
-- kendala_solusi tidak punya kolom divisi_id (scope via laporan_harian), jadi index per periode saja
create index if not exists idx_kendala_periode on public.kendala_solusi(periode_id);

-- =====================================================
-- 7. UPDATE DIVISI TABLE - Keep periode column for backward compat
--    but add periode_id as proper FK
-- =====================================================
alter table public.divisi add column if not exists periode_id uuid references public.periods(id);

-- Backfill divisi.periode_id from divisi.periode text column
do $$
declare
  v_period_id uuid;
begin
  select id into v_period_id from public.periods where nama_periode = '2026/2027' limit 1;
  update public.divisi set periode_id = v_period_id where periode_id is null;
end $$;

create index if not exists idx_divisi_periode on public.divisi(periode_id);

-- =====================================================
-- 8. HELPER FUNCTIONS FOR PERIODS
-- =====================================================

-- Get active period ID
create or replace function public.get_active_period_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.periods where status = 'active' limit 1;
$$;

-- Get all periods for dropdown (active + archived)
create or replace function public.get_periods_for_dropdown()
returns table (id uuid, nama_periode text, tahun_mulai int, tahun_selesai int, status text)
language sql
stable
security definer
set search_path = public
as $$
  select id, nama_periode, tahun_mulai, tahun_selesai, status
  from public.periods
  where status in ('active', 'archived')
  order by tahun_mulai desc;
$$;

-- Check if user is Super Admin
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select role = 'super_admin' from public.profiles where id = auth.uid()
  ), false);
$$;

-- CATATAN: public.is_admin() dan public.current_periode_id() dibuat di
-- migration berikutnya (0001), karena keduanya butuh kolom/tabel yang
-- baru ada di sana: public.admin_periods dan public.profiles.periode_id.