create or replace function public.admin_fetch_backup_data(p_periode_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang boleh mengunduh backup.'
      using errcode = '42501';
  end if;

  if p_periode_id is null or not exists (
    select 1 from public.periods p where p.id = p_periode_id
  ) then
    raise exception 'Periode tidak ditemukan.' using errcode = '23502';
  end if;

  select jsonb_build_object(
    'divisi', coalesce((select jsonb_agg(to_jsonb(d)) from public.divisi d), '[]'::jsonb),
    'laporan_harian', coalesce((select jsonb_agg(to_jsonb(l)) from public.laporan_harian l where l.periode_id = p_periode_id), '[]'::jsonb),
    'transaksi_keuangan', coalesce((select jsonb_agg(to_jsonb(t)) from public.transaksi_keuangan t where t.periode_id = p_periode_id), '[]'::jsonb),
    'inventaris', coalesce((select jsonb_agg(to_jsonb(i)) from public.inventaris i where i.periode_id = p_periode_id), '[]'::jsonb),
    'kendala_solusi', coalesce((select jsonb_agg(to_jsonb(k)) from public.kendala_solusi k where k.periode_id = p_periode_id), '[]'::jsonb),
    'kebutuhan', coalesce((select jsonb_agg(to_jsonb(kb)) from public.kebutuhan kb where kb.periode_id = p_periode_id), '[]'::jsonb),
    'opsi_kegiatan', coalesce((select jsonb_agg(to_jsonb(o)) from public.opsi_kegiatan o where o.periode_id = p_periode_id), '[]'::jsonb),
    'program_kerja', coalesce((select jsonb_agg(to_jsonb(pk)) from public.program_kerja pk where pk.periode_id = p_periode_id), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_fetch_backup_data(uuid) from public;
revoke all on function public.admin_fetch_backup_data(uuid) from anon;
grant execute on function public.admin_fetch_backup_data(uuid) to authenticated;

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

  insert into public.kebutuhan
    (id, divisi_id, periode_id, laporan_id, nama_kebutuhan, jumlah, keterangan, status, tanggal, created_by, created_at)
  select
    (e->>'id')::uuid,
    (e->>'divisi_id')::uuid,
    (e->>'periode_id')::uuid,
    nullif(e->>'laporan_id', '')::uuid,
    coalesce(e->>'nama_kebutuhan', ''),
    nullif(e->>'jumlah', '')::integer,
    e->>'keterangan',
    case
      when e->>'status' in ('belum', 'disetujui', 'ditolak', 'sudah_dipenuhi')
        then e->>'status'
      else 'belum'
    end,
    coalesce((e->>'tanggal')::date, current_date),
    case
      when coalesce(e->>'created_by', '') <> ''
        and exists (
          select 1 from auth.users u
          where u.id = (e->>'created_by')::uuid
        )
        then (e->>'created_by')::uuid
      else null
    end,
    coalesce((e->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_payload->'kebutuhan', '[]'::jsonb)) e
  where coalesce(e->>'id','') <> ''
    and exists (select 1 from public.divisi d where d.id = (e->>'divisi_id')::uuid)
    and exists (select 1 from public.periods p where p.id = (e->>'periode_id')::uuid)
    and (
      coalesce(e->>'laporan_id', '') = ''
      or exists (
        select 1 from public.laporan_harian l
        where l.id = (e->>'laporan_id')::uuid
      )
    )
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total || jsonb_build_object('kebutuhan', v_n);

  insert into public.opsi_kegiatan (id, divisi_id, periode_id, nama_kegiatan, created_at)
  select
    (e->>'id')::uuid,
    (e->>'divisi_id')::uuid,
    (e->>'periode_id')::uuid,
    coalesce(e->>'nama_kegiatan', ''),
    coalesce((e->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_payload->'opsi_kegiatan', '[]'::jsonb)) e
  where coalesce(e->>'id','') <> ''
    and exists (select 1 from public.divisi d where d.id = (e->>'divisi_id')::uuid)
    and exists (select 1 from public.periods p where p.id = (e->>'periode_id')::uuid)
  on conflict (id) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total || jsonb_build_object('opsi_kegiatan', v_n);

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
