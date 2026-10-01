-- =====================================================
-- PENGATURAN PASSWORD DIVISI OLEH ADMIN (division_admin)
-- ---------------------------------------------------------
-- Admin MENENTUKAN sendiri password setiap divisi lewat
-- halaman pengaturan. Tidak ada password acak, tidak ada
-- password default, tidak ada password yang ditampilkan
-- kembali dari database.
--
-- HANYA berlaku untuk role = 'division_admin'.
-- =====================================================

-- =====================================================
-- 1. HAPUS OVERLOAD VERSI LAMA (berdasarkan nomor divisi)
-- Digantikan oleh versi uuid yang bisa dipanggil dari aplikasi.
-- =====================================================
drop function if exists public.set_division_password(integer, text);

-- =====================================================
-- 2. STATUS PASSWORD PER DIVISI (TANPA MENGEMBALIKAN HASH)
-- Hanya memberi tahu apakah password sudah pernah dibuat.
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
set search_path = public
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
grant execute on function public.division_credential_status() to authenticated;

-- =====================================================
-- 3. SET / GANTI PASSWORD DIVISI
-- Password di-hash di dalam database dengan bcrypt (crypt)
-- dari plaintext yang dikirim aplikasi. Password lama
-- langsung tidak berlaku karena hash ditimpa.
--
-- Toko: tidak ada select policy untuk division_credentials,
-- jadi hash tidak pernah bisa dibaca lewat PostgREST.
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
grant execute on function public.set_division_password(uuid, text) to authenticated;
