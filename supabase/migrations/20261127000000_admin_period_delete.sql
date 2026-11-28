create or replace function public.admin_period_delete(p_periode_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nama text;
  v_status text;
  v_n_kendala int := 0;
  v_n_pengajuan int := 0;
  v_n_kebutuhan int := 0;
  v_n_transaksi int := 0;
  v_n_laporan int := 0;
  v_n_anggota int := 0;
  v_n_inventaris int := 0;
  v_n_opsi int := 0;
  v_n_program int := 0;
  v_n_saldo int := 0;
  v_n_sesi int := 0;
  v_n_kredensial int := 0;
  v_n_penugasan int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat menghapus periode.'
      using errcode = '42501';
  end if;

  select p.nama_periode, p.status
    into v_nama, v_status
  from public.periods p
  where p.id = p_periode_id
  for update;

  if v_nama is null then
    raise exception 'Periode tidak ditemukan.' using errcode = '22023';
  end if;

  if v_status = 'active' then
    raise exception 'Periode aktif tidak dapat dihapus. Aktifkan periode lain terlebih dahulu.'
      using errcode = '22023';
  end if;

  if (select count(*) from public.periods pe) <= 1 then
    raise exception 'Minimal harus ada satu periode.' using errcode = '22023';
  end if;

  delete from public.kendala_solusi k where k.periode_id = p_periode_id;
  get diagnostics v_n_kendala = row_count;

  delete from public.pengajuan_dana pd where pd.periode_id = p_periode_id;
  get diagnostics v_n_pengajuan = row_count;

  delete from public.kebutuhan k where k.periode_id = p_periode_id;
  get diagnostics v_n_kebutuhan = row_count;

  delete from public.transaksi_keuangan t where t.periode_id = p_periode_id;
  get diagnostics v_n_transaksi = row_count;

  delete from public.laporan_harian l where l.periode_id = p_periode_id;
  get diagnostics v_n_laporan = row_count;

  delete from public.anggota_divisi a where a.periode_id = p_periode_id;
  get diagnostics v_n_anggota = row_count;

  delete from public.inventaris i where i.periode_id = p_periode_id;
  get diagnostics v_n_inventaris = row_count;

  delete from public.opsi_kegiatan o where o.periode_id = p_periode_id;
  get diagnostics v_n_opsi = row_count;

  delete from public.program_kerja pr where pr.periode_id = p_periode_id;
  get diagnostics v_n_program = row_count;

  delete from public.saldo_awal s where s.periode_id = p_periode_id;
  get diagnostics v_n_saldo = row_count;

  delete from public.division_sessions ds
  where ds.divisi_id in (
    select c.divisi_id
    from public.division_credentials c
    where c.periode_id = p_periode_id
  );
  get diagnostics v_n_sesi = row_count;

  delete from public.division_credentials c where c.periode_id = p_periode_id;
  get diagnostics v_n_kredensial = row_count;

  delete from public.admin_periods ap where ap.periode_id = p_periode_id;
  get diagnostics v_n_penugasan = row_count;

  update public.profiles pr
     set periode_id = null
   where pr.periode_id = p_periode_id;

  update public.divisi d
     set periode_id = null,
         periode = null
   where d.periode_id = p_periode_id
      or d.periode = v_nama;

  delete from public.periods p where p.id = p_periode_id;

  return jsonb_build_object(
    'periode', v_nama,
    'kendala_solusi', v_n_kendala,
    'pengajuan_dana', v_n_pengajuan,
    'kebutuhan', v_n_kebutuhan,
    'transaksi_keuangan', v_n_transaksi,
    'laporan_harian', v_n_laporan,
    'anggota_divisi', v_n_anggota,
    'inventaris', v_n_inventaris,
    'opsi_kegiatan', v_n_opsi,
    'program_kerja', v_n_program,
    'saldo_awal', v_n_saldo,
    'division_sessions', v_n_sesi,
    'division_credentials', v_n_kredensial,
    'admin_periods', v_n_penugasan
  );
end;
$$;

revoke all on function public.admin_period_delete(uuid) from public;
revoke all on function public.admin_period_delete(uuid) from anon;
grant execute on function public.admin_period_delete(uuid) to authenticated;
