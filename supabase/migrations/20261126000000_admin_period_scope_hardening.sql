-- =====================================================
-- APKOSIS - Penguncaan hak Admin ke SATU periode penugasan
--
-- Sumber kebenaran: `profiles.periode_id` (diset oleh
-- `admin_assign_period`). `admin_periods` tetap dipertahankan
-- sebagai jejak penugasan/audit, tetapi bukan lagi sumber hak.
--
-- Tidak ada perubahan untuk Super Admin dan role lain.
-- Tidak ada penghapusan data. Aman dijalankan berulang kali.
-- =====================================================

-- Backfill HANYA profil Admin yang belum punya periode dan
-- penugasannya tidak ambigu. Tidak pernah menimpa nilai yang ada.
update public.profiles pr
   set periode_id = ap.periode_id
  from public.admin_periods ap
 where pr.id = ap.admin_id
   and pr.role = 'admin'
   and pr.periode_id is null
   and not exists (
     select 1
       from public.admin_periods ap2
      where ap2.admin_id = pr.id
        and ap2.periode_id <> ap.periode_id
   );


-- =====================================================
-- 1. HELPER PENUGASAN
-- =====================================================
create or replace function public.admin_has_period_assignment(p_periode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_periode_id is not null and exists (
    select 1
      from public.profiles pr
     where pr.id = auth.uid()
       and pr.role = 'admin'
       and pr.periode_id = p_periode_id
  ), false);
$$;

create or replace function public.admin_has_any_assignment()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles pr
     where pr.id = auth.uid()
       and pr.role = 'admin'
       and pr.periode_id is not null
  );
$$;


-- =====================================================
-- 2. AKSES & WRITABLE PERIODE
--    Role selain Admin sengaja dibiarkan sama persis.
-- =====================================================
create or replace function public.can_access_period(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then true
    when public.current_role() = 'admin' then
      p_period_id is not null
      and p_period_id = public.profile_period_id()
    when public.current_role() in ('monitoring', 'sekretaris', 'bendahara') then
      exists (
        select 1
          from public.periods pe
         where pe.id = p_period_id
           and pe.status in ('active', 'archived')
      )
    when public.current_role() = 'division_admin' then
      exists (
        select 1
          from public.periods pe
         where pe.id = p_period_id
           and pe.status in ('active', 'archived')
      )
    else false
  end;
$$;

create or replace function public.is_period_writable(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_period_id is null then false
    when public.is_super_admin() then true
    when public.current_role() = 'admin' then
      p_period_id = public.profile_period_id()
      and exists (
        select 1
          from public.periods pe
         where pe.id = p_period_id
           and pe.status = 'active'
      )
    else
      p_period_id = public.profile_period_id()
      and exists (
        select 1
          from public.periods pe
         where pe.id = p_period_id
           and pe.status = 'active'
      )
  end;
$$;


-- =====================================================
-- 3. RELASI DIVISI <-> PERIODE
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

  if public.current_role() = 'admin' then
    if p_periode_id is null or not public.can_access_period(p_periode_id) then
      raise exception 'Anda hanya dapat mengelola periode penugasan Anda.'
        using errcode = '42501';
    end if;

    -- Tidak boleh "membajak" divisi yang sudah terikat periode lain.
    if exists (
      select 1
        from public.divisi d
       where d.id = p_divisi_id
         and d.periode_id is not null
         and d.periode_id <> p_periode_id
    ) then
      raise exception 'Divisi ini sudah terikat ke periode lain.'
        using errcode = '42501';
    end if;
  end if;

  if p_periode_id is not null and not public.is_period_writable(p_periode_id) then
    raise exception 'Periode ini hanya bisa dibaca.' using errcode = '42501';
  end if;

  update public.divisi d
     set periode_id = p_periode_id
   where d.id = p_divisi_id;
end;
$$;


-- =====================================================
-- 4. DAFTAR AKUN DIVISI
--    Admin hanya melihat divisi pada periode penugasannya.
-- =====================================================
create or replace function public.admin_division_account_list(
  p_periode_id uuid default null
)
returns table (
  divisi_id uuid,
  nomor_divisi integer,
  nama_divisi text,
  account_count bigint,
  has_password boolean,
  updated_at timestamptz,
  periode_id uuid,
  periode_nama text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    dv.id,
    dv.nomor_divisi,
    dv.nama_divisi,
    (select count(*) from public.profiles pr where pr.divisi_id = dv.id),
    (dc.password_hash is not null),
    dc.updated_at,
    coalesce(p_periode_id, dv.periode_id, public.get_active_period_id()),
    pe.nama_periode
  from public.divisi dv
  left join public.division_credentials dc
    on dc.divisi_id = dv.id
   and dc.periode_id = coalesce(
         p_periode_id,
         dv.periode_id,
         public.get_active_period_id()
       )
  left join public.periods pe
    on pe.id = coalesce(
         p_periode_id,
         dv.periode_id,
         public.get_active_period_id()
       )
  where public.is_super_admin()
     or (
       public.current_role() = 'admin'
       and p_periode_id is not null
       and p_periode_id = public.profile_period_id()
       and (dv.periode_id is null or dv.periode_id = p_periode_id)
     )
  order by dv.nomor_divisi;
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
set search_path = public, extensions
as $$
  select
    dv.id,
    dv.nomor_divisi,
    dv.nama_divisi,
    (dc.password_hash is not null),
    dc.updated_at
  from public.divisi dv
  left join public.division_credentials dc
    on dc.divisi_id = dv.id
   and dc.periode_id = coalesce(
         p_periode_id,
         dv.periode_id,
         public.get_active_period_id()
       )
  where public.is_super_admin()
     or (
       public.current_role() = 'admin'
       and p_periode_id is not null
       and p_periode_id = public.profile_period_id()
       and (dv.periode_id is null or dv.periode_id = p_periode_id)
     )
  order by dv.nomor_divisi;
$$;


-- =====================================================
-- 5. SIMPAN AKUN DIVISI (ATOMIK)
--    Sama seperti 0006, ditambah guard divisi untuk Admin.
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
declare
  v_is_super boolean;
  v_target uuid;
  v_divisi_periode uuid;
  v_now timestamptz := now();
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  v_is_super := public.is_super_admin();

  if not (v_is_super or public.current_role() = 'admin') then
    raise exception 'Hanya Admin atau Super Admin yang dapat mengatur akun divisi.'
      using errcode = '42501';
  end if;

  if p_divisi_id is null then
    raise exception 'Divisi tidak valid.' using errcode = '22023';
  end if;

  select d.periode_id into v_divisi_periode
    from public.divisi d
   where d.id = p_divisi_id;

  if not found then
    raise exception 'Divisi tidak ditemukan.' using errcode = '22023';
  end if;

  if p_password is null or length(p_password) < 4 then
    raise exception 'Password divisi minimal 4 karakter.' using errcode = '22023';
  end if;

  if length(p_password) > 128 then
    raise exception 'Password divisi maksimal 128 karakter.' using errcode = '22023';
  end if;

  v_target := coalesce(
    p_periode_id,
    v_divisi_periode,
    public.get_active_period_id()
  );

  if v_target is null then
    raise exception 'Periode belum ditentukan.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.periods pe where pe.id = v_target) then
    raise exception 'Periode tidak ditemukan.' using errcode = '22023';
  end if;

  if not v_is_super then
    if v_target <> public.profile_period_id() then
      raise exception 'Anda hanya dapat mengelola periode penugasan Anda.'
        using errcode = '42501';
    end if;

    if v_divisi_periode is not null and v_divisi_periode <> v_target then
      raise exception 'Divisi ini sudah terikat ke periode lain.'
        using errcode = '42501';
    end if;
  end if;

  if not public.is_period_writable(v_target) then
    raise exception 'Periode ini hanya bisa dibaca.' using errcode = '42501';
  end if;

  update public.divisi d
     set periode_id = v_target
   where d.id = p_divisi_id;

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

  if not exists (
    select 1
      from public.division_credentials c
     where c.divisi_id = p_divisi_id
       and c.periode_id = v_target
       and crypt(p_password, c.password_hash) = c.password_hash
  ) then
    raise exception 'Password gagal disimpan. Data lama tidak berubah.';
  end if;

  delete from public.division_sessions s where s.divisi_id = p_divisi_id;

  return query select true, v_target, v_now;
end;
$$;


-- =====================================================
-- 6. RLS TABEL DIVISI
--    SELECT tetap mengizinkan arsip dibaca, tetapi INSERT/UPDATE/
--    DELETE ikut menolak periode yang tidak writable.
-- =====================================================
drop policy if exists "Divisi: admin period" on public.divisi;

create policy "Divisi: admin baca periode" on public.divisi
  for select using (
    public.current_role() = 'admin'
    and public.admin_has_period_assignment(periode_id)
  );

create policy "Divisi: admin tambah periode" on public.divisi
  for insert with check (
    public.current_role() = 'admin'
    and public.admin_has_period_assignment(periode_id)
    and public.is_period_writable(periode_id)
  );

create policy "Divisi: admin ubah periode" on public.divisi
  for update using (
    public.current_role() = 'admin'
    and public.admin_has_period_assignment(periode_id)
  )
  with check (
    public.current_role() = 'admin'
    and public.admin_has_period_assignment(periode_id)
    and public.is_period_writable(periode_id)
  );

create policy "Divisi: admin hapus periode" on public.divisi
  for delete using (
    public.current_role() = 'admin'
    and public.admin_has_period_assignment(periode_id)
    and public.is_period_writable(periode_id)
  );


-- =====================================================
-- 7. ACL
-- =====================================================
grant execute on function public.admin_has_period_assignment(uuid) to authenticated;
grant execute on function public.admin_has_any_assignment() to authenticated;
grant execute on function public.can_access_period(uuid) to authenticated;
grant execute on function public.is_period_writable(uuid) to authenticated;
grant execute on function public.admin_divisi_set_period(uuid, uuid) to authenticated;
grant execute on function public.admin_division_account_list(uuid) to authenticated;
grant execute on function public.admin_division_credential_status(uuid) to authenticated;
grant execute on function public.admin_division_account_save(uuid, text, uuid) to authenticated;
