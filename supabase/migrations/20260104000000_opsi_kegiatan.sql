-- =====================================================
-- APKOSIS - Opsi Kegiatan (Dropdown Kegiatan Hari Ini)
-- Jalankan file ini di Supabase SQL Editor
--
-- Tujuan:
-- Menyimpan daftar kegiatan yang bisa dipilih lewat dropdown
-- pada form Laporan Harian. Daftar ini dikustomisasi sendiri
-- oleh Ketua / Wakil (role division_admin) per divisi, selain
-- tetap bisa mengetik kegiatan secara manual.
-- =====================================================

-- -----------------------------------------------------
-- 1. TABLE opsi_kegiatan
-- -----------------------------------------------------
create table if not exists public.opsi_kegiatan (
  id uuid primary key default gen_random_uuid(),
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  nama_kegiatan text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_opsi_kegiatan_divisi_id on public.opsi_kegiatan(divisi_id);

drop trigger if exists trg_opsi_kegiatan_updated_at on public.opsi_kegiatan;
create trigger trg_opsi_kegiatan_updated_at
  before update on public.opsi_kegiatan
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- -----------------------------------------------------
alter table public.opsi_kegiatan enable row level security;

-- Staf (monitoring/sekretaris) dan admin divisi dapat melihat daftar
drop policy if exists "OpsiKegiatan: select" on public.opsi_kegiatan;
create policy "OpsiKegiatan: select" on public.opsi_kegiatan
  for select using (public.is_staff() or public.is_division_admin());

-- Hanya ketua/wakil (division_admin) divisi terkait yang boleh menambah
drop policy if exists "OpsiKegiatan: insert own divisi" on public.opsi_kegiatan;
create policy "OpsiKegiatan: insert own divisi" on public.opsi_kegiatan
  for insert with check (public.is_division_admin() and divisi_id = public.current_divisi_id());

drop policy if exists "OpsiKegiatan: update own divisi" on public.opsi_kegiatan;
create policy "OpsiKegiatan: update own divisi" on public.opsi_kegiatan
  for update using (public.is_division_admin() and divisi_id = public.current_divisi_id())
               with check (public.is_division_admin() and divisi_id = public.current_divisi_id());

drop policy if exists "OpsiKegiatan: delete own divisi" on public.opsi_kegiatan;
create policy "OpsiKegiatan: delete own divisi" on public.opsi_kegiatan
  for delete using (public.is_division_admin() and divisi_id = public.current_divisi_id());