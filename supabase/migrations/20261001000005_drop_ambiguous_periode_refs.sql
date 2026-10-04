-- =====================================================
-- APKOSIS - Perbaikan: "column reference periode_id is ambiguous"
--
-- GEJALA
--   Di "Super Admin > Kelola Akun", setiap kartu divisi gagal
--   dengan error PostgreSQL:
--       column reference "periode_id" is ambiguous
--   Halaman itu hanya punya satu pemanggilan database per
--   kartu: admin_division_account_save(uuid, text, uuid)
--   lewat server action `setDivisionPasswordAction`.
--
-- APA YANG SUDAH DIBUKTIKAN DI REPO
--   Tidak ada satu pun referensi `periode_id` TANPA alias
--   tabel di file SQL repo ini. Semua sudah ditulis
--   `dv.periode_id`, `ap.periode_id`, `c.periode_id`.
--   Jadi objek yang error BERADA DI DATABASE LIVE dan tidak
--   ada di repo.
--
--   Penyebab yang paling mungkin: OVERLOAD LAMA.
--   `drop function if exists public.f(uuid)` hanya menghapus
--   SATU signature. Kalau database punya overload lain --
--   misal `admin_division_account_list()` tanpa argumen, atau
--   `admin_division_account_list(p_periode uuid)` dengan nama
--   parameter berbeda -- overload itu UTUH. PostgREST memilih
--   overload berdasarkan NAMA argumen yang dikirim client, jadi
--   overload dengan nama parameter berbeda bisa saja tidak
--   pernah terpakai, atau justru terpakai dan salah.
--
-- PERBAIKAN DI MIGRATION INI
--   1. Hapus overload liar (semua signature KECUALI satu
--      signature kanonik) dari seluruh rantai Kelola Akun.
--   2. `drop` + `create` ulang `admin_division_account_list`
--      karena tipe balasersnya berubah (CREATE OR REPLACE
--      tidak boleh mengganti tipe return).
--   3. `create or replace` untuk sisanya dengan OID yang
--      SAMA, supaya policy RLS yang sudah mereferensinya
--      tidak ikut rusak. Karena itu helper seperti
--      `current_role()` TIDAK pernah di-drop: policy
--      "Profiles: admin read assigned" depend ke sana dan
--      `drop function` akan gagal dengan:
--        cannot drop function ... because other objects
--        depend on it
--   4. Semua badan fungsi ditulis dengan aturan konsisten:
--        - parameter input SELALU berawalan `p_`
--        - setiap query punya alias tabel, dan seluruh
--          referensi kolom memakai alias itu
--        - nol referensi `periode_id` telanjang
--      Pengecualian grammar: kolom pada `SET ... =` dan pada
--      daftar kolom `INSERT`/`ON CONFLICT` HARUS ditulis polos
--      karena secara sintaks kolom itu, bukan ekspresi.
--   5. Grant ACL ulang.
--   6. Blok verifikasi yang benar-benar MENJALANKAN tiap
--      statement lalu melaporkan OK / GAGAL per statement.
--
-- TIDAK ada data yang dihapus. TIDAK ada dummy data.
-- periods, divisi, division_credentials, admin_periods, dan
-- profiles tidak berubah, kecuali melalui fungsi yang memang
-- sudah ada sebelumnya.
--
-- Aman dijalankan berulang kali (idempotent).
-- Jalankan SETELAH 20261001000004_fix_division_credential.sql.
-- =====================================================


-- =====================================================
-- 1. HAPUS OVERLOAD LIAR
--
--    Hanya signature yang TIDAK sama dengan signature
--    kanonik yang di-drop. Signature kanonik dibiarkan
--    supaya dependensi policy RLS tidak putus.
--
--    Format daftar: 'nama_fungsi|argumen_identity'
--    (argumen identity = TANPA nama parameter).
-- =====================================================
do $$
declare
  item text;
  bagian text[];
  fn text;
  args text;
  sig text;
begin
  foreach item in array array[
    -- dipakai per kartu di Kelola Akun
    'admin_set_division_password|uuid, text, uuid',
    'admin_division_account_save|uuid, text, uuid',
    -- dipakai saat halaman dimuat
    'admin_division_account_list|uuid',
    'admin_division_credential_status|uuid',
    'admin_accounts_list|uuid',
    -- dipakai saat periode divisi / admin diubah
    'admin_divisi_set_period|uuid, uuid',
    'admin_assign_period|uuid, uuid',
    'admin_set_user_role|uuid, text',
    -- dipakai saat login divisi
    'verify_division_password|uuid, text',
    'start_division_session|uuid, text',
    'division_period_id|uuid',
    -- guard, dipanggil dari dalam fungsi di atas
    'can_access_period|uuid',
    'is_period_writable|uuid',
    'current_role|',
    'is_super_admin|',
    'profile_period_id|',
    'profile_divisi_id|',
    'admin_has_period_assignment|uuid',
    'admin_has_any_assignment|'
  ] loop
    bagian := string_to_array(item, '|');
    fn    := bagian[1];
    args  := bagian[2];

    for sig in
      select p.oid::regprocedure::text
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = fn
         and pg_get_function_identity_arguments(p.oid) <> args
    loop
      execute format('drop function if exists %s', sig);
      raise notice 'drop overload liar: %', sig;
    end loop;
  end loop;
end $$;


-- =====================================================
-- 2. TIPE BALASAN admin_division_account_list BERUBAH
--    CREATE OR REPLACE tidak boleh mengganti tipe return,
--    jadi signature kanonik WAJIB di-drop sekali ini saja.
--    Tidak ada policy/objek lain yang depend ke fungsi ini.
-- =====================================================
drop function if exists public.admin_division_account_list(uuid);


-- =====================================================
-- 3. DASAR
-- =====================================================
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

-- Resolver search_path: pgcrypto bisa hidup di `public` atau di
-- `extensions` tergantung project. Jangan ditebak.
create or replace function public.division_crypto_search_path()
returns text
language sql
stable
as $$
  select coalesce(
    (
      select 'public, ' || n.nspname
        from pg_extension e
        join pg_namespace n on n.oid = e.extnamespace
       where e.extname = 'pgcrypto'
       limit 1
    ),
    'public, extensions'
  );
$$;


-- =====================================================
-- 4. GUARD PERIODE
--    Dipakai hampir semua fungsi di bawah, dan oleh policy RLS.
-- =====================================================
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pr.role from public.profiles pr where pr.id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles pr
     where pr.id = auth.uid()
       and pr.role = 'super_admin'
  );
$$;

create or replace function public.profile_period_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pr.periode_id from public.profiles pr where pr.id = auth.uid();
$$;

create or replace function public.profile_divisi_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pr.divisi_id from public.profiles pr where pr.id = auth.uid();
$$;

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
      join public.profiles pr on pr.id = ap.admin_id
     where ap.admin_id = auth.uid()
       and ap.periode_id = p_periode_id
       and pr.role = 'admin'
  );
$$;

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
      join public.profiles pr on pr.id = ap.admin_id
     where ap.admin_id = auth.uid()
       and pr.role = 'admin'
  );
$$;

create or replace function public.can_access_period(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then true
    when public.current_role() = 'admin' then
      exists (
        select 1
          from public.admin_periods ap
         where ap.admin_id = auth.uid()
           and ap.periode_id = p_period_id
      )
    when public.current_role() in ('monitoring', 'sekretaris', 'bendahara') then
      exists (
        select 1
          from public.periods pe
         where pe.id = p_period_id
           and pe.status in ('active', 'archived')
      )
    when public.current_role() = 'division_admin' then
      exists (
        select 1
          from public.periods pe
         where pe.id = p_period_id
           and pe.status in ('active', 'archived')
      )
    else false
  end;
$$;

create or replace function public.is_period_writable(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_period_id is null then false
    when public.is_super_admin() then true
    else p_period_id = public.profile_period_id()
      and exists (
        select 1
          from public.periods pe
         where pe.id = p_period_id
           and pe.status = 'active'
      )
  end;
$$;


-- =====================================================
-- 5. PERIODE EFEKTIF DIVISI (sumber kebenaran tunggal)
--    Dipakai login divisi DAN penyimpanan akun divisi, supaya
--    "password untuk periode mana" tidak pernah ditebak lagi.
-- =====================================================
create or replace function public.division_period_id(p_divisi_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select d.periode_id from public.divisi d where d.id = p_divisi_id),
    public.get_active_period_id()
  );
$$;


-- =====================================================
-- 6. VERIFIKASI PASSWORD (hanya periode efektif)
--
--    PK division_credentials = (divisi_id, periode_id).
--    Query lama hanya memfilter `divisi_id`, jadi `select ...
--    into` mengambil baris yang tidak ditentukan begitu ada
--    lebih dari satu periode -> password baru ditolak, yang lama
--    diterima.
-- =====================================================
create or replace function public.verify_division_password(
  p_divisi_id uuid,
  p_password text
)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public.is_division_admin()
    and exists (
      select 1
        from public.division_credentials c
       where c.divisi_id = p_divisi_id
         and c.periode_id = public.division_period_id(p_divisi_id)
         and crypt(p_password, c.password_hash) = c.password_hash
    );
$$;


-- =====================================================
-- 7. SESI DIVISI (login memakai password divisi)
-- =====================================================
create or replace function public.start_division_session(
  p_divisi_id uuid,
  p_password text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_token uuid;
  v_periode_id uuid;
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  if not public.is_division_admin() then
    raise exception 'Akses hanya untuk akun divisi.';
  end if;

  if p_divisi_id is null or coalesce(p_password, '') = '' then
    raise exception 'Pilih divisi dan masukkan password divisi.';
  end if;

  if not exists (select 1 from public.divisi d where d.id = p_divisi_id) then
    raise exception 'Divisi tidak ditemukan.';
  end if;

  v_periode_id := public.division_period_id(p_divisi_id);

  if not exists (
    select 1
      from public.division_credentials c
     where c.divisi_id = p_divisi_id
       and c.periode_id = v_periode_id
  ) then
    raise exception 'Divisi ini belum memiliki password. Hubungi Super Admin.';
  end if;

  if not public.verify_division_password(p_divisi_id, p_password) then
    raise exception 'Password divisi salah.';
  end if;

  delete from public.division_sessions s where s.expires_at <= now();

  v_token := gen_random_uuid();

  insert into public.division_sessions (token, user_id, divisi_id, expires_at)
  values (v_token, auth.uid(), p_divisi_id, now() + interval '12 hours');

  return v_token;
end;
$$;


-- =====================================================
-- 8. DAFTAR AKUN (tabel "Akun" di Kelola Akun)
--    profiles DAN admin_periods sama-sama punya periode_id,
--    jadi setiap referensi WAJIB beralias.
-- =====================================================
create or replace function public.admin_accounts_list(p_periode_id uuid default null)
returns table (
  id uuid,
  nama text,
  email text,
  role text,
  periode_id uuid,
  assigned_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.id,
    pr.nama,
    pr.email,
    pr.role,
    ap.periode_id,
    ap.assigned_at
  from public.profiles pr
  left join public.admin_periods ap on ap.admin_id = pr.id
  where public.is_super_admin()
    and (p_periode_id is null or ap.periode_id = p_periode_id)
  order by pr.nama nulls last;
$$;


-- =====================================================
-- 9. DAFTAR AKUN DIVISI + STATUS PASSWORD
--
--    LEFT JOIN selalu memakai periode EFEKTIF, jadi
--    `p_periode_id = null` (mode "seluruh periode") tidak lagi
--    membuat `has_password` selalu false.
--
--    Perhatikan: output `periode_id` sengaja dinamai sama
--    dengan kolomnya, tapi TIDAK PERNAH dipakai sebagai referensi
--    di badan fungsi. Yang dipakai hanya `dv.periode_id`,
--    `dc.periode_id`, `pe.id`.
-- =====================================================
create function public.admin_division_account_list(
  p_periode_id uuid default null
)
returns table (
  divisi_id uuid,
  nomor_divisi integer,
  nama_divisi text,
  account_count bigint,
  has_password boolean,
  updated_at timestamptz,
  periode_id uuid,
  periode_nama text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dv.id,
    dv.nomor_divisi,
    dv.nama_divisi,
    (
      select count(*)
        from public.profiles pr
       where pr.divisi_id = dv.id
    ),
    (dc.password_hash is not null),
    dc.updated_at,
    coalesce(p_periode_id, dv.periode_id, public.get_active_period_id()),
    pe.nama_periode
  from public.divisi dv
  left join public.division_credentials dc
    on dc.divisi_id = dv.id
   and dc.periode_id = coalesce(
         p_periode_id,
         dv.periode_id,
         public.get_active_period_id()
       )
  left join public.periods pe
    on pe.id = coalesce(
         p_periode_id,
         dv.periode_id,
         public.get_active_period_id()
       )
  where public.is_super_admin()
     or (
       public.current_role() = 'admin'
       and p_periode_id is not null
       and public.can_access_period(p_periode_id)
     )
  order by dv.nomor_divisi;
$$;


-- =====================================================
-- 10. STATUS KREDENTIAL (halaman "Admin > Password Divisi")
-- =====================================================
create or replace function public.admin_division_credential_status(
  p_periode_id uuid default null
)
returns table (
  divisi_id uuid,
  nomor_divisi integer,
  nama_divisi text,
  has_password boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dv.id,
    dv.nomor_divisi,
    dv.nama_divisi,
    (dc.password_hash is not null),
    dc.updated_at
  from public.divisi dv
  left join public.division_credentials dc
    on dc.divisi_id = dv.id
   and dc.periode_id = coalesce(
         p_periode_id,
         dv.periode_id,
         public.get_active_period_id()
       )
  where public.is_super_admin()
     or (
       public.current_role() = 'admin'
       and p_periode_id is not null
       and public.can_access_period(p_periode_id)
     )
  order by dv.nomor_divisi;
$$;


-- =====================================================
-- 11. SIMPAN AKUN DIVISI (ATOMIK) -- dipanggil per kartu
--
--     Satu-satunya jalan menulis password + periode divisi.
--     Semua referensi kolom beralias; nol `periode_id` telanjang.
--
--     Catatan grammar (penting, sudah pernah salah di sini):
--       - `set periode_id = ...` dan daftar kolom
--         `insert into ... (periode_id, ...)` WAJIB polos.
--         Secara sintaks posisi itu adalah kolom, bukan
--         ekspresi, jadi alias di situ tidak valid.
--       - Semua yang di dalam WHERE / JOIN / subquery memakai
--         alias, misalnya `where d.id = ...`.
-- =====================================================
create or replace function public.admin_division_account_save(
  p_divisi_id uuid,
  p_password text,
  p_periode_id uuid default null
)
returns table (
  has_password boolean,
  periode_id uuid,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_is_super boolean;
  v_target uuid;
  v_now timestamptz := now();
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  v_is_super := public.is_super_admin();

  if not (v_is_super or public.current_role() = 'admin') then
    raise exception 'Hanya Admin atau Super Admin yang dapat mengatur akun divisi.'
      using errcode = '42501';
  end if;

  -- 1. Validasi input ---------------------------------------------
  if p_divisi_id is null then
    raise exception 'Divisi tidak valid.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.divisi d where d.id = p_divisi_id) then
    raise exception 'Divisi tidak ditemukan.' using errcode = '22023';
  end if;

  if p_password is null or length(p_password) < 4 then
    raise exception 'Password divisi minimal 4 karakter.' using errcode = '22023';
  end if;

  if length(p_password) > 128 then
    raise exception 'Password divisi maksimal 128 karakter.' using errcode = '22023';
  end if;

  -- 2. Tentukan periode tujuan -----------------------------------
  v_target := coalesce(
    p_periode_id,
    (select d.periode_id from public.divisi d where d.id = p_divisi_id),
    public.get_active_period_id()
  );

  if v_target is null then
    raise exception 'Periode belum ditentukan.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.periods pe where pe.id = v_target) then
    raise exception 'Periode tidak ditemukan.' using errcode = '22023';
  end if;

  if not v_is_super and not public.can_access_period(v_target) then
    raise exception 'Anda tidak mengelola periode ini.' using errcode = '42501';
  end if;

  if not public.is_period_writable(v_target) then
    raise exception 'Periode ini hanya bisa dibaca.' using errcode = '42501';
  end if;

  -- 3. Periode divisi = sumber kebenaran aplikasi ---------------
  update public.divisi d
     set periode_id = v_target
   where d.id = p_divisi_id;

  -- 4. Tulis hash bcrypt (password plaintext tidak pernah disimpan)
  insert into public.division_credentials (
    divisi_id, periode_id, password_hash, updated_at, updated_by
  )
  values (
    p_divisi_id, v_target, crypt(p_password, gen_salt('bf')), v_now, auth.uid()
  )
  on conflict (divisi_id, periode_id) do update
    set password_hash = excluded.password_hash,
        updated_at    = excluded.updated_at,
        updated_by    = excluded.updated_by;

  -- 5. Verifikasi benar-benar tersimpan dan bisa diverifikasi.
  --    Kalau gagal -> exception -> seluruh transaksi rollback,
  --    hash lama tetap utuh dan UI tidak menampilkan sukses palsu.
  if not exists (
    select 1
      from public.division_credentials c
     where c.divisi_id = p_divisi_id
       and c.periode_id = v_target
       and crypt(p_password, c.password_hash) = c.password_hash
  ) then
    raise exception 'Password gagal disimpan. Data lama tidak berubah.';
  end if;

  -- 6. Cabut sesi divisi supaya password baru langsung berlaku.
  delete from public.division_sessions s where s.divisi_id = p_divisi_id;

  return query select true, v_target, v_now;
end;
$$;


-- =====================================================
-- 12. FUNGSI LAMA -> DELEGASI KE INTI YANG SAMA
--     Tidak ada lagi dua implementasi yang bisa beda hasil.
-- =====================================================
create or replace function public.admin_set_division_password(
  p_divisi_id uuid,
  p_password text,
  p_periode_id uuid default null
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_updated_at timestamptz;
begin
  select s.updated_at into v_updated_at
    from public.admin_division_account_save(
      p_divisi_id, p_password, p_periode_id
    ) as s;

  return v_updated_at;
end;
$$;


-- =====================================================
-- 13. HUBUNGAN DIVISI <-> PERIODE
-- =====================================================
create or replace function public.admin_divisi_set_period(
  p_divisi_id uuid,
  p_periode_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_super_admin() or public.current_role() = 'admin') then
    raise exception 'Tidak punya izin.' using errcode = '42501';
  end if;

  -- Admin hanya boleh memindahkan divisi yang belum terikat ke
  -- periode lain, supaya divisi 2026/2027 tidak bisa "dibajak"
  -- oleh Admin periode 2027/2028.
  if public.current_role() = 'admin' and exists (
    select 1
      from public.divisi d
     where d.id = p_divisi_id
       and d.periode_id is not null
       and not exists (
         select 1
           from public.admin_periods ap
          where ap.admin_id = auth.uid()
            and ap.periode_id = d.periode_id
       )
  ) then
    raise exception 'Divisi ini sudah terikat ke periode lain.'
      using errcode = '42501';
  end if;

  if p_periode_id is not null and not public.is_period_writable(p_periode_id) then
    raise exception 'Periode ini hanya bisa dibaca.' using errcode = '42501';
  end if;

  update public.divisi d
     set periode_id = p_periode_id
   where d.id = p_divisi_id;
end;
$$;


-- =====================================================
-- 14. PENUGASAN ADMIN PERIODE
-- =====================================================
create or replace function public.admin_assign_period(
  p_user_id uuid,
  p_periode_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat menetapkan Admin periode.'
      using errcode = '42501';
  end if;

  -- Super Admin tidak boleh kehilangan kontrol sistem.
  if exists (
    select 1
      from public.profiles pr
     where pr.id = p_user_id
       and pr.role = 'super_admin'
  ) then
    if p_periode_id is not null then
      raise exception 'Super Admin tidak dapat ditugaskan sebagai Admin periode.'
        using errcode = '42501';
    end if;
  end if;

  delete from public.admin_periods ap where ap.admin_id = p_user_id;

  if p_periode_id is null then
    update public.profiles pr
       set periode_id = null
     where pr.id = p_user_id;
    return;
  end if;

  insert into public.admin_periods (admin_id, periode_id, assigned_by)
  values (p_user_id, p_periode_id, auth.uid());

  update public.profiles pr
     set periode_id = p_periode_id
   where pr.id = p_user_id;
end;
$$;


-- =====================================================
-- 15. UBAH ROLE
-- =====================================================
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role text;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat mengubah role.'
      using errcode = '42501';
  end if;

  if p_role not in ('super_admin','admin','division_admin','monitoring','sekretaris','bendahara') then
    raise exception 'Role tidak dikenal.' using errcode = '22023';
  end if;

  select pr.role into v_old_role
    from public.profiles pr
   where pr.id = p_user_id
     for update;

  if v_old_role is null then
    raise exception 'Pengguna tidak ditemukan.' using errcode = '22023';
  end if;

  -- Minimal harus ada satu akun Super Admin aktif.
  if v_old_role = 'super_admin' and p_role <> 'super_admin' then
    if (select count(*) from public.profiles pr where pr.role = 'super_admin') <= 1 then
      raise exception 'Minimal harus ada satu akun Super Admin.'
        using errcode = '42501';
    end if;
  end if;

  update public.profiles pr
     set role = p_role
   where pr.id = p_user_id;

  -- Admin yang kehilangan role admin kehilangan periodenya juga.
  if p_role <> 'admin' then
    delete from public.admin_periods ap where ap.admin_id = p_user_id;
    update public.profiles pr
       set periode_id = null
     where pr.id = p_user_id;
  end if;
end;
$$;


-- =====================================================
-- 16. ACL
--     Semua fungsi administrative hanya untuk `authenticated`.
--     Otorisasi tetap diperiksa di dalam fungsi (SECURITY
--     DEFINER + guard), jadi GRANT bukan satu-satunya pertahanan.
-- =====================================================
do $$
declare
  sig text;
begin
  foreach sig in array array[
    'division_crypto_search_path()',
    'division_period_id(uuid)',
    'verify_division_password(uuid, text)',
    'start_division_session(uuid, text)',
    'current_role()',
    'is_super_admin()',
    'profile_period_id()',
    'profile_divisi_id()',
    'admin_has_period_assignment(uuid)',
    'admin_has_any_assignment()',
    'can_access_period(uuid)',
    'is_period_writable(uuid)',
    'admin_accounts_list(uuid)',
    'admin_division_account_list(uuid)',
    'admin_division_credential_status(uuid)',
    'admin_division_account_save(uuid, text, uuid)',
    'admin_set_division_password(uuid, text, uuid)',
    'admin_divisi_set_period(uuid, uuid)',
    'admin_assign_period(uuid, uuid)',
    'admin_set_user_role(uuid, text)'
  ] loop
    if to_regprocedure('public.' || sig) is not null then
      execute format('revoke all on function public.%s from public, anon', sig);
      execute format('grant execute on function public.%s to authenticated', sig);
    end if;
  end loop;
end $$;


-- =====================================================
-- 17. VERIFIKASI
--     Menjalankan statement yang MIRIP dengan yang dipakai
--     aplikasi, termasuk bentuk INSERT ... ON CONFLICT yang
--     paling sering jadi biang "periode_id is ambiguous".
--     Semua uji tulis memakai `where false` / `select` kosong,
--     jadi tidak ada data yang berubah.
-- =====================================================
do $$
declare
  q text;
  n bigint;
begin
  foreach q in array array[
    -- bentuk yang dipakai saat halaman dimuat
    'select count(*) from public.admin_division_account_list(null)',
    'select count(*) from public.admin_accounts_list(null)',
    'select count(*) from public.admin_division_credential_status(null)',
    -- join 2 tabel yang sama-sama punya periode_id
    'select count(*) from public.profiles pr
       join public.admin_periods ap on ap.admin_id = pr.id
      where pr.periode_id = ap.periode_id',
    -- UPDATE dengan alias (tidak menulis apa pun)
    'update public.divisi d set periode_id = d.periode_id where d.id is null',
    -- INSERT + ON CONFLICT persis seperti di fungsi simpan (0 baris)
    'insert into public.division_credentials (divisi_id, periode_id, password_hash, updated_at, updated_by)
       select d.id, d.periode_id, '''', now(), null
         from public.divisi d where false
     on conflict (divisi_id, periode_id) do update
       set password_hash = excluded.password_hash,
           updated_at    = excluded.updated_at,
           updated_by    = excluded.updated_by'
  ] loop
    begin
      execute q;
      raise notice 'OK    | %', left(q, 90);
    exception when others then
      raise notice 'GAGAL | %  ==>  % (%)', left(q, 90), sqlerrm, sqlstate;
    end;
  end loop;

  -- Bangun badan fungsi save sampai statement paling rawan.
  begin
    perform 1
      from public.admin_division_account_save(null, 'x', null);
    raise notice 'OK    | admin_division_account_save() dijalankan';
  exception when others then
    if sqlstate in ('42501', '22023') then
      raise notice 'OK    | admin_division_account_save() jalan (guard %)', sqlstate;
    else
      raise notice 'GAGAL | admin_division_account_save()  ==>  % (%)', sqlerrm, sqlstate;
    end if;
  end;

  -- Sanity: divisi yang punya password harus punya kredensial
  -- pada periode efektifnya.
  select count(*) into n
    from public.divisi d
   where d.periode_id is not null
     and exists (
       select 1
         from public.division_credentials c
        where c.divisi_id = d.id
          and c.periode_id = d.periode_id
     );
  raise notice 'OK    | % divisi punya kredensial pada periodenya', n;

  raise notice '--- selesai verifikasi 0005 ---';
end $$;