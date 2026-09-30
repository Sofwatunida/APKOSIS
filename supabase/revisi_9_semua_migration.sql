-- =====================================================
-- APKOSIS - SQL SATU PAKET (revisi_9)
-- Generated: 2026-09-30
--
-- Cara pakai:
--   1. Buka Supabase Dashboard > SQL Editor > New query
--   2. Tempel SELURUH isi file ini, lalu klik Run
--   3. File ini aman dijalankan berulang kali (idempotent).
--
-- Isi (sudah termasuk urutan + trigger + RLS):
--   1. 20260107 - Kebutuhan Divisi: status tunggal, tanggal, created_by,
--      cascade ke laporan, RLS, trigger penjaga status.
--   2. 20260108 - Pengajuan Dana: tabel, unique kebutuhan_id, trigger
--      invariant, auto-set kebutuhan jadi 'sudah_dipenuhi' saat diambil.
--   3. 20260109 - Transaksi Keuangan: kolom sumber_pemasukan &
--      digunakan_untuk (nullable, data lama tetap aman).
--
-- CATATAN PENTING:
--   * Dijalankan SETELAH migration 20260101-20260106 sudah terpasang.
--   * Semua aturan role tetap dijaga di database (RLS + trigger),
--     bukan hanya disembunyikan di UI.
-- =====================================================


-- =====================================================
-- MULAI: 20260107000000_kebutuhan_divisi_status.sql
-- =====================================================

-- =====================================================
-- APKOSIS - Migration: Kebutuhan Divisi
-- Tujuan:
--   1. Menambah relasi data yang dibutuhkan (tanggal + user pelapor).
--   2. Mengganti status_pembelian lama dengan satu status tunggal
--      (belum / disetujui / ditolak / sudah_dipenuhi) yang ditentukan Bendahara.
--   3. Membuka akses baca untuk Bendahara + menjaga status tetap hanya
--      bisa diubah oleh Bendahara (bukan hanya disembunyikan di UI).
-- Jalankan file ini di Supabase SQL Editor (setelah migration sebelumnya).
-- =====================================================

-- =====================================================
-- 1. KOLOM BARU
-- =====================================================
alter table public.kebutuhan add column if not exists tanggal date;
alter table public.kebutuhan add column if not exists created_by uuid references auth.users(id);
alter table public.kebutuhan add column if not exists status text;

-- Backfill: kebutuhan yang sudah terhubung ke laporan harian
-- mengambil tanggal & akun pembuat dari laporan tersebut.
update public.kebutuhan k
set tanggal = l.tanggal
from public.laporan_harian l
where l.id = k.laporan_id and k.tanggal is null;

update public.kebutuhan k
set created_by = l.created_by
from public.laporan_harian l
where l.id = k.laporan_id and k.created_by is null;

-- Kebutuhan yang tidak punya laporan memakai tanggal dibuatnya.
update public.kebutuhan set tanggal = created_at::date where tanggal is null;

-- Backfill status lama -> status baru (satu sumber kebenaran).
update public.kebutuhan
set status = case status_pembelian
  when 'sudah_dibeli' then 'sudah_dipenuhi'
  when 'tidak_dibeli' then 'ditolak'
  else 'belum'
end
where status is null;

alter table public.kebutuhan alter column status set default 'belum';
alter table public.kebutuhan alter column status set not null;

-- `tanggal` selalu terisi: default hari ini untuk kebutuhan baru
-- (mis. Pengajuan Dana / input manual tanpa laporan harian).
alter table public.kebutuhan alter column tanggal set default current_date;
alter table public.kebutuhan alter column tanggal set not null;

do $$
begin
  alter table public.kebutuhan
    add constraint kebutuhan_status_check
    check (status in ('belum','disetujui','ditolak','sudah_dipenuhi'));
exception when duplicate_object then null;
end $$;

-- Hapus status lama supaya tidak ada dua sumber status.
drop index if exists public.idx_kebutuhan_status;
alter table public.kebutuhan drop column if exists status_pembelian;

-- Kebutuhan dibuat dari Laporan Harian, jadi harus ikut terhapus bersama
-- laporannya. Sebelumnya `on delete set null` sehingga kebutuhan menjadi
-- yatim (tanpa laporan) ketika laporan dihapus.
do $$
declare
  fk record;
begin
  for fk in
    select conname
    from pg_constraint
    where conrelid = 'public.kebutuhan'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%laporan_harian%'
  loop
    execute format(
      'alter table public.kebutuhan drop constraint %I', fk.conname
    );
  end loop;
end $$;

alter table public.kebutuhan
  add constraint kebutuhan_laporan_id_fkey
  foreign key (laporan_id) references public.laporan_harian(id) on delete cascade;

-- =====================================================
-- 2. INDEX
-- =====================================================
create index if not exists idx_kebutuhan_tanggal on public.kebutuhan(tanggal desc);
create index if not exists idx_kebutuhan_status on public.kebutuhan(status);
create index if not exists idx_kebutuhan_laporan_id on public.kebutuhan(laporan_id);

-- =====================================================
-- 3. RLS - kebutuhan
-- =====================================================
-- Divisi: buat + baca kebutuhan divisinya sendiri (TIDAK boleh ubah status).
-- Staff  : baca semua kebutuhan.
-- Bendahara: baca semua kebutuhan + boleh mengubah status.
drop policy if exists "Kebutuhan: select" on public.kebutuhan;
create policy "Kebutuhan: select" on public.kebutuhan
  for select using (
    public.is_staff()
    or public.is_bendahara()
    or (public.is_division_admin() and divisi_id = public.current_divisi_id())
  );

drop policy if exists "Kebutuhan: insert own divisi" on public.kebutuhan;
create policy "Kebutuhan: insert own divisi" on public.kebutuhan
  for insert with check (public.is_division_admin() and divisi_id = public.current_divisi_id());

drop policy if exists "Kebutuhan: update own divisi" on public.kebutuhan;
create policy "Kebutuhan: update own divisi" on public.kebutuhan
  for update using (public.is_division_admin() and divisi_id = public.current_divisi_id())
               with check (public.is_division_admin() and divisi_id = public.current_divisi_id());

drop policy if exists "Kebutuhan: update bendahara" on public.kebutuhan;
create policy "Kebutuhan: update bendahara" on public.kebutuhan
  for update using (public.is_bendahara()) with check (public.is_bendahara());

drop policy if exists "Kebutuhan: delete own divisi" on public.kebutuhan;
create policy "Kebutuhan: delete own divisi" on public.kebutuhan
  for delete using (public.is_division_admin() and divisi_id = public.current_divisi_id());

-- =====================================================
-- 4. TRIGGER PEMBATAS STATUS (lapisan kedua setelah RLS)
-- =====================================================
-- Divisi tetap bisa update isi kebutuhan (nama/jumlah/keterangan),
-- tetapi database akan menolak bila status ikut berubah.
-- auth.uid() is null = dijalankan lewat SQL Editor / service role (admin DB).
create or replace function public.guard_kebutuhan_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and not public.is_bendahara() then
    raise exception 'Status kebutuhan hanya dapat diubah oleh Bendahara.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kebutuhan_status_guard on public.kebutuhan;
create trigger trg_kebutuhan_status_guard
  before update on public.kebutuhan
  for each row execute function public.guard_kebutuhan_status();

-- =====================================================
-- 5. RLS - anggota_divisi
-- =====================================================
-- Bendahara perlu melihat nama pelapor (ketua/wakil divisi) pada halaman
-- "Kebutuhan Divisi". Sebelumnya policy ini hanya membuka akses untuk
-- staff dan admin divisi sehingga nama pelapor tidak bisa ditampilkan.
drop policy if exists "Anggota: select own divisi" on public.anggota_divisi;
create policy "Anggota: select own divisi" on public.anggota_divisi
  for select using (
    public.is_staff()
    or public.is_bendahara()
    or (public.is_division_admin() and divisi_id = public.current_divisi_id())
  );



-- =====================================================
-- MULAI: 20260108000000_pengajuan_dana.sql
-- =====================================================

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



-- =====================================================
-- MULAI: 20260109000000_transaksi_keuangan_rincian.sql
-- =====================================================

-- =====================================================
-- APKOSIS - Migration: Rincian Transaksi Keuangan
-- Tujuan:
--   transaksi_keuangan lama hanya menyimpan jenis + keterangan + nominal.
--   Agar "Detail Keuangan" di Rekap Keuangan bisa menampilkan rincian
--   (sumber pemasukan / digunakan untuk), ditambahkan dua kolom nullable.
--   Data lama tidak dirusak: kolom kosong ditampilkan sebagai "-" di UI.
-- Jalankan file ini di Supabase SQL Editor (setelah migration sebelumnya).
-- =====================================================

alter table public.transaksi_keuangan
  add column if not exists sumber_pemasukan text;

alter table public.transaksi_keuangan
  add column if not exists digunakan_untuk text;

create index if not exists idx_transaksi_sumber on public.transaksi_keuangan(sumber_pemasukan);
create index if not exists idx_transaksi_digunakan on public.transaksi_keuangan(digunakan_untuk);



-- =====================================================
-- SELESAI. Jika tidak ada error, semua perubahan sudah aktif.
-- =====================================================
