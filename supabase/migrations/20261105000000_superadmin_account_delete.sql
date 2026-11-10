-- ============================================================
-- Super Admin: Hapus Akun
-- ============================================================
-- Menghapus akun dari halaman "Pengelolaan Akun & Divisi".
--
-- Baris `profiles.id` mereferensikan `auth.users.id` dengan
-- ON DELETE CASCADE, jadi menghapus user Auth sekaligus menghapus
-- profilnya. Operasi ini hanya boleh dilakukan Super Admin dan
-- tidak boleh menghapus akun yang sedang dipakai.
--
-- Idempoten: `create or replace function` aman dijalankan berulang.

create or replace function public.admin_account_delete(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Hanya Super Admin yang boleh menghapus akun.'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'Akun tidak valid.'
      using errcode = '22023';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Anda tidak boleh menghapus akun Anda sendiri.'
      using errcode = '22023';
  end if;

  delete from auth.users where id = p_user_id;

  if not found then
    raise exception 'Akun tidak ditemukan.'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_account_delete(uuid) from public;
revoke all on function public.admin_account_delete(uuid) from anon;
grant execute on function public.admin_account_delete(uuid) to authenticated;
