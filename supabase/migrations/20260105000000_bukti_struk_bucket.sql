-- =====================================================
-- APKOSIS - Bucket Bukti Struk
-- Jalankan file ini di Supabase SQL Editor
--
-- Tujuan:
-- Memperbaiki upload / tampil / unduh bukti struk.
-- Sebelumnya bukti di-upload ke bucket 'program-kerja' yang PRIVATE
-- lalu dipakai getPublicUrl() --> gambar tidak muncul & muncul
-- error 'Bucket not found'. Solusi: bucket 'bukti-struk' yang PUBLIC.
-- =====================================================

-- -----------------------------------------------------
-- 1. BUCKET bukti-struk (public)
-- -----------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bukti-struk', 'bukti-struk', true)
on conflict (id) do update set public = true;

-- -----------------------------------------------------
-- 2. POLICIES STORAGE
-- -----------------------------------------------------
-- Siapa saja boleh melihat (tanpa login) karena bucket public,
-- supaya gambar tampil langsung di <img>
drop policy if exists "Bukti struk: public read" on storage.objects;
create policy "Bukti struk: public read"
  on storage.objects for select
  using (bucket_id = 'bukti-struk');

-- Hanya ketua/wakil (division_admin) yang boleh mengunggah
drop policy if exists "Bukti struk: upload own" on storage.objects;
create policy "Bukti struk: upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'bukti-struk'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );

drop policy if exists "Bukti struk: update own" on storage.objects;
create policy "Bukti struk: update own"
  on storage.objects for update
  using (
    bucket_id = 'bukti-struk'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );

drop policy if exists "Bukti struk: delete own" on storage.objects;
create policy "Bukti struk: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'bukti-struk'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );