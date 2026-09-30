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
