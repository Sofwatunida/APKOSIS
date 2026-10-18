-- ============================================================
-- Super Admin: Backup / Reset / Restore (scoped per periode)
-- ============================================================
-- Dua fungsi SECURITY DEFINER yang hanya bisa dipanggil Super Admin:
--
-- 1) admin_reset_periode_data(p_periode_id)
--    Menghapus data operasional satu periode (laporan, keuangan,
--    kendala, inventaris, kebutuhan, opsi_kegiatan). TIDAK menyentuh
--    akun (profiles/admin_periods), divisi, periode, division_credentials,
--    maupun program_kerja. Aman dijalankan dalam satu transaksi.
--
-- 2) admin_restore_backup(p_payload jsonb)
--    Menggabungkan (merge) isi backup JSON ke database secara idempoten
--    (ON CONFLICT (id) DO NOTHING) dan hanya memasukkan baris yang
--    referensi divisi/periodenya sudah ada, sehingga integritas FK
--    terjaga. Bersifat aditif (tidak menimpa data yang sudah ada).
--
-- Idempoten & tidak mengubah migration/data yang sudah ada.

-- ---------- 1) RESET ----------
create or replace function public.admin_reset_periode_data(p_periode_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n_kendala int := 0;
  v_n_kebutuhan int := 0;
  v_n_trx int := 0;
  v_n_laporan int := 0;
  v_n_inv int := 0;
  v_n_opsi int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang boleh mereset data periode.'
      using errcode = '42501';
  end if;

  if p_periode_id is null or not exists (
    select 1 from public.periods p where p.id = p_periode_id
  ) then
    raise exception 'Periode tidak ditemukan.' using errcode = '23502';
  end if;

  -- Anak dulu (urutan aman FK).
  delete from public.kendala_solusi where periode_id = p_periode_id;
  get diagnostics v_n_kendala = row_count;

  delete from public.kebutuhan where periode_id = p_periode_id;
  get diagnostics v_n_kebutuhan = row_count;

  delete from public.transaksi_keuangan where periode_id = p_periode_id;
  get diagnostics v_n_trx = row_count;

  delete from public.laporan_harian where periode_id = p_periode_id;
  get diagnostics v_n_laporan = row_count;

  delete from public.inventaris where periode_id = p_periode_id;
  get diagnostics v_n_inv = row_count;

  delete from public.opsi_kegiatan where periode_id = p_periode_id;
  get diagnostics v_n_opsi = row_count;

  return jsonb_build_object(
    'kendala_solusi', v_n_kendala,
    'kebutuhan', v_n_kebutuhan,
    'transaksi_keuangan', v_n_trx,
    'laporan_harian', v_n_laporan,
    'inventaris', v_n_inv,
    'opsi_kegiatan', v_n_opsi
  );
end;
$$;

revoke all on function public.admin_reset_periode_data(uuid) from public;
revoke all on function public.admin_reset_periode_data(uuid) from anon;
grant execute on function public.admin_reset_periode_data(uuid) to authenticated;

-- ---------- 2) RESTORE (merge idempoten) ----------
create or replace function public.admin_restore_backup(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  v_total jsonb := '{}'::jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang boleh memulihkan backup.'
      using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload backup tidak valid.' using errcode = '22023';
  end if;

  -- (a) Divisi yang belum ada.
  insert into public.divisi (id, nomor_divisi, nama_divisi)
  select
    (e->>'id')::uuid,
    (e->>'nomor_divisi')::integer,
    (e->>'nama_divisi')::text
  from jsonb_array_elements(coalesce(p_payload->'divisi', '[]'::jsonb)) e
  where coalesce(e->>'id','') <> ''
    and coalesce(e->>'nama_divisi','') <> ''
    and not exists (
      select 1 from public.divisi d
      where d.id = (e->>'id')::uuid or d.nomor_divisi = (e->>'nomor_divisi')::integer
    )
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total || jsonb_build_object('divisi', v_n);

  -- (b) Laporan harian (butuh divisi + periode yang sudah ada).
  insert into public.laporan_harian
    (id, divisi_id, periode_id, tanggal, kegiatan_hari_ini, informasi_lain, penerima_laporan, created_at)
  select
    (e->>'id')::uuid,
    (e->>'divisi_id')::uuid,
    (e->>'periode_id')::uuid,
    (e->>'tanggal')::date,
    coalesce(e->>'kegiatan_hari_ini', ''),
    e->>'informasi_lain',
    e->>'penerima_laporan',
    coalesce((e->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_payload->'laporan_harian', '[]'::jsonb)) e
  where coalesce(e->>'id','') <> ''
    and exists (select 1 from public.divisi d where d.id = (e->>'divisi_id')::uuid)
    and exists (select 1 from public.periods p where p.id = (e->>'periode_id')::uuid)
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total || jsonb_build_object('laporan_harian', v_n);

  -- (c) Transaksi keuangan.
  insert into public.transaksi_keuangan
    (id, divisi_id, periode_id, tanggal, jenis_transaksi, sumber_pemasukan, digunakan_untuk, keterangan, nominal, created_at)
  select
    (e->>'id')::uuid,
    (e->>'divisi_id')::uuid,
    (e->>'periode_id')::uuid,
    (e->>'tanggal')::date,
    case when e->>'jenis_transaksi' = 'pengeluaran' then 'pengeluaran'::text else 'pemasukan'::text end,
    e->>'sumber_pemasukan',
    e->>'digunakan_untuk',
    coalesce(e->>'keterangan', ''),
    coalesce((e->>'nominal')::numeric, 0),
    coalesce((e->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_payload->'transaksi_keuangan', '[]'::jsonb)) e
  where coalesce(e->>'id','') <> ''
    and exists (select 1 from public.divisi d where d.id = (e->>'divisi_id')::uuid)
    and exists (select 1 from public.periods p where p.id = (e->>'periode_id')::uuid)
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total || jsonb_build_object('transaksi_keuangan', v_n);

  -- (d) Inventaris.
  insert into public.inventaris (id, divisi_id, periode_id, nama_barang, jumlah, kondisi, keterangan)
  select
    (e->>'id')::uuid,
    (e->>'divisi_id')::uuid,
    (e->>'periode_id')::uuid,
    coalesce(e->>'nama_barang', ''),
    (e->>'jumlah')::integer,
    e->>'kondisi',
    e->>'keterangan'
  from jsonb_array_elements(coalesce(p_payload->'inventaris', '[]'::jsonb)) e
  where coalesce(e->>'id','') <> ''
    and exists (select 1 from public.divisi d where d.id = (e->>'divisi_id')::uuid)
    and exists (select 1 from public.periods p where p.id = (e->>'periode_id')::uuid)
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total || jsonb_build_object('inventaris', v_n);

  -- (e) Kendala & solusi (butuh laporan induk sudah ada).
  insert into public.kendala_solusi (id, laporan_id, periode_id, kendala, solusi)
  select
    (e->>'id')::uuid,
    (e->>'laporan_id')::uuid,
    (e->>'periode_id')::uuid,
    coalesce(e->>'kendala', ''),
    coalesce(e->>'solusi', '')
  from jsonb_array_elements(coalesce(p_payload->'kendala_solusi', '[]'::jsonb)) e
  where coalesce(e->>'id','') <> ''
    and exists (select 1 from public.laporan_harian l where l.id = (e->>'laporan_id')::uuid)
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total || jsonb_build_object('kendala_solusi', v_n);

  -- (f) Program kerja (metadata berkas).
  insert into public.program_kerja (id, divisi_id, periode_id, nama_program, deskripsi, file_name)
  select
    (e->>'id')::uuid,
    (e->>'divisi_id')::uuid,
    (e->>'periode_id')::uuid,
    e->>'nama_program',
    e->>'deskripsi',
    e->>'file_name'
  from jsonb_array_elements(coalesce(p_payload->'program_kerja', '[]'::jsonb)) e
  where coalesce(e->>'id','') <> ''
    and exists (select 1 from public.divisi d where d.id = (e->>'divisi_id')::uuid)
    and exists (select 1 from public.periods p where p.id = (e->>'periode_id')::uuid)
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total || jsonb_build_object('program_kerja', v_n);

  return v_total;
end;
$$;

revoke all on function public.admin_restore_backup(jsonb) from public;
revoke all on function public.admin_restore_backup(jsonb) from anon;
grant execute on function public.admin_restore_backup(jsonb) to authenticated;
