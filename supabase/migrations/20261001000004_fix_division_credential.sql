-- =====================================================
-- APKOSIS - Perbaikan end-to-end akun & password divisi
--
-- GEJALA (sudah dikonfirmasi di database):
--   1. Di "Super Admin > Kelola Akun", status password divisi
--      selalu "Belum ada password" walaupun hash-nya sudah ada.
--   2. Password baru yang disimpan TIDAK bisa dipakai untuk login,
--      sedangkan password lama masih berlaku.
--
-- PENYEBAB 1 -- status selalu "Belum ada password"
--   `admin_division_account_list()` melakukan
--       left join division_credentials dc
--         on dc.divisi_id = dv.id and dc.periode_id = p_periode_id
--   Halaman Kelola Akun memanggil fungsi ini dengan
--   `p_periode_id = null` (mode "seluruh periode"). Nilai NULL
--   membuat `dc.periode_id = NULL` SELALU false, jadi LEFT JOIN tidak
--   pernah menghasilkan baris: `has_password` selalu false.
--
-- PENYEBAB 2 -- password baru tidak berlaku, yang lama masih berlaku
--   `verify_division_password()` melakukan
--       select c.password_hash ... where c.divisi_id = p_divisi_id
--   `division_credentials` memakai primary key (divisi_id, periode_id).
--   Begitu ada >1 periode untuk satu divisi, query itu mengembalikan
--   BANYAK baris dan `select ... into` mengambil baris yang tidak
--   tertentu. Login pun membandingkan password dengan hash periode
--   yang SALAH -> password baru ditolak, password lama diterima.
--
-- PERBAIKAN
--   1. `division_period_id()` jadi SATU sumber kebenaran periode
--      efektif sebuah divisi (divisi.periode_id, fallback periode
--      aktif). Tidak ada lagi tebakan baris mana yang dipakai.
--   2. `verify_division_password()` dan `start_division_session()`
--      hanya mengecek hash pada periode efektif tersebut, sehingga
--      password baru langsung berlaku dan password lama langsung
--      tidak berlaku.
--   3. `admin_division_account_list()` memakai LEFT JOIN yang sudah
--      diresolusi, dan ikut mengembalikan `periode_id` +
--      `periode_nama` milik divisi sehingga UI bisa menampilkan dan
--      menyimpan periode yang benar.
--   4. `admin_division_account_save()` = satu operasi ATOMIK:
--      validasi -> simpan periode divisi -> tulis hash bcrypt ->
--      verifikasi hash benar-benar terbaca -> cabut sesi divisi.
--      Gagal di tengah = rollback, tidak ada kondisi setengah
--      tersimpan dan notifikasi sukses palsu.
--   5. `admin_set_division_password()` sekarang memanggil inti yang
--      sama, jadi halaman "Admin > Password Divisi" ikut benar
--      tanpa kode duplikat.
--
-- CATATAN PENTING -- pgcrypto
--   Di project ini pgcrypto terpasang di schema `extensions`, bukan
--   `public`. Fungsi yang `set search_path = public` saja akan gagal
--   dengan "function crypt(text, text) does not exist". Karena itu
--   semua fungsi yang memakai crypt()/gen_salt() memakai
--   `search_path = public, extensions` plus resolver
--   `division_crypto_search_path()` (sudah ada sejak
--   20260112000000_fix_pgcrypto_and_rpc_acl.sql).
--
-- Keamanan:
--   - Password tidak pernah disimpan plaintext. Yang disimpan hanya
--     hash bcrypt (`crypt` + `gen_salt('bf')`).
--   - Fungsi tetap SECURITY DEFINER dan pemeriksa role berada di
--     dalam fungsi, jadi tidak bisa dilewati dari client.
--   - Tidak ada perubahan pada tabel `auth.users`: kredensial divisi
--     memang bukan akun Supabase Auth terpisah, melainkan password
--     divisi yang diverifikasi lewat `start_division_session()`.
--
-- Aman dijalankan berulang kali (idempotent).
-- Jalankan di Supabase Dashboard -> SQL Editor, SETELAH
-- 20261001000003_fix_profiles_policy_recursion.sql.
-- =====================================================


-- =====================================================
-- 0. PASTIKAN pgcrypto BISA DITEMUKAN
--    Sama seperti 20260112000000, supaya tidak bergantung tebakan
--    schema: public atau extensions.
-- =====================================================
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

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
-- 1. PERIODE EFEKTIF SEBUAH DIVISI (sumber kebenaran tunggal)
-- =====================================================
create or replace function public.division_period_id(p_divisi_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select d.periode_id from public.divisi d where d.id = p_divisi_id),
    public.get_active_period_id()
  );
$$;


-- =====================================================
-- 2. VERIFIKASI PASSWORD (hanya periode efektif)
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
-- 3. SESI DIVISI (login memakai password divisi)
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

  if not exists (select 1 from public.divisi where id = p_divisi_id) then
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

  delete from public.division_sessions where expires_at <= now();

  v_token := gen_random_uuid();

  insert into public.division_sessions (token, user_id, divisi_id, expires_at)
  values (v_token, auth.uid(), p_divisi_id, now() + interval '12 hours');

  return v_token;
end;
$$;


-- =====================================================
-- 4. DAFTAR AKUN DIVISI (status password dari database)
--    Return type berubah -> fungsi lama WAJIB di-drop dulu,
--    karena CREATE OR REPLACE tidak boleh mengganti tipe balasan.
-- =====================================================
drop function if exists public.admin_division_account_list(uuid);

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
set search_path = public, extensions
as $$
  -- Periode yang dicek:
  --   - Super Admin / mode "seluruh periode": periode milik divisi itu
  --     sendiri; kalau divisi belum punya periode, pakai periode aktif.
  --   - Admin periode: harus menyebut periodenya (lihat guard di bawah).
  select
    dv.id,
    dv.nomor_divisi,
    dv.nama_divisi,
    (select count(*) from public.profiles pr where pr.divisi_id = dv.id),
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
-- 5. STATUS KREDENTIAL (dipakai "Admin > Password Divisi")
--    Diperbaiki dengan pola yang sama: LEFT JOIN per divisi, bukan
--    hanya baris yang sudah punya kredensial.
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
set search_path = public, extensions
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
-- 6. SIMPAN AKUN DIVISI (ATOMIK)
--    Satu-satunya jalan untuk menulis password + periode divisi.
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

  if not exists (select 1 from public.divisi where id = p_divisi_id) then
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

  if not exists (select 1 from public.periods where id = v_target) then
    raise exception 'Periode tidak ditemukan.' using errcode = '22023';
  end if;

  -- Admin hanya boleh periode yang menjadi tanggung jawabnya.
  if not v_is_super and not public.can_access_period(v_target) then
    raise exception 'Anda tidak mengelola periode ini.'
      using errcode = '42501';
  end if;

  if not public.is_period_writable(v_target) then
    raise exception 'Periode ini hanya bisa dibaca.'
      using errcode = '42501';
  end if;

  -- 3. Periode divisi = sumber kebenaran aplikasi ---------------
  update public.divisi set periode_id = v_target where id = p_divisi_id;

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
  --    Kalau gagal, exception -> seluruh transaksi rollback, hash
  --    lama tetap utuh dan UI tidak boleh menampilkan sukses.
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
  delete from public.division_sessions where divisi_id = p_divisi_id;

  return query select true, v_target, v_now;
end;
$$;


-- =====================================================
-- 7. FUNGSI LAMA -> MEMAKAI INI YANG SAMA
--    Tidak ada lagi dua implementasi yang bisa berbeda hasil.
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
set search_path = public, extensions
as $$
declare
  v_updated_at timestamptz;
begin
  select s.updated_at into v_updated_at
    from public.admin_division_account_save(p_divisi_id, p_password, p_periode_id) s;

  return v_updated_at;
end;
$$;


-- =====================================================
-- 8. ACL
-- =====================================================
do $$
declare
  sig text;
begin
  foreach sig in array array[
    'verify_division_password(uuid, text)',
    'start_division_session(uuid, text)',
    'end_division_session(uuid)',
    'division_period_id(uuid)',
    'division_crypto_search_path()',
    'admin_division_account_list(uuid)',
    'admin_division_credential_status(uuid)',
    'admin_division_account_save(uuid, text, uuid)',
    'admin_set_division_password(uuid, text, uuid)'
  ]
  loop
    if to_regprocedure('public.' || sig) is not null then
      execute format('revoke all on function public.%s from public, anon', sig);
      execute format('grant execute on function public.%s to authenticated', sig);
    end if;
  end loop;
end $$;


-- =====================================================
-- 9. VERIFIKASI (hasil muncul di Output / Notices SQL Editor)
-- =====================================================
do $$
declare
  r record;
  v_hash text;
  v_ok boolean;
begin
  -- 9a. Pastikan pgcrypto benar-benar bisa dipakai.
  perform set_config('search_path', public.division_crypto_search_path(), true);

  v_hash := crypt('probe', gen_salt('bf'));
  v_ok := v_hash like '$2%' and crypt('probe', v_hash) = v_hash
          and crypt('salah', v_hash) <> v_hash;

  if v_ok then
    raise notice 'pgcrypto: OK (bcrypt bekerja, password salah ditolak)';
  else
    raise warning 'pgcrypto: PERIKSA ULANG - hashing tidak berperilaku benar';
  end if;

  -- 9b. Ringkasan status password per divisi.
  raise notice '--- Ringkasan kredensial divisi ---';

  for r in
    select dv.nomor_divisi,
           dv.nama_divisi,
           coalesce(p.nama_periode, '(kosong)') as periode_divisi,
           count(c.divisi_id) as jumlah_kredensial
    from public.divisi dv
    left join public.periods p on p.id = dv.periode_id
    left join public.division_credentials c on c.divisi_id = dv.id
    group by dv.nomor_divisi, dv.nama_divisi, p.nama_periode
    order by dv.nomor_divisi
  loop
    raise notice 'Divisi % - % | periode=% | kredensial=%',
      r.nomor_divisi, r.nama_divisi, r.periode_divisi, r.jumlah_kredensial;
  end loop;

  raise notice 'Selesai. Refresh halaman Kelola Akun lalu login ulang memakai password baru.';
end $$;