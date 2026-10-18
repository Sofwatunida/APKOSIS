-- ============================================================
-- Audit Log (append-only) untuk Super Admin
-- ============================================================
-- Mencatat aksi penting pengguna (waktu, aktor, role, aksi, target,
-- sukses/gagal). Bersifat append-only: TIDAK ada policy update/delete,
-- sehingga klien tidak bisa mengubah atau menghapus riwayat.
--
-- Idempoten & tidak menyentuh tabel/migration lain.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  detail text,
  success boolean not null default true,
  ip text,
  device text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs (actor_id);
create index if not exists idx_audit_logs_action on public.audit_logs (action);

alter table public.audit_logs enable row level security;

-- Insert: pengguna terautentikasi hanya boleh menulis log miliknya sendiri.
drop policy if exists "AuditLogs: insert own" on public.audit_logs;
create policy "AuditLogs: insert own" on public.audit_logs
  for insert to authenticated
  with check (auth.uid() = actor_id);

-- Select: hanya Super Admin yang boleh membaca seluruh log.
drop policy if exists "AuditLogs: super_admin select" on public.audit_logs;
create policy "AuditLogs: super_admin select" on public.audit_logs
  for select to authenticated
  using (public.is_super_admin());

-- Sengaja TIDAK dibuat policy update/delete -> append-only.
