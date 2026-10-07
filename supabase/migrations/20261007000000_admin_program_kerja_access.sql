-- =====================================================
-- APKOSIS - Admin & Super Admin akses Program Kerja
-- Jalankan file ini di Supabase SQL Editor
--
-- Tujuan:
-- Fitur "Kontrol Semua Program Kerja" (menu Admin Periode)
-- memakai client program kerja yang sama dengan bendahara,
-- sehingga Admin & Super Admin butuh izin pada:
--   1. tabel program_kerja (baca/tulis) — sebenarnya sudah
--      tercakup policy seragam "read/insert/update/delete
--      accessible/writable period" dari migration
--      20261001000002 (super_admin selalu lolos; admin lolos
--      bila ditugaskan pada periode tsb). Policy eksplisit
--      ditambahkan di bawah agar niatnya jelas dan tidak
--      bergantung pada urutan policy lama.
--   2. storage bucket 'program-kerja' (baca + tulis) —
--      SEBELUMNYA admin/super_admin TIDAK punya izin sama
--      sekali (policy lama hanya division_admin/bendahara/
--      monitoring/sekretaris), sehingga upload/download
--      file program kerja gagal.
--
-- Catatan keamanan:
-- - Policy tulis tabel tetap memakai is_period_writable()
--   sehingga admin hanya bisa menulis periode yang ditugaskan
--   dan masih aktif; super_admin tetap bisa koreksi arsip.
-- - Policy storage dibatasi hanya bucket 'program-kerja'.
-- =====================================================

-- =====================================================
-- 1. TABEL program_kerja: izin eksplisit Admin & Super Admin
-- =====================================================
drop policy if exists "Program: super_admin all" on public.program_kerja;
create policy "Program: super_admin all" on public.program_kerja
  for all using (public.is_super_admin())
       with check (public.is_super_admin());

drop policy if exists "Program: admin accessible period" on public.program_kerja;
create policy "Program: admin accessible period" on public.program_kerja
  for select using (
    public.current_role() = 'admin'
    and public.can_access_period(periode_id)
  );

drop policy if exists "Program: admin writable period" on public.program_kerja;
create policy "Program: admin writable period" on public.program_kerja
  for insert with check (
    public.current_role() = 'admin'
    and public.is_period_writable(periode_id)
  );

drop policy if exists "Program: admin update writable period" on public.program_kerja;
create policy "Program: admin update writable period" on public.program_kerja
  for update using (
    public.current_role() = 'admin'
    and public.is_period_writable(periode_id)
  )
  with check (
    public.current_role() = 'admin'
    and public.is_period_writable(periode_id)
  );

drop policy if exists "Program: admin delete writable period" on public.program_kerja;
create policy "Program: admin delete writable period" on public.program_kerja
  for delete using (
    public.current_role() = 'admin'
    and public.is_period_writable(periode_id)
  );

-- =====================================================
-- 2. STORAGE bucket 'program-kerja': Admin & Super Admin
--    (baca file untuk unduh, tulis untuk upload/hapus)
-- =====================================================
drop policy if exists "Program kerja: read admin" on storage.objects;
create policy "Program kerja: read admin"
  on storage.objects for select
  using (
    bucket_id = 'program-kerja'
    and auth.role() = 'authenticated'
    and (
      public.is_super_admin()
      or coalesce((select public.current_role()), '') = 'admin'
    )
  );

drop policy if exists "Program kerja: upload admin" on storage.objects;
create policy "Program kerja: upload admin"
  on storage.objects for insert
  with check (
    bucket_id = 'program-kerja'
    and (
      public.is_super_admin()
      or coalesce((select public.current_role()), '') = 'admin'
    )
  );

drop policy if exists "Program kerja: update admin" on storage.objects;
create policy "Program kerja: update admin"
  on storage.objects for update
  using (
    bucket_id = 'program-kerja'
    and (
      public.is_super_admin()
      or coalesce((select public.current_role()), '') = 'admin'
    )
  );

drop policy if exists "Program kerja: delete admin" on storage.objects;
create policy "Program kerja: delete admin"
  on storage.objects for delete
  using (
    bucket_id = 'program-kerja'
    and (
      public.is_super_admin()
      or coalesce((select public.current_role()), '') = 'admin'
    )
  );
