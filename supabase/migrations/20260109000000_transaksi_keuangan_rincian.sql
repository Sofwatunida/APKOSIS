-- =====================================================
-- APKOSIS - Migration: Rincian Transaksi Keuangan
-- Tujuan:
--   transaksi_keuangan lama hanya menyimpan jenis + keterangan + nominal.
--   Agar "Detail Keuangan" di Rekap Keuangan bisa menampilkan rincian
--   (sumber pemasukan / digunakan untuk), ditambahkan dua kolom nullable.
--   Data lama tidak dirusak: kolom kosong ditampilkan sebagai "-" di UI.
-- Jalankan file ini di Supabase SQL Editor (setelah migration sebelumnya).
-- =====================================================

alter table public.transaksi_keuangan
  add column if not exists sumber_pemasukan text;

alter table public.transaksi_keuangan
  add column if not exists digunakan_untuk text;

create index if not exists idx_transaksi_sumber on public.transaksi_keuangan(sumber_pemasukan);
create index if not exists idx_transaksi_digunakan on public.transaksi_keuangan(digunakan_untuk);
