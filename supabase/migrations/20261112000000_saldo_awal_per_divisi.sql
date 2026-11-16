-- =====================================================
-- APKOSIS - Saldo Awal per Divisi per Periode
--
-- Memperluas tabel `saldo_awal` yang sudah ada (tanpa membuat
-- tabel/kolom duplikat) supaya setiap divisi memiliki saldo awal
-- sendiri pada tiap periode.
--
-- Baris lama yang belum punya `divisi_id` dipertahankan sebagai
-- saldo awal umum/fallback agar data historis tidak hilang.
-- =====================================================

-- 1. Kolom divisi + kunci surrogate.
alter table public.saldo_awal
  add column if not exists divisi_id uuid references public.divisi(id) on delete cascade;

alter table public.saldo_awal
  add column if not exists id uuid not null default gen_random_uuid();

-- Ganti primary key (periode_id) menjadi (id) agar satu periode boleh
-- memiliki banyak baris: satu per divisi + satu baris umum lama.
do $$
begin
  alter table public.saldo_awal drop constraint if exists saldo_awal_pkey;
  alter table public.saldo_awal add primary key (id);
end $$;

-- 2. Keunikan: satu baris umum per periode dan satu baris per divisi.
create unique index if not exists saldo_awal_periode_global_uniq
  on public.saldo_awal(periode_id)
  where divisi_id is null;

create unique index if not exists saldo_awal_periode_divisi_uniq
  on public.saldo_awal(periode_id, divisi_id)
  where divisi_id is not null;

create index if not exists idx_saldo_awal_divisi
  on public.saldo_awal(divisi_id);

-- 3. Hak tulis: hanya Bendahara (dan Super Admin untuk koreksi).
--    Policy generik dari migration periode diganti versi yang lebih ketat.
drop policy if exists "saldo_awal: insert writable period" on public.saldo_awal;
create policy "saldo_awal: insert writable period" on public.saldo_awal
  for insert with check (
    public.is_period_writable(periode_id)
    and public.current_role() in ('bendahara', 'super_admin')
  );

drop policy if exists "saldo_awal: update writable period" on public.saldo_awal;
create policy "saldo_awal: update writable period" on public.saldo_awal
  for update using (
    public.is_period_writable(periode_id)
    and public.current_role() in ('bendahara', 'super_admin')
  ) with check (
    public.is_period_writable(periode_id)
    and public.current_role() in ('bendahara', 'super_admin')
  );

drop policy if exists "saldo_awal: delete writable period" on public.saldo_awal;
create policy "saldo_awal: delete writable period" on public.saldo_awal
  for delete using (
    public.is_period_writable(periode_id)
    and public.current_role() in ('bendahara', 'super_admin')
  );
