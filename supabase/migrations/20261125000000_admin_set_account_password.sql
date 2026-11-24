-- ============================================================
-- Super Admin: Ubah Password Akun Role (Supabase Auth)
-- ============================================================
-- Mengganti password akun personal/role (admin, monitoring,
-- sekretaris, bendahara, division_admin) dari halaman
-- "Pengelolaan Akun & Divisi".
--
-- Alasan memakai SECURITY DEFINER RPC (bukan service_role key di app):
--   - Tidak bergantung pada SUPABASE_SERVICE_ROLE_KEY di environment
--     aplikasi/Vercel.
--   - Otorisasi dijalankan di database (is_super_admin), tidak bisa
--     dilewati dari client.
--   - Password di-hash bcrypt via pgcrypto; plaintext tidak disimpan.
--
-- Idempoten: create or replace function aman dijalankan berulang.

create or replace function public.admin_set_account_password(
  p_user_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target_role text;
  v_hash text;
begin
  perform set_config('search_path', public.division_crypto_search_path(), true);

  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang boleh mengubah password akun.'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'Akun tidak valid.'
      using errcode = '22023';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Password akun sendiri tidak dapat diubah dari halaman ini.'
      using errcode = '22023';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'Password akun minimal 8 karakter.'
      using errcode = '22023';
  end if;

  if length(p_password) > 128 then
    raise exception 'Password akun maksimal 128 karakter.'
      using errcode = '22023';
  end if;

  if p_password !~ '[A-Za-z]' or p_password !~ '[0-9]' then
    raise exception 'Password akun harus memiliki kombinasi huruf dan angka.'
      using errcode = '22023';
  end if;

  select p.role::text
    into v_target_role
    from public.profiles p
   where p.id = p_user_id;

  if not found then
    raise exception 'Akun tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  if v_target_role = 'super_admin' then
    raise exception 'Password akun Super Admin tidak dapat diubah dari halaman ini.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Akun tidak ditemukan di layanan autentikasi.'
      using errcode = 'P0002';
  end if;

  v_hash := crypt(p_password, gen_salt('bf'));

  update auth.users
     set encrypted_password = v_hash,
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'Akun tidak ditemukan di layanan autentikasi.'
      using errcode = 'P0002';
  end if;

  -- Cabut sesi/refresh token agar password lama tidak tetap berlaku.
  delete from auth.sessions where user_id = p_user_id;
  begin
    delete from auth.refresh_tokens where user_id = p_user_id::text;
  exception
    when undefined_table or undefined_column then
      null;
  end;
end;
$$;

revoke all on function public.admin_set_account_password(uuid, text) from public;
revoke all on function public.admin_set_account_password(uuid, text) from anon;
grant execute on function public.admin_set_account_password(uuid, text) to authenticated;
