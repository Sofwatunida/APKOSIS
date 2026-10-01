-- =====================================================
-- PERBAIKAN: pgcrypto search_path + kunci akses RPC
-- ---------------------------------------------------------
-- Ditemukan saat verifikasi terhadap project Supabase:
--
-- 1. Fungsi yang memakai crypt()/gen_salt() gagal dengan
--    "function gen_salt(unknown) does not exist".
--    Penyebab: pgcrypto terpasang di schema `extensions`,
--    sedangkan fungsi diset `search_path = public`.
--
-- 2. Project ini memberi EXECUTE default ke `anon` untuk
--    fungsi baru di schema public, sehingga `revoke ... from
--    public` saja tidak cukup. Semua fungsi baru dikunci
--    eksplisit terhadap `anon`.
--
-- 3. set_division_password_by_number() dihapus. Fungsi itu
--    tidak punya pemeriksaan role sama sekali (bergantung
--    penuh pada revoke) sehingga berisiko bisa dipanggil
--    siapa pun. Bootstrapping password pertama sekarang
--    dilakukan lewat halaman Pengaturan Password Divisi,
--    yang bisa dibuka tanpa sesi divisi.
-- =====================================================

-- =====================================================
-- 1. Pastikan pgcrypto bisa ditemukan
-- =====================================================
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Resolver: cari schema tempat pgcrypto benar-benar terpasang,
-- lalu dipakai oleh setiap fungsi yang memanggil crypt()/gen_salt().
-- Tidak perlu menebak apakah ada di `public` atau `extensions`.
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
    'public'
  );
$$;

-- =====================================================
-- 2. HAPUS utilitas tanpa pemeriksaan role
-- =====================================================
drop function if exists public.set_division_password_by_number(integer, text);

-- =====================================================
-- 3. Token sesi divisi
-- =====================================================
create or replace function public.division_session_token()
returns text
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_headers jsonb;
  v_token text;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  v_token := v_headers ->> 'x-division-token';
  return nullif(btrim(coalesce(v_token, '')), '');
exception when others then
  return null;
end;
$$;

revoke all on function public.division_session_token() from public;
revoke all on function public.division_session_token() from anon;
grant execute on function public.division_session_token() to authenticated;

-- =====================================================
-- 4. Verifikasi password (bcrypt via pgcrypto)
-- =====================================================
create or replace function public.verify_division_password(
  p_divisi_id uuid,
  p_password text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  if not public.is_division_admin() then
    return false;
  end if;

  if p_divisi_id is null or p_password is null or p_password = '' then
    return false;
  end if;

  select c.password_hash into v_hash
    from public.division_credentials c
   where c.divisi_id = p_divisi_id;

  if v_hash is null then
    return false;
  end if;

  return crypt(p_password, v_hash) = v_hash;
end;
$$;

revoke all on function public.verify_division_password(uuid, text) from public;
revoke all on function public.verify_division_password(uuid, text) from anon;
grant execute on function public.verify_division_password(uuid, text) to authenticated;

-- =====================================================
-- 5. Mulai sesi divisi
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
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  if not public.is_division_admin() then
    raise exception 'Akses hanya untuk akun divisi.';
  end if;

  if p_divisi_id is null or p_password is null or p_password = '' then
    raise exception 'Pilih divisi dan masukkan password divisi.';
  end if;

  if not exists (
    select 1 from public.division_credentials where divisi_id = p_divisi_id
  ) then
    raise exception 'Divisi ini belum memiliki password.';
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

revoke all on function public.start_division_session(uuid, text) from public;
revoke all on function public.start_division_session(uuid, text) from anon;
grant execute on function public.start_division_session(uuid, text) to authenticated;

-- =====================================================
-- 6. Selesai sesi divisi
-- =====================================================
create or replace function public.end_division_session(p_token uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  if p_token is null then
    return;
  end if;

  delete from public.division_sessions
   where token = p_token
     and user_id = auth.uid();
end;
$$;

revoke all on function public.end_division_session(uuid) from public;
revoke all on function public.end_division_session(uuid) from anon;
grant execute on function public.end_division_session(uuid) to authenticated;

-- =====================================================
-- 7. Status password divisi
-- =====================================================
create or replace function public.division_credential_status()
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
  select d.id,
         d.nomor_divisi,
         d.nama_divisi,
         (c.divisi_id is not null),
         c.updated_at
    from public.divisi d
    left join public.division_credentials c on c.divisi_id = d.id
   where public.is_division_admin()
   order by d.nomor_divisi;
$$;

revoke all on function public.division_credential_status() from public;
revoke all on function public.division_credential_status() from anon;
grant execute on function public.division_credential_status() to authenticated;

-- =====================================================
-- 8. Set / ganti password divisi
-- =====================================================
create or replace function public.set_division_password(
  p_divisi_id uuid,
  p_password text
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  if not public.is_division_admin() then
    raise exception 'Akses hanya untuk akun divisi (division_admin).';
  end if;

  if p_divisi_id is null then
    raise exception 'Divisi tidak valid.';
  end if;

  if not exists (select 1 from public.divisi where id = p_divisi_id) then
    raise exception 'Divisi tidak ditemukan.';
  end if;

  if p_password is null or length(p_password) < 4 then
    raise exception 'Password divisi minimal 4 karakter.';
  end if;

  if length(p_password) > 128 then
    raise exception 'Password divisi maksimal 128 karakter.';
  end if;

  insert into public.division_credentials (divisi_id, password_hash, updated_at)
  values (p_divisi_id, crypt(p_password, gen_salt('bf')), v_now)
  on conflict (divisi_id) do update
    set password_hash = excluded.password_hash,
        updated_at = v_now;

  return v_now;
end;
$$;

revoke all on function public.set_division_password(uuid, text) from public;
revoke all on function public.set_division_password(uuid, text) from anon;
grant execute on function public.set_division_password(uuid, text) to authenticated;

-- =====================================================
-- 9. Pemeriksaan cepat hashing (dipakai untuk verifikasi manual)
-- Tidak diberi grant ke anon/authenticated apa pun.
--
-- Menguji persis properti yang dipakai aplikasi:
--   crypt(password, hash_tersimpan) = hash_tersimpan
-- Benar harus true, password salah harus false, dan hashnya
-- harus berbentuk bcrypt ($2...).
-- =====================================================
create or replace function public.division_password_selfcheck()
returns boolean
language plpgsql
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  v_hash := crypt('probe', gen_salt('bf'));

  return v_hash like '$2%'
     and crypt('probe', v_hash) = v_hash
     and crypt('password-salah', v_hash) <> v_hash;
end;
$$;

revoke all on function public.division_password_selfcheck() from public;
revoke all on function public.division_password_selfcheck() from anon;
revoke all on function public.division_password_selfcheck() from authenticated;
