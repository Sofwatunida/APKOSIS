-- =====================================================
-- APKOSIS - Saldo Awal & Catatan Program Belum Terlaksana
-- Jalankan file ini di Supabase SQL Editor
--
-- Tujuan:
-- 1. Menyimpan "Saldo Awal" yang di-set oleh role Bendahara pada
--    fitur Transaksi. Nilai konstan sampai di-edit oleh bendahara.
-- 2. Menyimpan "Catatan Program Belum Terlaksana" per divisi,
--    agar dapat dilihat oleh role Sekretaris / Monitoring.
-- =====================================================

-- -----------------------------------------------------
-- 1. TABLE saldo_awal (single row, id = 1)
-- -----------------------------------------------------
create table if not exists public.saldo_awal (
  id integer primary key default 1 constraint saldo_awal_single_row check (id = 1),
  nominal numeric(15,2) not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.saldo_awal (id, nominal)
values (1, 0)
on conflict (id) do nothing;

alter table public.saldo_awal enable row level security;

-- Semua user yang login boleh membaca saldo awal
drop policy if exists "SaldoAwal: select" on public.saldo_awal;
create policy "SaldoAwal: select" on public.saldo_awal
  for select using (true);

-- Hanya bendahara yang boleh set / edit saldo awal
drop policy if exists "SaldoAwal: bendahara insert" on public.saldo_awal;
create policy "SaldoAwal: bendahara insert" on public.saldo_awal
  for insert with check (public.is_bendahara());

drop policy if exists "SaldoAwal: bendahara update" on public.saldo_awal;
create policy "SaldoAwal: bendahara update" on public.saldo_awal
  for update using (public.is_bendahara())
               with check (public.is_bendahara());

drop policy if exists "SaldoAwal: bendahara delete" on public.saldo_awal;
create policy "SaldoAwal: bendahara delete" on public.saldo_awal
  for delete using (public.is_bendahara());

-- -----------------------------------------------------
-- 2. TABLE divisi: tambah kolom catatan program belum terlaksana
-- -----------------------------------------------------
alter table public.divisi
  add column if not exists catatan_program_belum_terlaksana text;