-- =====================================================
-- APKOSIS - Perbaikan RLS & Penyimpanan Saldo Awal
--
-- Masalah yang diperbaiki:
--   1. Bendahara gagal menyimpan saldo awal dengan
--      "new row violates row-level security policy for table saldo_awal".
--      Penyebabnya: policy INSERT/UPDATE memakai `is_period_writable()`
--      yang mensyaratkan `profiles.periode_id` SAMA dengan periode terpilih.
--      Akun Bendahara yang dibuat setelah backfill punya periode_id NULL,
--      sehingga SEMUA penyimpanan ditolak meskipun periode aktif.
--   2. Monitoring tidak bisa membaca saldo awal pada periode terpilih bila
--      profiles.periode_id NULL / berbeda.
--   3. Struktur tabel bisa tertinggal dari kode (kolom `id` hilang / masih
--      integer single-row) sehingga query `.select("id")` gagal.
--
-- Prinsip:
--   - RLS TETAP AKTIF. Tidak ada service_role di frontend.
--   - Bendahara hanya boleh MENULIS pada periode yang berstatus `active`.
--   - Super Admin boleh mengoreksi semua periode (termasuk arsip).
--   - Monitoring/Sekretaris/Bendahara boleh MEMBACA saldo awal; UI tetap
--     membatasi ke periode yang sedang dipilih lewat period-scope.
--   - Tidak ada perubahan pada tabel transaksi/pemasukan/pengeluaran.
-- =====================================================

-- =====================================================
-- 1. STRUKTUR TABEL: pastikan kolom yang dipakai aplikasi ada
-- =====================================================
do $$
declare
  v_id_type text;
begin
  alter table public.saldo_awal
    add column if not exists periode_id uuid references public.periods(id);

  alter table public.saldo_awal
    add column if not exists divisi_id uuid references public.divisi(id) on delete cascade;

  select c.data_type
    into v_id_type
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'saldo_awal'
     and c.column_name = 'id';

  if v_id_type is null then
    -- Tabel lama dari 20261001000002: `id` sudah dihapus.
    alter table public.saldo_awal
      add column id uuid not null default gen_random_uuid();
  elsif v_id_type <> 'uuid' then
    -- Tabel lama dari 20260103000000: `id integer` + check id = 1.
    alter table public.saldo_awal drop constraint if exists saldo_awal_single_row;
    alter table public.saldo_awal drop constraint if exists saldo_awal_pkey;
    alter table public.saldo_awal drop column id;
    alter table public.saldo_awal
      add column id uuid not null default gen_random_uuid();
  end if;

  -- Backfill periode untuk baris lama.
  update public.saldo_awal
     set periode_id = (
       select p.id from public.periods p
        where p.status = 'active'
        order by p.tahun_mulai desc
        limit 1
     )
   where periode_id is null;

  update public.saldo_awal
     set periode_id = (
       select p.id from public.periods p
        order by p.tahun_mulai desc
        limit 1
     )
   where periode_id is null;

  if exists (select 1 from public.saldo_awal where periode_id is null) then
    raise exception 'saldo_awal memiliki baris tanpa periode dan tabel periods kosong.';
  end if;

  alter table public.saldo_awal drop constraint if exists saldo_awal_pkey;
  alter table public.saldo_awal add primary key (id);

  alter table public.saldo_awal alter column periode_id set not null;
  alter table public.saldo_awal alter column nominal set not null;
end $$;

-- =====================================================
-- 2. BERSIHKAN DUPLIKAT SEBELUM MEMASANG UNIQUE INDEX
--    (pertahankan baris terbaru per periode + tujuan)
-- =====================================================
with ranked as (
  select id,
         row_number() over (
           partition by periode_id, divisi_id
           order by updated_at desc nulls last, id desc
         ) as rn
    from public.saldo_awal
)
delete from public.saldo_awal s
 using ranked r
 where s.id = r.id
   and r.rn > 1;

create unique index if not exists saldo_awal_periode_global_uniq
  on public.saldo_awal(periode_id)
  where divisi_id is null;

create unique index if not exists saldo_awal_periode_divisi_uniq
  on public.saldo_awal(periode_id, divisi_id)
  where divisi_id is not null;

create index if not exists idx_saldo_awal_periode
  on public.saldo_awal(periode_id);

create index if not exists idx_saldo_awal_divisi
  on public.saldo_awal(divisi_id);

-- =====================================================
-- 3. VALIDASI NOMINAL DI DATABASE
-- =====================================================
alter table public.saldo_awal
  drop constraint if exists saldo_awal_nominal_nonnegative;
alter table public.saldo_awal
  add constraint saldo_awal_nominal_nonnegative check (nominal >= 0);

-- =====================================================
-- 4. HELPER OTORISASI TULIS SALDO AWAL
--    Security definer supaya tidak bergantung RLS tabel periods.
-- =====================================================
create or replace function public.saldo_awal_writable(p_periode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_role()
    when 'super_admin' then p_periode_id is not null
    when 'bendahara' then
      p_periode_id is not null
      and exists (
        select 1 from public.periods pe
        where pe.id = p_periode_id
          and pe.status = 'active'
      )
    else false
  end;
$$;

revoke all on function public.saldo_awal_writable(uuid) from public, anon;
grant execute on function public.saldo_awal_writable(uuid) to authenticated;

-- =====================================================
-- 5. RLS SALDO AWAL
-- =====================================================
alter table public.saldo_awal enable row level security;

-- Bersihkan SEMUA policy lama (nama berbeda antar migration).
drop policy if exists "SaldoAwal: select" on public.saldo_awal;
drop policy if exists "SaldoAwal: bendahara insert" on public.saldo_awal;
drop policy if exists "SaldoAwal: bendahara update" on public.saldo_awal;
drop policy if exists "SaldoAwal: bendahara delete" on public.saldo_awal;
drop policy if exists "saldo_awal: read accessible period" on public.saldo_awal;
drop policy if exists "saldo_awal: insert writable period" on public.saldo_awal;
drop policy if exists "saldo_awal: update writable period" on public.saldo_awal;
drop policy if exists "saldo_awal: delete writable period" on public.saldo_awal;
drop policy if exists "saldo_awal: read visible" on public.saldo_awal;
drop policy if exists "saldo_awal: insert bendahara active" on public.saldo_awal;
drop policy if exists "saldo_awal: update bendahara active" on public.saldo_awal;
drop policy if exists "saldo_awal: delete bendahara active" on public.saldo_awal;

-- SELECT:
--   - Super Admin: semua periode.
--   - Bendahara/Monitoring/Sekretaris: boleh membaca saldo awal; period-scope
--     aplikasi tetap membatasi tampilan ke periode yang dipilih.
--   - Admin/Division Admin: hanya periode yang boleh mereka akses.
create policy "saldo_awal: read visible" on public.saldo_awal
  for select using (
    public.is_super_admin()
    or public.current_role() in ('bendahara', 'monitoring', 'sekretaris')
    or public.can_access_period(periode_id)
  );

-- INSERT/UPDATE/DELETE:
--   - Bendahara hanya pada periode yang masih `active`.
--   - Super Admin boleh koreksi (termasuk arsip).
--   - Monitoring dan role lain TIDAK punya policy tulis.
create policy "saldo_awal: insert bendahara active" on public.saldo_awal
  for insert with check (public.saldo_awal_writable(periode_id));

create policy "saldo_awal: update bendahara active" on public.saldo_awal
  for update using (public.saldo_awal_writable(periode_id))
            with check (public.saldo_awal_writable(periode_id));

create policy "saldo_awal: delete bendahara active" on public.saldo_awal
  for delete using (public.saldo_awal_writable(periode_id));

-- Pastikan hak tabel ada; RLS tetap yang menentukan baris.
grant select, insert, update, delete on public.saldo_awal to authenticated;

-- =====================================================
-- 6. RELOAD SCHEMA CACHE POSTGREST
-- =====================================================
notify pgrst, 'reload schema';
