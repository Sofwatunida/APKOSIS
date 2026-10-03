-- =====================================================
-- APKOSIS - Phase 9 & 10: RLS, Authorization, Archived Enforcement
--
-- Prinsip:
--   1. Otorisasi SELALU mempertimbangkan role + periode, bukan role saja.
--   2. `super_admin` -> seluruh periode.
--      `admin`        -> hanya periode yang ditugaskan lewat admin_periods.
--      role lain      -> hanya periode aktif/arsip yang relevan.
--   3. Periode `archived` hanya bisa dibaca, kecuali oleh super_admin
--      (koreksi arsip) dan hanya pada tabel operasional.
--   4. Tidak ada operasi tulis tanpa `periode_id` yang valid.
-- =====================================================

-- =====================================================
-- 1. HELPER: ROLE DARI PROFILES
-- =====================================================
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- Admin SATU-SATUNYA bila ditugaskan pada periode tertentu.
-- `admin` tanpa penugasan tidak boleh mengelola apa pun.
-- Penting: p_period_id IS NULL harus menghasilkan FALSE. Kalau NULL
-- diperlakukan sebagai "cocok dengan semua periode", maka setiap akun
-- admin -- termasuk yang belum pernah ditugaskan -- akan lolos semua
-- policy yang memanggil fungsi ini.
create or replace function public.is_admin(p_period_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role = 'admin'
      and p_period_id is not null
      and exists (
        select 1 from public.admin_periods ap
        where ap.admin_id = p.id and ap.periode_id = p_period_id
      )
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

-- Periode milik profil ini (satu periode kerja untuk role operasional).
create or replace function public.profile_period_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.periode_id from public.profiles p where p.id = auth.uid();
$$;

-- Periode yang boleh dibuka user ini.
-- WAJIB spesifik: sebuah role hanya boleh membaca periode kerjanya.
-- Jangan pernah kembali ke versi "p_period_id is not null", karena itu
-- membuat bendahara/monitoring bisa membaca periode kepengurusan lain
-- hanya dengan mengetahui UUID-nya.
create or replace function public.can_access_period(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_role()
    when 'super_admin' then true
    -- Admin boleh pada beberapa periode sekaligus lewat admin_periods.
    when 'admin' then
      p_period_id is not null
      and exists (
        select 1 from public.admin_periods ap
        where ap.admin_id = auth.uid() and ap.periode_id = p_period_id
      )
    -- Role operasional: hanya periode kerja pada profilnya.
    when 'division_admin' then
      p_period_id is not null and p_period_id = public.profile_period_id()
    when 'monitoring' then
      p_period_id is not null and p_period_id = public.profile_period_id()
    when 'sekretaris' then
      p_period_id is not null and p_period_id = public.profile_period_id()
    when 'bendahara' then
      p_period_id is not null and p_period_id = public.profile_period_id()
    else false
  end;
$$;

-- Periode masih boleh ditulis? (Phase 10: archived = read only)
create or replace function public.is_period_writable(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_role()
    -- Super Admin boleh mengoreksi arsip bila benar-benar diperlukan.
    when 'super_admin' then p_period_id is not null
    when 'admin' then
      exists (
        select 1 from public.admin_periods ap
        join public.periods pe on pe.id = ap.periode_id
        where ap.admin_id = auth.uid()
          and ap.periode_id = p_period_id
          and pe.status = 'active'
      )
    else
      -- Hanya periode kerja sendiri, dan hanya yang masih aktif.
      p_period_id is not null
      and p_period_id = public.profile_period_id()
      and exists (
        select 1 from public.periods pe
        where pe.id = p_period_id and pe.status = 'active'
      )
  end;
$$;

-- =====================================================
-- 2. TRIGGER: BLOKIR TULIS KE PERIODE ARSIP (Phase 10)
-- =====================================================
-- Catatan penting: pada DELETE, `NEW` bernilai NULL, jadi status harus
-- dibaca dari `OLD`. Versi sebelumnya hanya membaca `new.periode_id`
-- sehingga trigger DELETE tidak pernah bekerja.
create or replace function public.guard_archived_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_periode_id := old.periode_id;
  else
    v_periode_id := new.periode_id;
  end if;

  -- Data tanpa periode tidak boleh lolos.
  if v_periode_id is null then
    raise exception 'periode_id wajib diisi.'
      using errcode = '23502';
  end if;

  select status into v_status from public.periods where id = v_periode_id;

  -- Periode belum aktif juga tidak bisa ditulis (kecuali super admin).
  if v_status is null then
    raise exception 'Periode tidak ditemukan.'
      using errcode = '23503';
  end if;

  if v_status = 'archived' and not public.is_super_admin() then
    raise exception 'Periode ini sudah diarsipkan dan hanya bisa dibaca. Hubungi Super Admin.'
      using errcode = '42501';
  end if;

  if v_status = 'inactive' and not public.is_super_admin() then
    raise exception 'Periode ini belum aktif.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Guard dipasang ulang di semua tabel operasional (Phase 10),
-- termasuk yang sebelumnya belum tercakup: kendala_solusi sudah ada,
-- saldo_awal ditambahkan di bawah.
do $$
declare
  t text;
begin
  foreach t in array array[
    'laporan_harian','transaksi_keuangan','kebutuhan','pengajuan_dana',
    'inventaris','program_kerja','anggota_divisi','opsi_kegiatan',
    'kendala_solusi','saldo_awal'
  ] loop
    execute format('drop trigger if exists trg_%s_archived_guard on public.%I', t, t);
    execute format(
      'create trigger trg_%s_archived_guard before insert or update or delete on public.%I
       for each row execute function public.guard_archived_period()', t, t);
  end loop;
end $$;

-- =====================================================
-- 3. SALDO AWAL: SATU BARIS PER PERIODE
-- =====================================================
-- Sebelumnya saldo awal memakai `id = 1` dengan check constraint
-- `id = 1`, sehingga semua periode saling menimpa. Sekarang unik
-- per periode dan kolom `id` dihapus.
do $$
declare
  v_active uuid;
begin
  select id into v_active from public.periods where status = 'active' limit 1;

  alter table public.saldo_awal add column if not exists periode_id uuid references public.periods(id);

  if v_active is not null then
    update public.saldo_awal set periode_id = v_active where periode_id is null;
  end if;

  -- Buang constraint single-row lama.
  alter table public.saldo_awal drop constraint if exists saldo_awal_single_row;
  alter table public.saldo_awal drop constraint if exists saldo_awal_pkey;

  -- Kolom `id` tidak lagi dipakai sebagai kunci.
  alter table public.saldo_awal drop column if exists id;

  alter table public.saldo_awal alter column periode_id set not null;
  alter table public.saldo_awal add primary key (periode_id);
end $$;

create index if not exists idx_saldo_awal_periode on public.saldo_awal(periode_id);

-- Policy lama yang mengizinkan semua user membaca saldo awal sudah
-- tidak aman (bisa mencampur periode), diganti pola umum di bawah.
drop policy if exists "SaldoAwal: select" on public.saldo_awal;
drop policy if exists "SaldoAwal: bendahara insert" on public.saldo_awal;
drop policy if exists "SaldoAwal: bendahara update" on public.saldo_awal;
drop policy if exists "SaldoAwal: bendahara delete" on public.saldo_awal;

-- =====================================================
-- 4. RLS: PROFILES
-- =====================================================
alter table public.profiles enable row level security;

-- Super Admin: semua. Admin: akun yang ditugaskan ke periodenya.
drop policy if exists "Profiles: super_admin all" on public.profiles;
create policy "Profiles: super_admin all" on public.profiles
  for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "Profiles: read own" on public.profiles;
create policy "Profiles: read own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "Profiles: admin read assigned" on public.profiles;
create policy "Profiles: admin read assigned" on public.profiles
  for select using (
    public.current_role() = 'admin'
    and exists (
      select 1 from public.admin_periods ap
      where ap.admin_id = auth.uid()
        and (ap.periode_id = profiles.periode_id or profiles.periode_id is null)
    )
  );

-- Tulis profil sendiri DILARANG lewat jalur ini: role dan periode_id
-- hanya boleh diubah lewat RPC admin_* yang sudah revocable.
drop policy if exists "Profiles: update own" on public.profiles;
create policy "Profiles: update own" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and periode_id is not distinct from (select p.periode_id from public.profiles p where p.id = auth.uid())
  );

-- =====================================================
-- 5. RLS: PERIODS & ADMIN_PERIODS
-- =====================================================
drop policy if exists "Periods: super_admin all" on public.periods;
create policy "Periods: super_admin all" on public.periods
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- Semua user login boleh melihat daftar periode supaya dropdown bisa
-- terisi; yang membatasi data adalah RLS tabel operasional.
drop policy if exists "Periods: read active and archived" on public.periods;
create policy "Periods: read active and archived" on public.periods
  for select using (auth.role() = 'authenticated');

-- Menambah/mengubah periode HANYA lewat RPC admin_period_* oleh super admin.
alter table public.periods enable row level security;

drop policy if exists "AdminPeriods: super_admin all" on public.admin_periods;
create policy "AdminPeriods: super_admin all" on public.admin_periods
  for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "AdminPeriods: read own" on public.admin_periods;
create policy "AdminPeriods: read own" on public.admin_periods
  for select using (admin_id = auth.uid());

-- =====================================================
-- 6. RLS TABEL OPERASIONAL: satu pola untuk semua tabel
-- =====================================================
-- Pembacaan: user boleh melihat baris dengan periode_id yang dia punya akses.
-- Penulisan: periode harus `active` (lihat juga trigger guard di atas).
do $$
declare
  t text;
begin
  foreach t in array array[
    'laporan_harian','transaksi_keuangan','kebutuhan','pengajuan_dana',
    'inventaris','program_kerja','anggota_divisi','opsi_kegiatan',
    'kendala_solusi','saldo_awal'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%I: read accessible period" on public.%I', t, t);
    execute format(
      'create policy "%I: read accessible period" on public.%I
       for select using (public.can_access_period(periode_id))', t, t);

    execute format('drop policy if exists "%I: insert writable period" on public.%I', t, t);
    execute format(
      'create policy "%I: insert writable period" on public.%I
       for insert with check (public.is_period_writable(periode_id))', t, t);

    execute format('drop policy if exists "%I: update writable period" on public.%I', t, t);
    execute format(
      'create policy "%I: update writable period" on public.%I
       for update using (public.is_period_writable(periode_id))
       with check (public.is_period_writable(periode_id))', t, t);

    execute format('drop policy if exists "%I: delete writable period" on public.%I', t, t);
    execute format(
      'create policy "%I: delete writable period" on public.%I
       for delete using (public.is_period_writable(periode_id))', t, t);
  end loop;
end $$;

-- =====================================================
-- 7. RLS: DIVISION_CREDENTIALS
-- =====================================================
-- Phase 8: kredensial divisi hanya boleh diatur Admin / Super Admin
-- lewat RPC. Policy insert/update/delete milik role divisi yang dulu ada
-- DIHAPUS supaya akun divisi tidak bisa mengganti passwordnya sendiri.
alter table public.division_credentials enable row level security;

drop policy if exists "Division credentials: admin divisi insert" on public.division_credentials;
drop policy if exists "Division credentials: admin divisi update" on public.division_credentials;
drop policy if exists "Division credentials: admin divisi delete" on public.division_credentials;
-- Policy lama dari migration sebelumnya juga dibersihkan.
drop policy if exists "DivisionCredentials: divisi write" on public.division_credentials;
drop policy if exists "DivisionCredentials: divisi read" on public.division_credentials;

drop policy if exists "DivisionCredentials: super_admin read" on public.division_credentials;
create policy "DivisionCredentials: super_admin read" on public.division_credentials
  for select using (public.is_super_admin());

drop policy if exists "DivisionCredentials: admin read own period" on public.division_credentials;
create policy "DivisionCredentials: admin read own period" on public.division_credentials
  for select using (
    public.current_role() = 'admin'
    and public.can_access_period(periode_id)
  );

-- =====================================================
-- 8. RPC: MANAJEMEN PERIODE (khusus super admin)
-- =====================================================
create or replace function public.admin_period_create(
  p_nama_periode text,
  p_tahun_mulai integer,
  p_tahun_selesai integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat membuat periode.'
      using errcode = '42501';
  end if;

  if p_tahun_selesai <> p_tahun_mulai + 1 then
    raise exception 'Tahun selesai harus satu tahun setelah tahun mulai.'
      using errcode = '22023';
  end if;

  insert into public.periods (nama_periode, tahun_mulai, tahun_selesai, status)
  values (p_nama_periode, p_tahun_mulai, p_tahun_selesai, 'inactive')
  returning id into v_id;

  return v_id;
end;
$$;

-- Mengaktifkan periode = mengarsipkan periode aktif lama, bukan reset.
create or replace function public.admin_period_activate(p_periode_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nama text;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat mengaktifkan periode.'
      using errcode = '42501';
  end if;

  select nama_periode into v_nama
  from public.periods
  where id = p_periode_id and status = 'inactive'
  for update;

  if v_nama is null then
    raise exception 'Periode tidak ditemukan atau bukan berstatus belum aktif.'
      using errcode = '22023';
  end if;

  update public.periods set status = 'archived'
  where status = 'active' and id <> p_periode_id;

  update public.periods set status = 'active' where id = p_periode_id;

  return v_nama;
end;
$$;

create or replace function public.admin_period_archive(p_periode_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nama text;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat mengarsipkan periode.'
      using errcode = '42501';
  end if;

  select nama_periode into v_nama from public.periods where id = p_periode_id for update;
  if v_nama is null then
    raise exception 'Periode tidak ditemukan.' using errcode = '22023';
  end if;

  -- Tidak ada periode aktif tersisa tanpa periode aktif baru.
  if not exists (select 1 from public.periods where id <> p_periode_id and status = 'active') then
    raise exception 'Minimal harus ada satu periode aktif.'
      using errcode = '22023';
  end if;

  update public.periods set status = 'archived' where id = p_periode_id;
  return v_nama;
end;
$$;

create or replace function public.admin_period_update(
  p_periode_id uuid,
  p_nama_periode text default null,
  p_tahun_mulai integer default null,
  p_tahun_selesai integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat mengubah periode.'
      using errcode = '42501';
  end if;

  update public.periods
  set nama_periode = coalesce(p_nama_periode, nama_periode),
      tahun_mulai = coalesce(p_tahun_mulai, tahun_mulai),
      tahun_selesai = coalesce(p_tahun_selesai, tahun_selesai)
  where id = p_periode_id;
end;
$$;

-- Ringkasan periode + jumlah data, untuk halaman Super Admin.
create or replace function public.admin_period_list_all()
returns table (
  id uuid,
  nama_periode text,
  tahun_mulai integer,
  tahun_selesai integer,
  status text,
  jumlah_laporan bigint,
  jumlah_transaksi bigint,
  jumlah_anggota bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pe.id,
    pe.nama_periode,
    pe.tahun_mulai,
    pe.tahun_selesai,
    pe.status,
    (select count(*) from public.laporan_harian lh where lh.periode_id = pe.id),
    (select count(*) from public.transaksi_keuangan tk where tk.periode_id = pe.id),
    (select count(*) from public.anggota_divisi ad where ad.periode_id = pe.id),
    pe.created_at
  from public.periods pe
  where public.is_super_admin()
  order by pe.tahun_mulai desc;
$$;

-- =====================================================
-- 9. RPC: MANAJEMEN AKUN
-- =====================================================
create or replace function public.admin_accounts_list(p_periode_id uuid default null)
returns table (
  id uuid,
  nama text,
  email text,
  role text,
  periode_id uuid,
  assigned_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pr.id,
    pr.nama,
    pr.email,
    pr.role,
    ap.periode_id,
    ap.assigned_at
  from public.profiles pr
  left join public.admin_periods ap on ap.admin_id = pr.id
  where public.is_super_admin()
    and (p_periode_id is null or ap.periode_id = p_periode_id)
  order by pr.nama nulls last;
$$;

-- Admin = pengguna yang diberi tugas pada periode tertentu.
create or replace function public.admin_assign_period(
  p_user_id uuid,
  p_periode_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat menetapkan Admin periode.'
      using errcode = '42501';
  end if;

  -- Super Admin tidak boleh kehilangan kontrol sistem lewat jalur ini.
  if exists (select 1 from public.profiles where id = p_user_id and role = 'super_admin') then
    if p_periode_id is not null then
      raise exception 'Super Admin tidak dapat ditugaskan sebagai Admin periode.'
        using errcode = '42501';
    end if;
  end if;

  delete from public.admin_periods where admin_id = p_user_id;

  if p_periode_id is null then
    update public.profiles set periode_id = null where id = p_user_id;
    return;
  end if;

  insert into public.admin_periods (admin_id, periode_id, assigned_by)
  values (p_user_id, p_periode_id, auth.uid());

  update public.profiles set periode_id = p_periode_id where id = p_user_id;
end;
$$;

-- Hanya Super Admin yang boleh mengubah role, dan tidak bolehilege
-- dari role 'admin' biasa. Menjaga aturan 5E (Admin tidak dapat
-- mengambil alih Super Admin).
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_role text;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang dapat mengubah role.'
      using errcode = '42501';
  end if;

  if p_role not in ('super_admin','admin','division_admin','monitoring','sekretaris','bendahara') then
    raise exception 'Role tidak dikenal.' using errcode = '22023';
  end if;

  select role into v_old_role from public.profiles where id = p_user_id for update;
  if v_old_role is null then
    raise exception 'Pengguna tidak ditemukan.' using errcode = '22023';
  end if;

  -- Melindungi akun Super Admin dari being nonaktifkan oleh Super Admin
  -- lain tanpa sengaja: harus ada minimal satu Super Admin aktif.
  if v_old_role = 'super_admin' and p_role <> 'super_admin' then
    if (select count(*) from public.profiles where role = 'super_admin') <= 1 then
      raise exception 'Minimal harus ada satu akun Super Admin.'
        using errcode = '42501';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  -- Admin yang kehilangan role admin harus kehilangan periodenya juga.
  if p_role <> 'admin' then
    delete from public.admin_periods where admin_id = p_user_id;
    update public.profiles set periode_id = null where id = p_user_id;
  end if;
end;
$$;

-- =====================================================
-- 10. RPC: KREDENSIAL DIVISI (Phase 8)
-- =====================================================
-- Hanya Admin (periode ditugaskan) dan Super Admin. Role divisi TIDAK
-- boleh memanggil fungsi ini sama sekali.
create or replace function public.admin_set_division_password(
  p_divisi_id uuid,
  p_password text,
  p_periode_id uuid default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode_id uuid;
  v_written_at timestamptz := now();
begin
  if not (public.is_super_admin() or public.current_role() = 'admin') then
    raise exception 'Hanya Admin atau Super Admin yang dapat mengatur password divisi.'
      using errcode = '42501';
  end if;

  if coalesce(length(p_password), 0) < 4 then
    raise exception 'Password divisi minimal 4 karakter.' using errcode = '22023';
  end if;

  v_periode_id := coalesce(p_periode_id, public.get_active_period_id());
  if v_periode_id is null then
    raise exception 'Periode belum ditentukan.' using errcode = '22023';
  end if;

  if not public.is_period_writable(v_periode_id) then
    raise exception 'Periode ini hanya bisa dibaca.'
      using errcode = '42501';
  end if;

  -- Password tidak pernah disimpan plaintext.
  insert into public.division_credentials (divisi_id, periode_id, password_hash, updated_at, updated_by)
  values (p_divisi_id, v_periode_id, crypt(p_password, gen_salt('bf')), v_written_at, auth.uid())
  on conflict (divisi_id, periode_id)
  do update set password_hash = excluded.password_hash,
                updated_at = v_written_at,
                updated_by = excluded.updated_by;

  -- Akhiri sesi divisi agar password baru langsung berlaku.
  update public.division_sessions
  set expires_at = v_written_at
  where divisi_id = p_divisi_id
    and expires_at > v_written_at;

  return v_written_at;
end;
$$;

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
set search_path = public
as $$
  -- Admin WAJIB menyebut periodenya. Tanpa itu, admin yang belum
  -- ditugaskan pun bisa membaca status kredensial seluruh periode.
  select
    dc.divisi_id,
    dv.nomor_divisi,
    dv.nama_divisi,
    dc.password_hash is not null,
    dc.updated_at
  from public.division_credentials dc
  join public.divisi dv on dv.id = dc.divisi_id
  where public.is_super_admin()
    or (
      public.current_role() = 'admin'
      and p_periode_id is not null
      and public.can_access_period(p_periode_id)
      and dc.periode_id = p_periode_id
    )
  order by dv.nomor_divisi;
$$;

create or replace function public.admin_division_account_list(
  p_periode_id uuid default null
)
returns table (
  divisi_id uuid,
  nomor_divisi integer,
  nama_divisi text,
  account_count bigint,
  has_password boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  -- Sama seperti credential_status: admin tidak boleh melihat daftar
  -- divisi tanpa batas periode.
  select
    dv.id,
    dv.nomor_divisi,
    dv.nama_divisi,
    (select count(*) from public.profiles pr where pr.divisi_id = dv.id),
    (dc.password_hash is not null),
    dc.updated_at
  from public.divisi dv
  left join public.division_credentials dc
    on dc.divisi_id = dv.id
   and dc.periode_id = p_periode_id
  where public.is_super_admin()
    or (
      public.current_role() = 'admin'
      and p_periode_id is not null
      and public.can_access_period(p_periode_id)
    )
  order by dv.nomor_divisi;
$$;

-- =====================================================
-- 11. RPC: HUBUNGAN DIVISI <-> PERIODE
-- =====================================================
create or replace function public.admin_divisi_set_period(
  p_divisi_id uuid,
  p_periode_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_super_admin() or public.current_role() = 'admin') then
    raise exception 'Tidak punya izin.' using errcode = '42501';
  end if;

  -- Admin hanya boleh memindahkan divisi yang belum terikat ke periode
  -- lain. Tanpa cek ini, Admin periode 2027/2028 bisa "mencuri" divisi
  -- yang masih dipakai kepengurusan 2026/2027.
  if public.current_role() = 'admin' and exists (
    select 1
    from public.divisi d
    where d.id = p_divisi_id
      and d.periode_id is not null
      and not exists (
        select 1
        from public.admin_periods ap
        where ap.admin_id = auth.uid() and ap.periode_id = d.periode_id
      )
  ) then
    raise exception 'Divisi ini sudah terikat ke periode lain.'
      using errcode = '42501';
  end if;

  if p_periode_id is not null and not public.is_period_writable(p_periode_id) then
    raise exception 'Periode ini hanya bisa dibaca.' using errcode = '42501';
  end if;

  update public.divisi set periode_id = p_periode_id where id = p_divisi_id;
end;
$$;

-- =====================================================
-- 12. NONAKTIFKAN FUNGSI LAMA YANG BERBAHAYA
-- =====================================================
-- `set_division_password` dulu bisa dipakai role divisi. Sekarang
-- kebutuhan itu ditangani `admin_set_division_password` di atas.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_division_password'
  ) then
    execute 'revoke all on function public.set_division_password(uuid, text) from authenticated';
  end if;
end $$;

-- =====================================================
-- 13. ACL: RPC administrative HANYA untuk authenticated,
--     dan tetap diperiksa di dalam fungsi (definer + guard).
-- =====================================================
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_period_create','admin_period_activate','admin_period_archive',
        'admin_period_update','admin_period_list_all','admin_accounts_list',
        'admin_assign_period','admin_set_user_role','admin_set_division_password',
        'admin_division_credential_status','admin_division_account_list',
        'admin_divisi_set_period','current_role','can_access_period',
        'is_period_writable','is_admin','profile_period_id'
      )
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
