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
  v_now timestamptz := now();
  v_hash text;
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

  if not exists (select 1 from public.divisi d where d.id = p_divisi_id) then
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
    (select d.periode_id from public.divisi d where d.id = p_divisi_id),
    public.get_active_period_id()
  );

  if v_target is null then
    raise exception 'Periode belum ditentukan.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.periods pe where pe.id = v_target) then
    raise exception 'Periode tidak ditemukan.' using errcode = '22023';
  end if;

  if not v_is_super and not public.can_access_period(v_target) then
    raise exception 'Anda tidak mengelola periode ini.'
      using errcode = '42501';
  end if;

  if not public.is_period_writable(v_target) then
    raise exception 'Periode ini hanya bisa dibaca.'
      using errcode = '42501';
  end if;

  update public.divisi d
     set periode_id = v_target
   where d.id = p_divisi_id;

  v_hash := crypt(p_password, gen_salt('bf'));

  insert into public.division_credentials (
    divisi_id, periode_id, password_hash, updated_at, updated_by
  )
  values (
    p_divisi_id, v_target, v_hash, v_now, auth.uid()
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
       and c.password_hash = v_hash
  ) then
    raise exception 'Password gagal disimpan. Data lama tidak berubah.';
  end if;

  delete from public.division_sessions s where s.divisi_id = p_divisi_id;

  return query select true, v_target, v_now;
end;
$$;

create index if not exists division_sessions_divisi_id_idx
  on public.division_sessions (divisi_id);
