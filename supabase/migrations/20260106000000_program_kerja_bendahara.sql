-- =====================================================
-- APKOSIS - Bendahara Kelola Program Kerja Semua Divisi
-- Jalankan file ini di Supabase SQL Editor
--
-- Tujuan:
-- 1. Memberi izin bendahara insert/update/delete tabel
--    program_kerja untuk SEMUA divisi (full manajemen).
-- 2. Memberi izin bendahara memperbarui catatan program
--    belum terlaksana pada tabel divisi.
-- 3. Memberi izin bendahara upload/update/delete file pada
--    bucket storage 'program-kerja'.
-- =====================================================

-- 1. program_kerja: izin tulis bendahara (semua divisi)
drop policy if exists "Program: bendahara insert" on public.program_kerja;
create policy "Program: bendahara insert" on public.program_kerja
  for insert with check (public.is_bendahara());

drop policy if exists "Program: bendahara update" on public.program_kerja;
create policy "Program: bendahara update" on public.program_kerja
  for update using (public.is_bendahara())
               with check (public.is_bendahara());

drop policy if exists "Program: bendahara delete" on public.program_kerja;
create policy "Program: bendahara delete" on public.program_kerja
  for delete using (public.is_bendahara());

-- 2. divisi: bendahara boleh memperbarui catatan belum terlaksana (semua divisi)
drop policy if exists "Divisi: bendahara update catatan" on public.divisi;
create policy "Divisi: bendahara update catatan" on public.divisi
  for update using (public.is_bendahara())
               with check (public.is_bendahara());

-- 3. storage bucket 'program-kerja': izin tulis bendahara
drop policy if exists "Program kerja: upload own" on storage.objects;
create policy "Program kerja: upload own" on storage.objects
  for insert with check (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') in ('division_admin', 'bendahara')
  );

drop policy if exists "Program kerja: update own" on storage.objects;
create policy "Program kerja: update own" on storage.objects
  for update using (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') in ('division_admin', 'bendahara')
  );

drop policy if exists "Program kerja: delete own" on storage.objects;
create policy "Program kerja: delete own" on storage.objects
  for delete using (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') in ('division_admin', 'bendahara')
  );