-- =====================================================
-- APKOSIS - Perbaikan: "infinite recursion detected in policy"
--
-- Gejala:
--   Setiap halaman yang butuh `profiles` gagal, termasuk login.
--   Aplikasi selalu menampilkan kartu "Akun belum dikonfigurasi"
--   karena `getProfile()` selalu `null`, berapa pun role yang
--   sudah diisi di tabel `profiles`.
--
--   postgres error: 42P17
--   infinite recursion detected in policy for relation "profiles"
--
-- Penyebab:
--   Beberapa policy menulis query ke `profiles` SECARA LANGSUNG
--   di dalam ekspresinya, misalnya:
--
--     create policy ... on public.periods
--       for select using ((select role from public.profiles where id = auth.uid()) = 'admin');
--
--   Policy `profiles` sendiri ikut membaca `admin_periods`
--   ("Profiles: admin read assigned"), sementara policy
--   `admin_periods` ("AdminPeriods: admin read own") membaca
--   `profiles` secara langsung. PostgreSQL mendeteksi siklus
--   policy secara statis dan menolak SELURUH query yang menyentuh
--   tabel mana pun di dalam siklus itu: profiles, admin_periods,
--   periods, dan divisi.
--
--   Ditambah policy UPDATE `profiles` yang membaca barisnya
--   sendiri di WITH CHECK.
--
-- Perbaikan:
--   1. Semua pembacaan role/periode dari dalam policy dipindah ke
--      fungsi SECURITY DEFINER (dijalankan sebagai pemilik tabel
--      `profiles`, jadi policy `profiles` tidak dievaluasi lagi
--      di dalamnya -> tidak ada siklus).
--   2. Semua policy yang query langsung ke `profiles` /
--      `admin_periods` ditulis ulang memakai fungsi tersebut.
--   3. Policy UPDATE `profiles` tidak lagi membaca baris
--      `profiles` sendiri; hak ubah `role` / `periode_id` dikunci
--      lewat GRANT per kolom sehingga hanya bisa lewat RPC admin.
--
-- Aman dijalankan berulang kali (idempotent).
-- Jalankan di Supabase Dashboard -> SQL Editor.
-- =====================================================


-- =====================================================
-- 1. DIAGNOSA (hasil muncul di Output / Notices SQL Editor)
-- =====================================================
do $$
declare
  r record;
  v_owner text;
  v_forced text;
begin
  select pg_get_userbyid(relowner), relforcerowsecurity
    into v_owner, v_forced
    from pg_class
   where oid = 'public.profiles'::regclass;

  raise notice 'profiles  -> owner=%  force_rls=%', v_owner, v_forced;

  for r in
    select p.proname,
           p.prosecdef as security_definer,
           pg_get_userbyid(p.proowner) as owner
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('current_role','is_super_admin','profile_period_id','current_divisi_id')
  loop
    raise notice 'fungsi % -> security_definer=% owner=%',
      r.proname, r.security_definer, r.owner;
  end loop;
end $$;


-- =====================================================
-- 2. FUNGSI PEMBANTU (SECURITY DEFINER)
--    Semua dijalankan sebagai pemilik tabel `profiles`, sehingga
--    policy `profiles` tidak dievaluasi di dalamnya. Inilah yang
--    memutus siklus rekursi.
-- =====================================================
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'super_admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.profile_period_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.periode_id from public.profiles p where p.id = auth.uid();
$$;

-- "Apakah akun ini Admin periode yang ditugaskan pada periode ini?"
-- Dipakai menggantikan subquery ke `admin_periods` di dalam policy.
create or replace function public.admin_has_period_assignment(p_periode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.admin_periods ap
      join public.profiles p on p.id = ap.admin_id
     where ap.admin_id = auth.uid()
       and ap.periode_id = p_periode_id
       and p.role = 'admin'
  );
$$;

-- "Apakah akun ini punya penugasan periode Admin sama sekali?"
create or replace function public.admin_has_any_assignment()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.admin_periods ap
      join public.profiles p on p.id = ap.admin_id
     where ap.admin_id = auth.uid()
       and p.role = 'admin'
  );
$$;

-- Id divisi milik akun ini (dibaca lewat policy `current_divisi_id`).
create or replace function public.profile_divisi_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.divisi_id from public.profiles p where p.id = auth.uid();
$$;


-- =====================================================
-- 3. PASTIKAN RLS TIDAK DIPAKSA & FUNGSI DIMILIKI PEMILIK TABEL
--    `profiles` tidak boleh memakai FORCE ROW LEVEL SECURITY,
--    karena itu membuat RLS ikut berlaku untuk pemilik tabel
--    dan siklus policy muncul lagi.
-- =====================================================
do $$
declare
  v_owner regrole;
  r record;
begin
  select pg_get_userbyid(relowner)::regrole into v_owner
    from pg_class where oid = 'public.profiles'::regclass;

  begin
    execute 'alter table public.profiles no force row level security';
    execute 'alter table public.admin_periods no force row level security';
  exception when others then
    raise notice 'LEWATI: tidak bisa mengubah FORCE RLS (%)', sqlerrm;
  end;

  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'current_role','is_super_admin','profile_period_id','profile_divisi_id',
         'admin_has_period_assignment','admin_has_any_assignment',
         'can_access_period','is_period_writable'
       )
  loop
    begin
      execute format('alter function %s owner to %s', r.sig, v_owner);
    exception when others then
      raise notice 'LEWATI: ganti owner % (%)', r.sig, sqlerrm;
    end;
  end loop;
end $$;


-- =====================================================
-- 4. HAK AKSES FUNGSI PEMBANTU
--    Fungsi ini dipanggil dari dalam policy, jadi harus boleh
--    dijalankan oleh `authenticated` (bukan oleh anon).
-- =====================================================
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'admin_has_period_assignment') then
    execute 'revoke all on function public.admin_has_period_assignment(uuid) from public';
    execute 'revoke all on function public.admin_has_period_assignment(uuid) from anon';
    execute 'grant execute on function public.admin_has_period_assignment(uuid) to authenticated';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'admin_has_any_assignment') then
    execute 'revoke all on function public.admin_has_any_assignment() from public';
    execute 'revoke all on function public.admin_has_any_assignment() from anon';
    execute 'grant execute on function public.admin_has_any_assignment() to authenticated';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'profile_divisi_id') then
    execute 'revoke all on function public.profile_divisi_id() from public';
    execute 'revoke all on function public.profile_divisi_id() from anon';
    execute 'grant execute on function public.profile_divisi_id() to authenticated';
  end if;
end $$;


-- =====================================================
-- 5. POLICY PROFILES
-- =====================================================
alter table public.profiles enable row level security;

-- Hapus policy lama yang membaca `admin_periods` (sumber siklus).
drop policy if exists "Profiles: admin read assigned" on public.profiles;

-- Policy UPDATE lama membaca baris `profiles` sendiri di WITH CHECK.
drop policy if exists "Profiles: user update own non-privileged" on public.profiles;
drop policy if exists "Profiles: update own" on public.profiles;

-- Baca profil sendiri: tanpa subquery ke `profiles`.
drop policy if exists "Profiles: read own" on public.profiles;
create policy "Profiles: read own" on public.profiles
  for select using (id = auth.uid());

-- Admin periode boleh melihat akun yang ditugaskan ke periodenya.
-- Pemeriksaan "didiugaskan" lewat fungsi SECURITY DEFINER.
create policy "Profiles: admin read assigned" on public.profiles
  for select using (
    public.current_role() = 'admin'
    and (
      public.admin_has_period_assignment(periode_id)
      or (periode_id is null and public.admin_has_any_assignment())
    )
  );

-- Menulis profil sendiri hanya boleh untuk kolom nama & email.
-- `role`, `periode_id`, dan `divisi_id` dikunci lewat GRANT di bawah.
create policy "Profiles: update own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (nama, email) on public.profiles to authenticated;


-- =====================================================
-- 6. POLICY ADMIN_PERIODS
--    Policy lama membaca `profiles` secara langsung -> ikut memicu
--    siklus bersama "Profiles: admin read assigned".
-- =====================================================
alter table public.admin_periods enable row level security;

drop policy if exists "AdminPeriods: admin read own" on public.admin_periods;

drop policy if exists "AdminPeriods: read own" on public.admin_periods;
create policy "AdminPeriods: read own" on public.admin_periods
  for select using (admin_id = auth.uid());


-- =====================================================
-- 7. POLICY PERIODS
--    Ganti subquery langsung ke `profiles` dengan current_role().
-- =====================================================
alter table public.periods enable row level security;

drop policy if exists "Periods: admin read" on public.periods;
create policy "Periods: admin read" on public.periods
  for select using (
    public.current_role() = 'admin'
    and status in ('active', 'archived')
  );

drop policy if exists "Periods: admin insert" on public.periods;
create policy "Periods: admin insert" on public.periods
  for insert with check (public.current_role() = 'admin');

drop policy if exists "Periods: staff read" on public.periods;
create policy "Periods: staff read" on public.periods
  for select using (
    public.current_role() in ('monitoring', 'sekretaris', 'bendahara')
    and status in ('active', 'archived')
  );

drop policy if exists "Periods: division_admin read" on public.periods;
create policy "Periods: division_admin read" on public.periods
  for select using (
    public.current_role() = 'division_admin'
    and status in ('active', 'archived')
  );


-- =====================================================
-- 8. POLICY DIVISI
-- =====================================================
alter table public.divisi enable row level security;

drop policy if exists "Divisi: admin sendiri update" on public.divisi;
create policy "Divisi: admin sendiri update" on public.divisi
  for update using (
    id = public.current_divisi_id()
    and periode_id = public.profile_period_id()
  )
  with check (
    id = public.current_divisi_id()
    and periode_id = public.profile_period_id()
  );

drop policy if exists "Divisi: admin period" on public.divisi;
create policy "Divisi: admin period" on public.divisi
  for all using (
    public.current_role() = 'admin'
    and public.admin_has_period_assignment(periode_id)
  )
  with check (
    public.current_role() = 'admin'
    and public.admin_has_period_assignment(periode_id)
  );


-- =====================================================
-- 9. VERIFIKASI
--    Kalau masih ada policy yang menutupi, blok di bawah
--    akan menampilkan policy yang masih menunjuk ke profiles
--    atau admin_periods secara langsung.
-- =====================================================
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and (
         coalesce(qual, '') ~* 'from\s+public\.profiles'
         or coalesce(with_check, '') ~* 'from\s+public\.profiles'
         or coalesce(qual, '') ~* 'from\s+public\.admin_periods'
         or coalesce(with_check, '') ~* 'from\s+public\.admin_periods'
       )
  loop
    raise notice 'PERIKSA: policy "%" pada tabel % masih menunjuk tabel lain',
      r.policyname, r.tablename;
  end loop;

  raise notice 'Selesai. Login ulang untuk memverifikasi.';
end $$;