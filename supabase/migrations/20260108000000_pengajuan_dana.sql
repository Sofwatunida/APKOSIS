-- =====================================================
-- APKOSIS - Migration: Pengajuan Dana
-- Tujuan:
--   1. Tabel baru pengajuan_dana (permintaan uang yang dibuat berdasarkan
--      Kebutuhan Divisi).
--   2. Satu pengajuan = satu kebutuhan (relasi database, bukan duplikasi).
--   3. Status hanya boleh diubah Bendahara (dijaga RLS + trigger).
-- Jalankan file ini di Supabase SQL Editor (setelah migration sebelumnya).
-- =====================================================

create table if not exists public.pengajuan_dana (
  id uuid primary key default gen_random_uuid(),
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  -- Relasi ke kebutuhan asal. Satu kebutuhan hanya boleh punya 1 pengajuan.
  kebutuhan_id uuid references public.kebutuhan(id) on delete set null,
  tanggal_pengajuan date not null,
  nominal numeric(15,2) not null check (nominal > 0),
  keperluan text not null,
  status_persetujuan text not null default 'belum'
    check (status_persetujuan in ('belum','disetujui')),
  status_pengambilan text not null default 'belum'
    check (status_pengambilan in ('belum','sudah_diambil')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  taken_by uuid references auth.users(id),
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mencegah dua pengajuan dana untuk kebutuhan yang sama.
  -- Kolom yang NULL tetap boleh banyak (pengajuan tanpa kebutuhan).
  constraint pengajuan_dana_unik_kebutuhan unique (kebutuhan_id)
);

create index if not exists idx_pengajuan_dana_divisi_id on public.pengajuan_dana(divisi_id);
create index if not exists idx_pengajuan_dana_user_id on public.pengajuan_dana(user_id);
create index if not exists idx_pengajuan_dana_tanggal on public.pengajuan_dana(tanggal_pengajuan);
create index if not exists idx_pengajuan_dana_status
  on public.pengajuan_dana(status_persetujuan, status_pengambilan);

drop trigger if exists trg_pengajuan_dana_updated_at on public.pengajuan_dana;
create trigger trg_pengajuan_dana_updated_at
  before update on public.pengajuan_dana
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 1. TRIGGER INVARIANT
-- =====================================================
-- Menjamin status + waktu + user selalu konsisten, walaupun ada yang
-- mencoba mengubah langsung lewat API.
create or replace function public.guard_pengajuan_dana()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hanya Bendahara yang boleh mengubah data pengajuan.
  -- auth.uid() is null = dijalankan lewat SQL Editor / service role (admin DB).
  if auth.uid() is not null and not public.is_bendahara() then
    raise exception 'Status pengajuan dana hanya dapat diubah oleh Bendahara.'
      using errcode = '42501';
  end if;

  -- Uang tidak boleh ditandai diambil sebelum pengajuan disetujui.
  if new.status_pengambilan = 'sudah_diambil' and new.status_persetujuan <> 'disetujui' then
    raise exception 'Uang tidak bisa ditandai sudah diambil sebelum pengajuan disetujui.'
      using errcode = '42501';
  end if;

  -- Waktu & user dicatat otomatis oleh database.
  if new.status_persetujuan = 'disetujui' and new.approved_at is null then
    new.approved_at = now();
    new.approved_by = auth.uid();
  end if;

  if new.status_persetujuan <> 'disetujui' then
    -- Belum disetujui berarti belum ada pengambilan.
    new.status_pengambilan = 'belum';
    new.taken_at = null;
    new.taken_by = null;
  elsif new.status_pengambilan = 'sudah_diambil' and new.taken_at is null then
    new.taken_at = now();
    new.taken_by = auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pengajuan_dana_guard on public.pengajuan_dana;
create trigger trg_pengajuan_dana_guard
  before update on public.pengajuan_dana
  for each row execute function public.guard_pengajuan_dana();

-- =====================================================
-- 1b. KEBUTUHAN OTOMATIS TERPENUHI SAAT DANA DITERIMA
-- =====================================================
-- Setelah uang benar-benar diambil, kebutuhan asalnya tidak lagi "menunggu".
-- Perubahan dilakukan dari database supaya status tidak bisa berbeda antara
-- halaman "Kebutuhan Divisi" dan "Pengajuan Dana".
create or replace function public.sync_kebutuhan_sudah_dipenuhi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kebutuhan_id is not null
     and new.status_pengambilan = 'sudah_diambil'
     and (old.status_pengambilan is distinct from 'sudah_diambil') then
    update public.kebutuhan
      set status = 'sudah_dipenuhi'
    where id = new.kebutuhan_id
      and status = 'disetujui';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_pengajuan_dana_sync_kebutuhan on public.pengajuan_dana;
create trigger trg_pengajuan_dana_sync_kebutuhan
  after update on public.pengajuan_dana
  for each row execute function public.sync_kebutuhan_sudah_dipenuhi();

-- =====================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================
alter table public.pengajuan_dana enable row level security;

-- DIVISI / ADMIN DIVISI: hanya baca pengajuan divisinya sendiri.
-- Staff (monitoring/sekretaris): baca semua.
-- Bendahara: baca semua.
drop policy if exists "Pengajuan: select" on public.pengajuan_dana;
create policy "Pengajuan: select" on public.pengajuan_dana
  for select using (
    public.is_bendahara()
    or public.is_staff()
    or (public.is_division_admin() and divisi_id = public.current_divisi_id())
  );

-- Admin Divisi membuat pengajuan untuk divisinya sendiri.
-- Bendahara juga boleh membuat (aksi "Ajukan Dana" dari halaman
-- Kebutuhan Divisi).
drop policy if exists "Pengajuan: insert" on public.pengajuan_dana;
create policy "Pengajuan: insert" on public.pengajuan_dana
  for insert with check (
    (public.is_division_admin() and divisi_id = public.current_divisi_id())
    or public.is_bendahara()
  );

-- HANYA Bendahara yang boleh update (menyetujui / menandai sudah diambil).
drop policy if exists "Pengajuan: update bendahara" on public.pengajuan_dana;
create policy "Pengajuan: update bendahara" on public.pengajuan_dana
  for update using (public.is_bendahara()) with check (public.is_bendahara());

-- Hapus hanya oleh Bendahara dan hanya selama belum disetujui,
-- agar riwayat pengajuan yang sudah disetujui tetap auditable.
drop policy if exists "Pengajuan: delete bendahara" on public.pengajuan_dana;
create policy "Pengajuan: delete bendahara" on public.pengajuan_dana
  for delete using (public.is_bendahara() and status_persetujuan = 'belum');
