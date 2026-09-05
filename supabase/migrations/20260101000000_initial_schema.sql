-- =====================================================
-- APKOSIS - Aplikasi Laporan Harian OSIS
-- Migration: Full Schema + RLS + Seed
-- Jalankan file ini di Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. TYPE helpers
-- =====================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================
-- 2. TABLE divisi
-- =====================================================
create table if not exists public.divisi (
  id uuid primary key default gen_random_uuid(),
  nomor_divisi integer unique not null,
  nama_divisi text not null,
  ketua_divisi text,
  wakil_divisi text,
  periode text,
  deskripsi text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_divisi_updated_at on public.divisi;
create trigger trg_divisi_updated_at
  before update on public.divisi
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 3. TABLE profiles
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  email text,
  role text check (role in ('division_admin','monitoring','sekretaris','bendahara')),
  divisi_id uuid references public.divisi(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

-- =====================================================
-- 4. TABLE anggota_divisi
-- =====================================================
create table if not exists public.anggota_divisi (
  id uuid primary key default gen_random_uuid(),
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  nama text not null,
  jabatan text,
  status text not null default 'aktif',
  tanggal_masuk date,
  tanggal_keluar date,
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anggota_status_check check (status in ('aktif','nonaktif'))
);

create index if not exists idx_anggota_divisi_id on public.anggota_divisi(divisi_id);

drop trigger if exists trg_anggota_updated_at on public.anggota_divisi;
create trigger trg_anggota_updated_at
  before update on public.anggota_divisi
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 5. TABLE program_kerja
-- =====================================================
create table if not exists public.program_kerja (
  id uuid primary key default gen_random_uuid(),
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  nama_program text,
  deskripsi text,
  file_name text,
  file_path text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_program_kerja_divisi_id on public.program_kerja(divisi_id);

drop trigger if exists trg_program_updated_at on public.program_kerja;
create trigger trg_program_updated_at
  before update on public.program_kerja
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 6. TABLE laporan_harian
-- =====================================================
create table if not exists public.laporan_harian (
  id uuid primary key default gen_random_uuid(),
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  tanggal date not null,
  pelapor_id uuid references public.anggota_divisi(id),
  kegiatan_hari_ini text not null,
  informasi_lain text,
  penerima_laporan text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint laporan_unique_divisi_tanggal unique (divisi_id, tanggal)
);

create index if not exists idx_laporan_divisi_id on public.laporan_harian(divisi_id);
create index if not exists idx_laporan_tanggal on public.laporan_harian(tanggal);
create index if not exists idx_laporan_created_by on public.laporan_harian(created_by);

drop trigger if exists trg_laporan_updated_at on public.laporan_harian;
create trigger trg_laporan_updated_at
  before update on public.laporan_harian
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 7. TABLE kendala_solusi
-- =====================================================
create table if not exists public.kendala_solusi (
  id uuid primary key default gen_random_uuid(),
  laporan_id uuid not null references public.laporan_harian(id) on delete cascade,
  kendala text not null,
  solusi text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kendala_laporan_id on public.kendala_solusi(laporan_id);

drop trigger if exists trg_kendala_updated_at on public.kendala_solusi;
create trigger trg_kendala_updated_at
  before update on public.kendala_solusi
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 8. TABLE inventaris
-- =====================================================
create table if not exists public.inventaris (
  id uuid primary key default gen_random_uuid(),
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  nama_barang text not null,
  jumlah integer,
  kondisi text check (kondisi in ('baik','rusak_ringan','rusak_berat','hilang')),
  keterangan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventaris_divisi_id on public.inventaris(divisi_id);

drop trigger if exists trg_inventaris_updated_at on public.inventaris;
create trigger trg_inventaris_updated_at
  before update on public.inventaris
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 9. TABLE kebutuhan
-- =====================================================
create table if not exists public.kebutuhan (
  id uuid primary key default gen_random_uuid(),
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  laporan_id uuid references public.laporan_harian(id) on delete set null,
  nama_kebutuhan text not null,
  jumlah integer,
  keterangan text,
  status_pembelian text not null default 'belum_dibeli'
    check (status_pembelian in ('belum_dibeli','sudah_dibeli','tidak_dibeli')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kebutuhan_divisi_id on public.kebutuhan(divisi_id);
create index if not exists idx_kebutuhan_status on public.kebutuhan(status_pembelian);

drop trigger if exists trg_kebutuhan_updated_at on public.kebutuhan;
create trigger trg_kebutuhan_updated_at
  before update on public.kebutuhan
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 10. TABLE transaksi_keuangan
-- =====================================================
create table if not exists public.transaksi_keuangan (
  id uuid primary key default gen_random_uuid(),
  divisi_id uuid not null references public.divisi(id) on delete cascade,
  laporan_id uuid references public.laporan_harian(id) on delete set null,
  tanggal date not null,
  jenis_transaksi text not null check (jenis_transaksi in ('pemasukan','pengeluaran')),
  keterangan text not null,
  nominal numeric(15,2) not null check (nominal >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transaksi_divisi_id on public.transaksi_keuangan(divisi_id);
create index if not exists idx_transaksi_tanggal on public.transaksi_keuangan(tanggal);
create index if not exists idx_transaksi_jenis on public.transaksi_keuangan(jenis_transaksi);
create index if not exists idx_transaksi_created_by on public.transaksi_keuangan(created_by);

drop trigger if exists trg_transaksi_updated_at on public.transaksi_keuangan;
create trigger trg_transaksi_updated_at
  before update on public.transaksi_keuangan
  for each row execute function public.handle_updated_at();

-- =====================================================
-- 11. ROW LEVEL SECURITY
-- =====================================================
alter table public.divisi enable row level security;
alter table public.profiles enable row level security;
alter table public.anggota_divisi enable row level security;
alter table public.program_kerja enable row level security;
alter table public.laporan_harian enable row level security;
alter table public.kendala_solusi enable row level security;
alter table public.inventaris enable row level security;
alter table public.kebutuhan enable row level security;
alter table public.transaksi_keuangan enable row level security;

-- Helper: role of current user
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_divisi_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select divisi_id from public.profiles where id = auth.uid();
$$;

-- -------- DIVISI --------
drop policy if exists "Divisi: read all" on public.divisi;
create policy "Divisi: read all" on public.divisi
  for select using (true);

drop policy if exists "Divisi: admin sendiri update" on public.divisi;
create policy "Divisi: admin sendiri update" on public.divisi
  for update using (id = public.current_divisi_id())
               with check (id = public.current_divisi_id());

drop policy if exists "Divisi: admin sendiri insert" on public.divisi;
create policy "Divisi: admin sendiri insert" on public.divisi
  for insert with check (id = public.current_divisi_id());

drop policy if exists "Divisi: admin sendiri delete" on public.divisi;
create policy "Divisi: admin sendiri delete" on public.divisi
  for delete using (id = public.current_divisi_id());

-- -------- PROFILES --------
-- User hanya dapat membaca profile miliknya sendiri atau semua untuk level staff
drop policy if exists "Profiles: user read own" on public.profiles;
create policy "Profiles: user read own" on public.profiles
  for select using (
    auth.uid() = id
    or public.current_role() in ('monitoring','sekretaris','bendahara')
  );

-- User dapat meng-update profile miliknya sendiri (nama, email) tetapi TIDAK role & divisi_id
drop policy if exists "Profiles: user update own non-privileged" on public.profiles;
create policy "Profiles: user update own non-privileged" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and divisi_id = (select divisi_id from public.profiles where id = auth.uid())
  );

-- =====================================================
-- 12. GENERIC DATA POLICIES (divisi_id based)
-- Untuk division_admin pakai fungsi is_member() yg memeriksa profile
-- =====================================================
create or replace function public.is_division_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'division_admin', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) in ('monitoring','sekretaris'), false);
$$;

create or replace function public.is_bendahara()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'bendahara', false);
$$;

-- anggota_divisi
drop policy if exists "Anggota: select own divisi" on public.anggota_divisi;
create policy "Anggota: select own divisi" on public.anggota_divisi
  for select using (
    public.is_staff()
    or (public.is_division_admin() and divisi_id = public.current_divisi_id())
  );
drop policy if exists "Anggota: insert own divisi" on public.anggota_divisi;
create policy "Anggota: insert own divisi" on public.anggota_divisi
  for insert with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Anggota: update own divisi" on public.anggota_divisi;
create policy "Anggota: update own divisi" on public.anggota_divisi
  for update using (public.is_division_admin() and divisi_id = public.current_divisi_id())
               with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Anggota: delete own divisi" on public.anggota_divisi;
create policy "Anggota: delete own divisi" on public.anggota_divisi
  for delete using (public.is_division_admin() and divisi_id = public.current_divisi_id());

-- program_kerja
drop policy if exists "Program: select" on public.program_kerja;
create policy "Program: select" on public.program_kerja
  for select using (public.is_staff() or public.is_division_admin());
drop policy if exists "Program: insert own divisi" on public.program_kerja;
create policy "Program: insert own divisi" on public.program_kerja
  for insert with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Program: update own divisi" on public.program_kerja;
create policy "Program: update own divisi" on public.program_kerja
  for update using (public.is_division_admin() and divisi_id = public.current_divisi_id())
               with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Program: delete own divisi" on public.program_kerja;
create policy "Program: delete own divisi" on public.program_kerja
  for delete using (public.is_division_admin() and divisi_id = public.current_divisi_id());

-- laporan_harian
drop policy if exists "Laporan: select" on public.laporan_harian;
create policy "Laporan: select" on public.laporan_harian
  for select using (public.is_staff() or public.is_division_admin());
drop policy if exists "Laporan: insert own divisi" on public.laporan_harian;
create policy "Laporan: insert own divisi" on public.laporan_harian
  for insert with check (
    public.is_division_admin() and divisi_id = public.current_divisi_id()
  );
drop policy if exists "Laporan: update own divisi" on public.laporan_harian;
create policy "Laporan: update own divisi" on public.laporan_harian
  for update using (public.is_division_admin() and divisi_id = public.current_divisi_id())
               with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Laporan: delete own divisi" on public.laporan_harian;
create policy "Laporan: delete own divisi" on public.laporan_harian
  for delete using (public.is_division_admin() and divisi_id = public.current_divisi_id());

-- kendala_solusi
drop policy if exists "Kendala: select" on public.kendala_solusi;
create policy "Kendala: select" on public.kendala_solusi
  for select using (
    public.is_staff()
    or (public.is_division_admin() and laporan_id in (
      select id from public.laporan_harian where divisi_id = public.current_divisi_id()
    ))
  );
drop policy if exists "Kendala: insert" on public.kendala_solusi;
create policy "Kendala: insert" on public.kendala_solusi
  for insert with check (
    public.is_division_admin() and laporan_id in (
      select id from public.laporan_harian where divisi_id = public.current_divisi_id()
    )
  );
drop policy if exists "Kendala: update" on public.kendala_solusi;
create policy "Kendala: update" on public.kendala_solusi
  for update using (
    public.is_division_admin() and laporan_id in (
      select id from public.laporan_harian where divisi_id = public.current_divisi_id()
    )
  ) with check (
    public.is_division_admin() and laporan_id in (
      select id from public.laporan_harian where divisi_id = public.current_divisi_id()
    )
  );
drop policy if exists "Kendala: delete" on public.kendala_solusi;
create policy "Kendala: delete" on public.kendala_solusi
  for delete using (
    public.is_division_admin() and laporan_id in (
      select id from public.laporan_harian where divisi_id = public.current_divisi_id()
    )
  );

-- inventaris
drop policy if exists "Inventaris: select" on public.inventaris;
create policy "Inventaris: select" on public.inventaris
  for select using (public.is_staff() or public.is_division_admin());
drop policy if exists "Inventaris: insert own divisi" on public.inventaris;
create policy "Inventaris: insert own divisi" on public.inventaris
  for insert with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Inventaris: update own divisi" on public.inventaris;
create policy "Inventaris: update own divisi" on public.inventaris
  for update using (public.is_division_admin() and divisi_id = public.current_divisi_id())
               with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Inventaris: delete own divisi" on public.inventaris;
create policy "Inventaris: delete own divisi" on public.inventaris
  for delete using (public.is_division_admin() and divisi_id = public.current_divisi_id());

-- kebutuhan
drop policy if exists "Kebutuhan: select" on public.kebutuhan;
create policy "Kebutuhan: select" on public.kebutuhan
  for select using (public.is_staff() or public.is_division_admin());
drop policy if exists "Kebutuhan: insert own divisi" on public.kebutuhan;
create policy "Kebutuhan: insert own divisi" on public.kebutuhan
  for insert with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Kebutuhan: update own divisi" on public.kebutuhan;
create policy "Kebutuhan: update own divisi" on public.kebutuhan
  for update using (public.is_division_admin() and divisi_id = public.current_divisi_id())
               with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Kebutuhan: delete own divisi" on public.kebutuhan;
create policy "Kebutuhan: delete own divisi" on public.kebutuhan
  for delete using (public.is_division_admin() and divisi_id = public.current_divisi_id());

-- transaksi_keuangan
drop policy if exists "Transaksi: select staff" on public.transaksi_keuangan;
create policy "Transaksi: select staff" on public.transaksi_keuangan
  for select using (public.is_staff() or public.is_bendahara());
drop policy if exists "Transaksi: select own divisi" on public.transaksi_keuangan;
create policy "Transaksi: select own divisi" on public.transaksi_keuangan
  for select using (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Transaksi: insert own divisi" on public.transaksi_keuangan;
create policy "Transaksi: insert own divisi" on public.transaksi_keuangan
  for insert with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Transaksi: update own divisi" on public.transaksi_keuangan;
create policy "Transaksi: update own divisi" on public.transaksi_keuangan
  for update using (public.is_division_admin() and divisi_id = public.current_divisi_id())
               with check (public.is_division_admin() and divisi_id = public.current_divisi_id());
drop policy if exists "Transaksi: delete own divisi" on public.transaksi_keuangan;
create policy "Transaksi: delete own divisi" on public.transaksi_keuangan
  for delete using (public.is_division_admin() and divisi_id = public.current_divisi_id());

-- =====================================================
-- 13. TRIGGER AUTO PROFIL PADA SIGNUP
-- =====================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nama)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nama', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- 14. STORAGE: bucket program-kerja
-- =====================================================
insert into storage.buckets (id, name, public)
values ('program-kerja', 'program-kerja', false)
on conflict (id) do nothing;

-- Policy storage
drop policy if exists "Program kerja: read authenticated" on storage.objects;
create policy "Program kerja: read authenticated"
  on storage.objects for select
  using (
    bucket_id = 'program-kerja'
    and auth.role() = 'authenticated'
    and (
      coalesce((select public.current_role()), '') in ('monitoring','sekretaris')
      or (select public.current_role()) = 'division_admin'
    )
  );

drop policy if exists "Program kerja: upload own" on storage.objects;
create policy "Program kerja: upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );

drop policy if exists "Program kerja: update own" on storage.objects;
create policy "Program kerja: update own"
  on storage.objects for update
  using (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );

drop policy if exists "Program kerja: delete own" on storage.objects;
create policy "Program kerja: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'program-kerja'
    and coalesce((select public.current_role()), '') = 'division_admin'
  );

-- =====================================================
-- 15. SEED 20 DIVISI
-- =====================================================
insert into public.divisi (nomor_divisi, nama_divisi, periode)
select
  gs,
  'Divisi ' || to_char(gs, 'FM00'),
  '2026/2027'
from generate_series(1, 20) as gs
on conflict (nomor_divisi) do nothing;