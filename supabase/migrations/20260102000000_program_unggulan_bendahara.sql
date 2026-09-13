-- =====================================================
-- APKOSIS - Izin bendahara & akses Program Unggulan
-- Jalankan file ini di Supabase SQL Editor
--
-- Tujuan:
-- 1. Role bendahara boleh membaca tabel program_kerja
--    (dipakai untuk melihat & mengunduh Program Unggulan).
-- 2. Role bendahara boleh membaca file di storage bucket
--    'program-kerja' (untuk mengunduh lampiran unggulan).
-- =====================================================

-- 1. Izinkan bendahara membaca program_kerja
drop policy if exists "Program: select" on public.program_kerja;
create policy "Program: select" on public.program_kerja
  for select using (
    public.is_staff()
    or public.is_bendahara()
    or public.is_division_admin()
  );

-- 2. Izinkan bendahara membaca file pada bucket program-kerja
drop policy if exists "Program kerja: read authenticated" on storage.objects;
create policy "Program kerja: read authenticated"
  on storage.objects for select
  using (
    bucket_id = 'program-kerja'
    and auth.role() = 'authenticated'
    and (
      coalesce((select public.current_role()), '') in ('monitoring','sekretaris','bendahara')
      or (select public.current_role()) = 'division_admin'
    )
  );