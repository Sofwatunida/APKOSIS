-- ============================================================
-- Super Admin: Tambah Divisi
-- ============================================================
-- Menambah divisi baru hanya boleh dilakukan Super Admin.
-- Tabel `divisi` punya RLS insert-policy yang hanya mengizinkan
-- "admin sendiri", sehingga insert langsung dari Super Admin akan
-- ditolak. Karena itu dibuat fungsi SECURITY DEFINER yang:
--   - memverifikasi pemanggil adalah super_admin,
--   - memvalidasi input (nomor > 0, nama tidak kosong),
--   - menolak duplikat nomor maupun nama (case-insensitive),
--   - mengembalikan id divisi baru.
--
-- Idempoten: `create or replace function` aman dijalankan berulang.
-- Tidak mengubah data/migration yang sudah ada.

create or replace function public.admin_divisi_create(
  p_nomor integer,
  p_nama text,
  p_periode_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nomor integer;
  v_nama text;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang boleh menambah divisi.'
      using errcode = '42501';
  end if;

  if p_nomor is null or p_nomor < 1 then
    raise exception 'Nomor divisi harus angka lebih dari 0.'
      using errcode = '22023';
  end if;

  v_nama := trim(coalesce(p_nama, ''));
  if v_nama = '' then
    raise exception 'Nama divisi tidak boleh kosong.'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.divisi d where d.nomor_divisi = p_nomor
  ) then
    raise exception 'Nomor divisi % sudah dipakai.', p_nomor
      using errcode = '23505';
  end if;

  if exists (
    select 1 from public.divisi d where lower(d.nama_divisi) = lower(v_nama)
  ) then
    raise exception 'Nama divisi "%" sudah dipakai.', v_nama
      using errcode = '23505';
  end if;

  if p_periode_id is not null and not exists (
    select 1 from public.periods p where p.id = p_periode_id
  ) then
    raise exception 'Periode tidak ditemukan.'
      using errcode = '23503';
  end if;

  insert into public.divisi (nomor_divisi, nama_divisi, periode_id)
  values (p_nomor, v_nama, p_periode_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- Batasi eksekusi hanya untuk role authenticated (guard super_admin ada
-- di dalam fungsi). Grant execute ke authenticated seperti RPC admin lain.
revoke all on function public.admin_divisi_create(integer, text, uuid) from public;
revoke all on function public.admin_divisi_create(integer, text, uuid) from anon;
grant execute on function public.admin_divisi_create(integer, text, uuid) to authenticated;
