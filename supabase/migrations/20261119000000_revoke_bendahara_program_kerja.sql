-- =====================================================
-- APKOSIS - Cabut akses Program Kerja dari role bendahara
-- =====================================================
-- Migrasi lama memberi bendahara izin baca/tulis program_kerja,
-- mengubah catatan divisi, dan mengelola file bucket
-- 'program-kerja'. Fitur tersebut sudah dihapus dari menu dan
-- guard halaman bendahara, sehingga kebijakan database ini
-- diselaraskan tanpa mengubah file migrasi lama.
--
-- Role yang tetap memiliki akses:
-- - division_admin, monitoring, sekretaris (policy bawaan)
-- - admin, super_admin (policy terpisah dari migrasi 20261007)
-- =====================================================

-- 1. program_kerja: baca hanya untuk staff & admin divisi.
drop policy if exists "Program: select" on public.program_kerja;
create policy "Program: select" on public.program_kerja
  for select using (
    public.is_staff()
    or public.is_division_admin()
  );

-- 1b. Hapus policy tulis khusus bendahara.
drop policy if exists "Program: bendahara insert" on public.program_kerja;
drop policy if exists "Program: bendahara update" on public.program_kerja;
drop policy if exists "Program: bendahara delete" on public.program_kerja;

-- 2. divisi: bendahara tidak lagi mengubah catatan program belum terlaksana.
drop policy if exists "Divisi: bendahara update catatan" on public.divisi;

-- 3. Storage bucket 'program-kerja': baca tanpa bendahara.
drop policy if exists "Program kerja: read authenticated" on storage.objects;
create policy "Program kerja: read authenticated"
  on storage.objects for select
  using (
    bucket_id = 'program-kerja'
    and auth.role() = 'authenticated'
    and (
      coalesce((select public.current_role()), '') in ('monitoring', 'sekretaris')
      or (select public.current_role()) = 'division_admin'
    )
  );

-- 3b. Tulis file hanya untuk admin divisi (admin/super_admin punya policy sendiri).
drop policy if exists "Program kerja: upload own" on storage.objects;
create policy "Program kerja: upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );

drop policy if exists "Program kerja: update own" on storage.objects;
create policy "Program kerja: update own"
  on storage.objects for update
  using (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );

drop policy if exists "Program kerja: delete own" on storage.objects;
create policy "Program kerja: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );
