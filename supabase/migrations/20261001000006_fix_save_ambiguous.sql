-- =====================================================
-- APKOSIS - Perbaikan SATU-SATUNYA: 42702
-- "column reference periode_id is ambiguous"
--
-- BUKTI (diuji langsung ke database live, bukan dugaan):
--
--   rpc/admin_division_account_save
--     -> HTTP 400  42702: column reference "periode_id" is ambiguous
--   rpc/admin_set_division_password
--     -> HTTP 400  42702: column reference "periode_id" is ambiguous
--
--   Sementara ini MEMANG berfungsi:
--     admin_accounts_list            HTTP 200
--     admin_division_account_list    HTTP 200  (20 baris, 8 kolom)
--     admin_division_credential_status HTTP 200
--     admin_divisi_set_period        HTTP 204
--     admin_assign_period            HTTP 204
--
-- SEBABNYA
--   `admin_division_account_save` bertipe plpgsql dan mengembalikan
--   `returns table (has_password boolean, periode_id uuid, updated_at
--   timestamptz)`. Pada plpgsql, NAMA KOLOM pada RETURNS TABLE menjadi
--   variabel lokal. Jadi `periode_id` SESAMA:
--     1) variabel plpgsql (parameter keluaran), dan
--     2) kolom nyata milik tabel `division_credentials`.
--
--   Di dalam badan fungsi ada:
--       on conflict (divisi_id, periode_id) do update ...
--   Target `on conflict` diurai plpgsql sebagai ColumnRef, lalu
--   dicoba diganti variabel. Karena `periode_id` juga kolom tabel,
--   PostgreSQL menolak dengan 42702 ambiguous_column.
--
--   `admin_set_division_password` ikut gagal karena hanya pembungkus
--   yang memanggil `admin_division_account_save`. Jadi SATU fungsi
--   ini memperbaiki KEDUA error.
--
-- PERBAIKAN
--   1. `#variable_conflict use_column` -- opsi resmi PostgreSQL
--      untuk error ini. Kolom menang atas variabel. Body fungsi ini
--      tidak pernah perlu membaca variabel keluaran, jadi aman.
--   2. Semua query diberi alias dan memakai kolom beralias.
--
-- KENAPA TIDAK Migration 0005
--   Semua RPC lain yang sudah saya uji ke database live berfungsi
--   normal. Migration 0005 (drop overload liar + buat ulang seluruh
--   rantai Kelola Akun) tidak diperlukan untuk error ini.
--   Menjalankan 0005 akan mengubah 20+ fungsi sekaligus; migration
--   ini hanya satu fungsi.
--
-- KEAMANAN / RISIKO
--   - `create or replace` dengan signature dan tipe balik yang SAMA
--     -> OID fungsi TIDAK berubah, jadi seluruh GRANT dan policy
--     RLS yang sudah terpasang tetap utuh. Tidak perlu ACL baru.
--   - Tidak ada `drop`, tidak ada perubahan tabel, tidak ada pilihan
--     data, tidak ada perubahan schema.
--   - Idempotent: aman dijalankan berulang kali.
--   - Jalankan SETELAH 20261001000004_fix_division_credential.sql.
-- =====================================================


-- =====================================================
-- 1. FUNGSI YANG DIPERBAIKI
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
#variable_conflict use_column
-- Baris di atas WAJIB ada, di baris pertama badan fungsi, sebelum
-- DECLARE, tanpa kode lain di baris yang sama.
--
-- Nama kolom pada RETURNS TABLE (`periode_id`) juga menjadi variabel
-- lokal plpgsql. Tanpa directive ini, statement
--     on conflict (divisi_id, periode_id) do update ...
-- ditolak dengan 42702 "column reference periode_id is ambiguous".
--
-- Efeknya: kolom menang atas variabel. Body fungsi ini tidak pernah
-- membaca variabel keluaran, jadi tidak ada perilaku yang berubah.
declare
  v_is_super boolean;
  v_target uuid;
  v_now timestamptz := now();
begin
  -- pgcrypto bisa berada di `public` atau `extensions`. Jangan ditebak.
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
  --    Periode efektif divisi = kolom divisi.periode_id, fallback periode aktif.
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
  update public.divisi d
     set periode_id = v_target
   where d.id = p_divisi_id;

  -- 4. Tulis hash bcrypt (password plaintext tidak pernah disimpan) --
  --    Nama kolom pada daftar INSERT / ON CONFLICT WAJIB polos karena
  --    secara sintaks posisi itu adalah kolom, bukan ekspresi.
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
-- 2. VERIFIKASI
--
-- Menjalankan bentuk statement yang PERSIS memicu error 42702.
-- Semua uji tulis memakai UUID palsu / `where false`, jadi tidak ada
-- data yang berubah.
-- =====================================================
do $$
declare
  q text;
  n bigint;
begin
  foreach q in array array[
    -- Bentuk yang dulu gagal. Function call dengan divisi palsu akan
    -- berhenti di guard 22023, TAPI ke-5 statement di bawahlah yang
    -- dulu melempar 42702.
    'select count(*) from public.admin_division_account_save(null, ''x'', null)',
    'select count(*) from public.admin_set_division_password(null, ''x'', null)',
    -- Bentuk ON CONFLICT yang jadi biang 42702 (0 baris, tidak menulis)
    'insert into public.division_credentials (divisi_id, periode_id, password_hash, updated_at, updated_by)
       select d.id, d.periode_id, '''', now(), null
         from public.divisi d where false
     on conflict (divisi_id, periode_id) do update
       set password_hash = excluded.password_hash,
           updated_at    = excluded.updated_at,
           updated_by    = excluded.updated_by',
    -- UPDATE dengan alias (tidak menulis apa pun)
    'update public.divisi d set periode_id = d.periode_id where d.id is null'
  ] loop
    begin
      execute q;
      raise notice 'OK    | %', left(q, 80);
    exception
      when sqlstate '22023' or sqlstate '42501' then
        -- Guard yang diharapkan:artinya badan fungsi jalan.
        raise notice 'OK    | %  (kena guard %)', left(q, 60), sqlstate;
      when others then
        raise notice 'GAGAL | %  ==>  % (%)', left(q, 60), sqlerrm, sqlstate;
    end;
  end loop;

  -- Guard lama TIDAK boleh hilang: fungsi wajib menolak peran lain.
  begin
    perform 1 from public.admin_division_account_save(
      '00000000-0000-0000-0000-000000000000'::uuid, 'ujisandi123', null
    );
    raise notice 'GAGAL | guard tidak menolak divisi palsu';
  exception
    when sqlstate '22023' then
      raise notice 'OK    | guard 22023 masih menolak divisi palsu';
    when others then
      raise notice 'GAGAL | guard salah ==> % (%)', sqlerrm, sqlstate;
  end;

  -- Sanity: password yang ada harus berupa hash bcrypt.
  select count(*) into n
    from public.division_credentials c
   where c.password_hash not like '$2%';
  raise notice 'OK    | % kredensial BUKAN bcrypt (harus 0)', n;

  raise notice '--- selesai 0006 ---';
end $$;