-- =====================================================
-- APKOSIS - DIAGNOSTIK: "column reference periode_id is ambiguous"
--
-- Read-only. Tidak mengubah data apa pun.
-- Jalankan di Supabase Dashboard -> SQL Editor, lalu
-- salin SELURUH hasil Output ke chat.
-- =====================================================


-- =====================================================
-- A. FUNCTION di schema public yang memuat "periode_id"
--    TANPA alias tabel (komentar baris "--" ikut dibuang).
--    Inilah daftar kandidat yang bisa dipilih ambigu oleh
--    PostgreSQL saat statement dieksekusi.
-- =====================================================
select
  'FUNCTION' as jenis,
  p.proname as nama,
  pg_get_function_identity_arguments(p.oid) as argumen,
  p.oid::regprocedure::text as signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and regexp_replace(p.prosrc, '--.*$', '', 'g', 'n')
      ~ '(^|[^.[:alnum:]_])periode_id([^[:alnum:]_]|$)'
order by p.proname;


-- =====================================================
-- B. FUNCTION "bawaan repo" yang punya LEBIH DARI SATU
--    overload. PostgREST memilih overload berdasarkan nama
--    argumen, jadi overload liar bisa jadi penyebab.
-- =====================================================
select
  p.proname as nama,
  count(*) as jumlah_overload,
  string_agg(p.oid::regprocedure::text, ' | ' order by p.oid::regprocedure::text) as semua_signature
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_division_account_list','admin_accounts_list',
    'admin_division_credential_status','admin_division_account_save',
    'admin_set_division_password','admin_divisi_set_period',
    'division_period_id','verify_division_password','start_division_session',
    'assignAdminAction','admin_assign_period','admin_set_user_role',
    'current_role','is_super_admin','can_access_period','is_period_writable'
  )
group by p.proname
having count(*) > 1
order by p.proname;


-- =====================================================
-- C. POLICY yang memuat "periode_id" tanpa alias.
-- =====================================================
select
  schemaname, tablename, policyname,
  coalesce(qual, '') as using_expr,
  coalesce(with_check, '') as check_expr
from pg_policies
where schemaname = 'public'
  and (
    regexp_replace(coalesce(qual, ''), '--.*$', '', 'g', 'n')
        ~ '(^|[^.[:alnum:]_])periode_id([^[:alnum:]_]|$)'
    or regexp_replace(coalesce(with_check, ''), '--.*$', '', 'g', 'n')
        ~ '(^|[^.[:alnum:]_])periode_id([^[:alnum:]_]|$)'
  )
order by tablename, policyname;


-- =====================================================
-- D. TRIGGER yang menempel di tabel yang disentuh
--    admin_division_account_save (divisi + division_credentials).
-- =====================================================
select
  c.relname as tabel,
  t.tgname as trigger,
  t.tgisinternal,
  p.proname as fungsi
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'public'
  and c.relname in ('divisi', 'division_credentials', 'profiles', 'periods')
order by c.relname, t.tgname;


-- =====================================================
-- E. VIEW / MATERIALIZED VIEW di schema public
--    (view lama bisa menyimpan query ambigu).
-- =====================================================
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
  and table_type in ('VIEW', 'MATERIALIZED VIEW')
order by table_name;


-- =====================================================
-- F. STRUKTUR TABEL yang dipakai (bisa berubah di live DB)
-- =====================================================
select
  table_name,
  string_agg(
    column_name || ' ' || data_type ||
    case when is_nullable = 'NO' then ' NOT NULL' else '' end,
    ', ' order by ordinal_position
  ) as kolom
from information_schema.columns
where table_schema = 'public'
  and table_name in ('divisi', 'division_credentials', 'admin_periods', 'profiles')
group by table_name
order by table_name;


-- =====================================================
-- G. REPRODUKSI LANGSUNG.
--    Semua perintah dijalankan di dalam DO block, jadi satu
--    gagal TIDAK menghentikan yang lain. Ini yang paling
--    penting: baris "GAGAL" = fungsi yang salah.
-- =====================================================
do $$
declare
  q text;
begin
  foreach q in array array[
    'select count(*) from public.admin_division_account_list(null)',
    'select count(*) from public.admin_accounts_list(null)',
    'select count(*) from public.admin_division_credential_status(null)',
    'select count(*) from public.division_period_id(id) from public.divisi',
    'update public.divisi set periode_id = periode_id where false'
  ] loop
    begin
      execute q;
      raise notice 'OK    | %', q;
    exception when others then
      raise notice 'GAGAL | %  ==>  % (%)', q, sqlerrm, sqlstate;
    end;
  end loop;
end $$;


-- =====================================================
-- H. PETA KOLOM YANG DIPAKAI LOGIN (untuk cek password lama).
--   _plus_ pwd_sesuai_periode harus TRUE untuk divisi yang
--    dikonfigurasi.
-- =====================================================
select
  dv.nomor_divisi,
  dv.nama_divisi,
  dv.periode_id as periode_divisi,
  (select count(*) from public.division_credentials c where c.divisi_id = dv.id) as jumlah_kredensial,
  exists (
    select 1 from public.division_credentials c
    where c.divisi_id = dv.id
      and c.periode_id = coalesce(dv.periode_id, public.get_active_period_id())
  ) as pwd_sesuai_periode
from public.divisi dv
order by dv.nomor_divisi;