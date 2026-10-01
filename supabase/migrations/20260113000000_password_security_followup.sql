-- =====================================================
-- PERBAIKAN KEAMANAN PASSWORD DIVISI (lanjutan)
-- ---------------------------------------------------------
-- Dua perbaikan:
--
-- 1. division_password_selfcheck() versi lama salah logika.
--    Ia membandingkan dua hash dari password yang sama tetapi
--    dengan salt berbeda, sehingga hasilnya SELALU false
--    walaupun hashing-nya bekerja benar.
--    Pola yang benar sama dengan verify_division_password():
--      1. buat hash dari nilai uji
--      2. crypt(nilai_uji, hash) = hash  -> harus true
--
-- 2. set_division_password() mengganti hash password, tetapi
--    TIDAK mengakhiri sesi divisi yang sedang aktif. Artinya
--    seseorang yang sudah masuk sebelumnya tetap punya akses
--    sampai 12 jam ke depan, padahal password lamanya sudah
--    tidak berlaku lagi. Setelah password diganti, seluruh sesi
--    divisi tersebut langsung dihapus.
--
-- Catatan: nilai uji di selfcheck dibuat dari gen_random_uuid(),
-- bukan string yang ditulis manual di source.
-- =====================================================

-- =====================================================
-- 1. division_password_selfcheck() diperbaiki
-- =====================================================
create or replace function public.division_password_selfcheck()
returns boolean
language plpgsql
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_probe text := gen_random_uuid()::text;
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  v_hash := crypt(v_probe, gen_salt('bf'));

  return crypt(v_probe, v_hash) = v_hash;
end;
$$;

revoke all on function public.division_password_selfcheck() from public;
revoke all on function public.division_password_selfcheck() from anon;
revoke all on function public.division_password_selfcheck() from authenticated;

-- =====================================================
-- 2. set_division_password() kini mengakhiri sesi aktif
-- =====================================================
create or replace function public.set_division_password(
  p_divisi_id uuid,
  p_password text
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public
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

  -- Password lama harus langsung tidak berlaku, termasuk untuk
  -- sesi yang sudah aktif sebelum password diganti.
  delete from public.division_sessions where divisi_id = p_divisi_id;

  return v_now;
end;
$$;

revoke all on function public.set_division_password(uuid, text) from public;
revoke all on function public.set_division_password(uuid, text) from anon;
grant execute on function public.set_division_password(uuid, text) to authenticated;